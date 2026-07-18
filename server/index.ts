import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import path from 'path';
import { leadExportRequestSchema, postLikesRequestSchema } from './schemas/postLikesSchema.js';
import { LeadExportService, ExportFormat } from './services/exportService.js';
import { SBLLeadService } from './services/sblLeadService.js';
import { redis, UsageService } from './services/usageService.js';
import { getErrorMessage, getErrorStatusCode } from './utils/errors.js';
import { Logger } from './utils/logger.js';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const cookieSecret = process.env.COOKIE_SECRET;
const adminPassword = process.env.ADMIN_PASSWORD;
const apifyToken = process.env.APIFY_API_TOKEN || process.env.SBL_API_KEY;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || (isProduction ? '' : 'http://localhost:5173,http://localhost:3000'))
  .split(',').map(origin => origin.trim()).filter(Boolean);
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '0', 10);

function failConfiguration(message: string): never {
  Logger.error(`CRITICAL CONFIGURATION ERROR: ${message}`);
  process.exit(1);
}

if (isProduction) {
  if (!cookieSecret || cookieSecret.length < 32) failConfiguration('COOKIE_SECRET must be set to a custom value of at least 32 characters.');
  if (!adminPassword || adminPassword.length < 16) failConfiguration('ADMIN_PASSWORD must be set to a value of at least 16 characters.');
  if (!apifyToken) failConfiguration('APIFY_API_TOKEN or SBL_API_KEY must be configured.');
  if (allowedOrigins.length === 0) failConfiguration('ALLOWED_ORIGINS must list the public application origin.');
}
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) failConfiguration('TRUST_PROXY_HOPS must be a non-negative integer.');

const app = express();
const port = Number.parseInt(process.env.PORT ?? '5001', 10) || 5001;
const cookieSigningSecret = cookieSecret || 'development-only-cookie-secret-change-before-production';
// Only trust forwarded client IPs when deployment configuration explicitly opts in.
app.set('trust proxy', trustProxyHops);

app.use(helmet({
  frameguard: false, // Disable X-Frame-Options to allow framing inside WordPress cross-origin iframes
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'", ...allowedOrigins],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", ...allowedOrigins],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://media.licdn.com', 'https://*.linkedin.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(express.json({ limit: '25kb' }));
app.use(cookieParser(cookieSigningSecret));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Blocked by CORS policy'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Id'],
}));

// Never let a shared cache/CDN store per-visitor API responses (status, leads, jobs).
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, private');
  res.set('Vary', 'X-Visitor-Id, Cookie, Origin');
  next();
});

// Resolve the end-user IP from what the deployment platform itself guarantees.
// req.ip is derived by Express from the RIGHTMOST proxy-appended x-forwarded-for
// entry (per app.set('trust proxy', TRUST_PROXY_HOPS)), which clients cannot
// spoof. Client-supplied headers like cf-connecting-ip / x-real-ip are NOT
// trusted unless TRUSTED_IP_HEADER explicitly names one (set it ONLY when a
// proxy in front, e.g. Cloudflare, strips and re-sets that header itself).
const trustedIpHeader = (process.env.TRUSTED_IP_HEADER || '').toLowerCase();

function clientIp(req: Request): string {
  if (trustedIpHeader) {
    const raw = req.headers[trustedIpHeader];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const first = value?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isPasswordValid(candidate: unknown): boolean {
  if (typeof candidate !== 'string' || !adminPassword) return false;
  const actual = Buffer.from(adminPassword);
  const provided = Buffer.from(candidate);
  return actual.length === provided.length && crypto.timingSafeEqual(actual, provided);
}

// Do not create public visitor records while using the admin API.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS' || req.path.startsWith('/api/admin')) return next();
  
  // Extract visitor ID from header, query parameter, or signed cookies
  let visitorId = req.headers['x-visitor-id'] || req.query.visitorId || req.signedCookies.sbl_visitor_id;
  if (Array.isArray(visitorId)) visitorId = visitorId[0];
  if (typeof visitorId !== 'string' || visitorId.length === 0) {
    visitorId = crypto.randomUUID();
    res.cookie('sbl_visitor_id', visitorId, { httpOnly: true, secure: isProduction, signed: true, maxAge: 1000 * 60 * 60 * 24 * 365, sameSite: 'lax', path: '/api' });
    req.signedCookies.sbl_visitor_id = visitorId;
    const ip = clientIp(req);
    void UsageService.recordVisitor(ip, visitorId).catch(error => Logger.error('Failed to record visitor stats', { error: getErrorMessage(error) }));
  } else {
    // Sync into request signed cookies for downstream compatibility
    req.signedCookies.sbl_visitor_id = visitorId;
  }
  next();
});

app.get('/api/leads/status', async (req, res) => {
  let visitorId = req.headers['x-visitor-id'] || req.query.visitorId || req.signedCookies.sbl_visitor_id;
  if (Array.isArray(visitorId)) visitorId = visitorId[0];
  const ip = clientIp(req);
  try {
    const status = await UsageService.getCombinedStatus(visitorId, ip);
    res.json({ success: true, status });
  } catch (error: unknown) {
    Logger.error('Failed to query status', { ip, error: getErrorMessage(error) });
    res.status(500).json({ success: false, error: 'Unable to retrieve status.' });
  }
});

app.post('/api/leads/post-likes', async (req, res) => {
  let visitorId = req.headers['x-visitor-id'] || req.query.visitorId || req.signedCookies.sbl_visitor_id;
  if (Array.isArray(visitorId)) visitorId = visitorId[0];
  const ip = clientIp(req);
  const startTime = Date.now();
  if (typeof visitorId !== 'string' || visitorId.length === 0) {
    res.status(400).json({ success: false, count: 0, leads: [], error: 'A valid session identifier is required to use this free tool. Please enable cookies or local storage and try again.' });
    return;
  }

  const validation = postLikesRequestSchema.safeParse(req.body);
  if (!validation.success) {
    const error = validation.error.issues[0]?.message ?? 'Invalid URL';
    await UsageService.logSearchFailed(ip, `Validation failed: ${error}`, visitorId);
    res.status(400).json({ success: false, count: 0, leads: [], error });
    return;
  }
  const postUrl = validation.data.postUrl;

  try {
    const [ipRateLimit, visitorRateLimit] = await Promise.all([UsageService.checkIPRateLimit(ip), UsageService.checkVisitorRateLimit(visitorId)]);
    if (!ipRateLimit.success || !visitorRateLimit.success) {
      await UsageService.recordRateLimit(ip, 'Search rate limit exceeded', visitorId);
      res.status(429).json({ success: false, count: 0, leads: [], error: 'Too many search requests. Please try again later.' });
      return;
    }
    const currentStatus = await UsageService.getCombinedStatus(visitorId, ip);
    if (currentStatus === 'USED') {
      await UsageService.recordBlocked(ip, 'Duplicate search blocked', visitorId);
      res.status(403).json({ success: false, count: 0, leads: [], code: 'FREE_USAGE_ALREADY_USED', error: "You've already used your free search. Explore SBL to discover more leads." });
      return;
    }
    if (currentStatus === 'RESERVED') {
      const existingJobId = await redis.get(`post_job_url:${postUrl}`);
      if (existingJobId) {
        res.json({ success: true, status: 'processing', jobId: existingJobId });
        return;
      }
      res.status(429).json({ success: false, count: 0, leads: [], code: 'FREE_USAGE_PROCESSING', error: 'Your search is already being processed.' });
      return;
    }

    // 1. Check Redis cache first (instant result!)
    const cachedData = await redis.get(`post_cache:${postUrl}`);
    if (cachedData) {
      const leads = JSON.parse(cachedData);
      // Consume visitor session and IP limit immediately for the free search consumption
      await redis.set(`visitor:${visitorId}`, 'USED');
      if (!UsageService.isExemptIp(ip)) {
        await redis.set(`ip_used:${ip}`, 'USED');
      }
      await UsageService.recordSearchSuccess(ip, `Retrieved ${leads.length} leads successfully (cached)`, visitorId);
      res.json({ success: true, status: 'completed', count: leads.length, leads });
      return;
    }

    // 2. Check if a job is already running for this URL in Redis to prevent duplicate scraper calls
    const existingJobId = await redis.get(`post_job_url:${postUrl}`);
    if (existingJobId) {
      // Bind this visitor to the existing job
      await redis.set(`visitor:${visitorId}`, `RESERVED:${existingJobId}`, 'PX', 75000);
      res.json({ success: true, status: 'processing', jobId: existingJobId });
      return;
    }

    // 3. Reserve the visitor for the new job
    const jobId = crypto.randomUUID();
    const reserved = await redis.set(`visitor:${visitorId}`, `RESERVED:${jobId}`, 'PX', 75000, 'NX');
    if (!reserved) {
      await UsageService.recordBlocked(ip, 'Concurrent lock acquisition failed', visitorId);
      res.status(429).json({ success: false, count: 0, leads: [], code: 'FREE_USAGE_PROCESSING', error: 'Your search is already being processed.' });
      return;
    }

    await UsageService.logSearchStart(ip, 'LinkedIn scraper async request triggered', visitorId);

    // 4. Call Apify asynchronously
    const { runId, datasetId } = await SBLLeadService.startPostLikesJob(postUrl);

    // 5. Save Job details in Redis
    await redis.set(`job:${jobId}`, JSON.stringify({ status: 'processing', runId, datasetId, postUrl, visitorId, ip }), 'EX', 600);
    // Link URL to jobId so other concurrent searches for the same URL can reuse it
    await redis.set(`post_job_url:${postUrl}`, jobId, 'EX', 75);

    res.json({ success: true, status: 'processing', jobId });

  } catch (error: unknown) {
    const statusCode = getErrorStatusCode(error) ?? 500;
    const message = getErrorMessage(error);
    const errorMessage = message.includes('not configured') ? 'SBL API integration is not configured.'
      : message.includes('Unable to connect') || message.includes('responded with status') || message.includes('fetch failed') ? 'Unable to connect to the lead data service. Please try again later.'
      : statusCode === 500 ? "We couldn't retrieve leads right now. Please try again." : message;
    Logger.error('Search query execution failed', { ip, visitorId, latency: Date.now() - startTime, error: errorMessage, statusCode });
    res.status(statusCode).json({ success: false, count: 0, leads: [], error: errorMessage });
  }
});

app.get('/api/leads/job/:jobId', async (req, res) => {
  const { jobId } = req.params;
  let visitorId = req.headers['x-visitor-id'] || req.query.visitorId || req.signedCookies.sbl_visitor_id;
  if (Array.isArray(visitorId)) visitorId = visitorId[0];

  try {
    const jobDataRaw = await redis.get(`job:${jobId}`);
    if (!jobDataRaw) {
      res.status(404).json({ success: false, error: 'Search job not found or expired.' });
      return;
    }

    const job = JSON.parse(jobDataRaw);

    // If already completed in Redis, return it
    if (job.status === 'completed') {
      res.json({ success: true, status: 'completed', count: job.leads.length, leads: job.leads });
      return;
    }
    if (job.status === 'failed') {
      res.json({ success: true, status: 'failed', error: job.error || 'Job execution failed.' });
      return;
    }

    // Otherwise, check status on Apify
    const runStatus = await SBLLeadService.checkJobStatus(job.runId);

    if (runStatus === 'completed') {
      // Fetch leads from dataset
      const leads = await SBLLeadService.fetchDatasetLeads(job.datasetId);

      // Save to cache for 1 hour
      await redis.set(`post_cache:${job.postUrl}`, JSON.stringify(leads), 'EX', 3600);

      // Mark the original visitor and IP as USED
      await redis.set(`visitor:${job.visitorId}`, 'USED');
      if (!UsageService.isExemptIp(job.ip)) {
        await redis.set(`ip_used:${job.ip}`, 'USED');
      }

      // Update job state in Redis
      job.status = 'completed';
      job.leads = leads;
      await redis.set(`job:${jobId}`, JSON.stringify(job), 'EX', 600);

      // Clean up URL-to-job link
      await redis.del(`post_job_url:${job.postUrl}`);

      await UsageService.recordSearchSuccess(job.ip, `Retrieved ${leads.length} leads successfully (async)`, job.visitorId);
      res.json({ success: true, status: 'completed', count: leads.length, leads });
    } else if (runStatus === 'failed') {
      // Release reservation so user can retry
      await redis.del(`visitor:${job.visitorId}`);
      await redis.del(`post_job_url:${job.postUrl}`);

      job.status = 'failed';
      job.error = 'LinkedIn scraper run failed or timed out.';
      await redis.set(`job:${jobId}`, JSON.stringify(job), 'EX', 600);

      res.json({ success: true, status: 'failed', error: job.error });
    } else {
      res.json({ success: true, status: 'processing' });
    }
  } catch (error: unknown) {
    Logger.error('Failed to query job status', { jobId, error: getErrorMessage(error) });
    res.status(500).json({ success: false, error: 'Unable to retrieve search status.' });
  }
});

app.post('/api/leads/export', async (req, res) => {
  let visitorId = req.headers['x-visitor-id'] || req.query.visitorId || req.signedCookies.sbl_visitor_id;
  if (Array.isArray(visitorId)) visitorId = visitorId[0];
  const ip = clientIp(req);
  if (typeof visitorId !== 'string' || visitorId.length === 0 || await UsageService.getCombinedStatus(visitorId, ip) !== 'USED') {
    res.status(403).json({ success: false, error: 'Complete a free search before downloading leads.' });
    return;
  }
  try {
    const rate = await UsageService.checkExportRateLimit(visitorId);
    if (!rate.success) {
      res.status(429).json({ success: false, error: 'Too many export requests. Please try again later.' });
      return;
    }
    const validation = leadExportRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: validation.error.issues[0]?.message ?? 'Invalid export request.' });
      return;
    }
    const { format, leads } = validation.data;
    const fileName = `sbl-linkedin-leads-${new Date().toISOString().slice(0, 10)}.${format}`;
    const contentType: Record<ExportFormat, string> = { csv: 'text/csv; charset=utf-8', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    const content = format === 'csv' ? LeadExportService.createCsv(leads) : format === 'pdf' ? await LeadExportService.createPdf(leads) : await LeadExportService.createDocx(leads);
    res.setHeader('Content-Type', contentType[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(content);
  } catch (error: unknown) {
    Logger.error('Lead export failed', { ip: clientIp(req), error: getErrorMessage(error) });
    res.status(500).json({ success: false, error: 'Unable to create the requested export.' });
  }
});

app.post('/api/leads/track-click', async (req, res) => {
  const linkType = typeof req.body?.linkType === 'string' && /^[a-z0-9_-]{1,80}$/i.test(req.body.linkType) ? req.body.linkType : 'unknown';
  try { await UsageService.recordRedirect(clientIp(req), linkType); res.json({ success: true }); }
  catch (error: unknown) { Logger.error('Failed to track redirect click', { ip: clientIp(req), error: getErrorMessage(error) }); res.status(500).json({ success: false }); }
});

// Password-protected: report the caller's IP exactly as the server resolves it,
// plus whether that IP currently holds a free-search block. This removes the
// IPv4-vs-IPv6 guesswork when resetting usage from the /admin panel.
app.get('/api/admin/whoami', async (req, res) => {
  const authHeader = req.headers.authorization;
  const ip = clientIp(req);

  try {
    const adminRate = await UsageService.checkAdminLoginRateLimit(ip);
    if (!adminRate.success) {
      Logger.warn('Admin whoami rate limit exceeded', { ip });
      res.status(429).json({ success: false, error: 'Too many attempts. Please try again later.' });
      return;
    }
  } catch (error: unknown) {
    Logger.error('Admin rate limit check failed', { ip, error: getErrorMessage(error) });
    res.status(500).json({ success: false, error: 'Unable to process the request.' });
    return;
  }

  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  if (!isPasswordValid(token)) {
    Logger.warn('Unauthorized admin whoami request', { ip });
    res.status(401).json({ success: false, error: 'Unauthorized access.' });
    return;
  }

  try {
    const ipStatus = await redis.get(`ip_used:${ip}`);
    res.json({ success: true, ip, ipBlocked: ipStatus === 'USED' });
  } catch (error: unknown) {
    Logger.error('Admin whoami lookup failed', { ip, error: getErrorMessage(error) });
    res.status(500).json({ success: false, error: 'Unable to look up the IP status.' });
  }
});

// Protected endpoint to unblock/reset an IP rate limit or visitor session status (directly authenticated via password)
app.post('/api/admin/unblock', async (req, res) => {
  const authHeader = req.headers.authorization;
  const ip = clientIp(req);

  // Throttle admin auth attempts per IP to block password brute-forcing.
  try {
    const adminRate = await UsageService.checkAdminLoginRateLimit(ip);
    if (!adminRate.success) {
      Logger.warn('Admin unblock rate limit exceeded', { ip });
      res.status(429).json({ success: false, error: 'Too many attempts. Please try again later.' });
      return;
    }
  } catch (error: unknown) {
    Logger.error('Admin rate limit check failed', { ip, error: getErrorMessage(error) });
    res.status(500).json({ success: false, error: 'Unable to process the request.' });
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    Logger.warn('Unauthorized admin unblock request: missing token', { ip });
    res.status(401).json({ success: false, error: 'Unauthorized access.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!isPasswordValid(token)) {
    Logger.warn('Unauthorized admin unblock request: invalid token', { ip });
    res.status(401).json({ success: false, error: 'Unauthorized access.' });
    return;
  }

  const type = req.body?.type;
  const target = req.body?.target;
  if ((type !== 'ip' && type !== 'visitor') || typeof target !== 'string' || target.length === 0 || target.length > 200) {
    res.status(400).json({ success: false, error: 'Invalid target or unblock type.' });
    return;
  }

  try {
    if (type === 'ip') {
      const deletedIpLimit = await redis.del(`ip_limit:${target}`, `admin_login_limit:${target}`, `ip_used:${target}`);
      await UsageService.recordUnblockIP(ip, target);
      Logger.info('Admin successfully unblocked IP', { adminIp: ip, targetIp: target, deletedIpLimit });
    } else {
      const deletedStatus = await redis.del(`visitor:${target}`, `visitor_limit:${target}`, `export_limit:${target}`);
      await UsageService.recordUnblockVisitor(ip, target);
      Logger.info('Admin successfully reset visitor session', { adminIp: ip, targetVisitorId: target, deletedStatus });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    Logger.error('Failed to execute admin unblock action', { ip, type, target, error: getErrorMessage(error) });
    res.status(500).json({ success: false, error: 'Failed to perform unblock action.' });
  }
});

// A single production process serves both the API and the built SPA.
if (isProduction) {
  const clientDist = path.resolve(process.cwd(), 'dist');
  app.use(express.static(clientDist, { index: false, dotfiles: 'deny', maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  void _next;
  const statusCode = getErrorStatusCode(error) ?? 500;
  Logger.error('Unhandled middleware exception caught', { ip: clientIp(req), error: getErrorMessage(error), statusCode });
  res.status(statusCode).json({ success: false, count: 0, leads: [], error: statusCode === 413 ? 'Payload too large. Request body must be under 25KB.' : 'An unexpected error occurred on the server.' });
});

app.listen(port, () => Logger.info(`SBL API server successfully listening on port ${port}`));
