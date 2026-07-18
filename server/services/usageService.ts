import crypto from 'crypto';
import { Redis } from 'ioredis';
import { getErrorMessage } from '../utils/errors.js';

export type UsageStatus = 'AVAILABLE' | 'RESERVED' | 'USED';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const reservationTtlMs = 75_000;

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    return Math.min(times * 100, 2_000);
  },
});

redis.on('error', (error: Error) => console.error('[Redis Client Error]', error.message));
redis.on('connect', () => console.log('[Redis] Connected successfully to shared store'));

type EventType = 'visitor_created' | 'search_started' | 'search_success' | 'search_failed' | 'blocked_duplicate' | 'rate_limited' | 'sbl_click' | 'unblock_ip' | 'unblock_visitor';

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export class UsageService {
  static isExemptIp(ip: string): boolean {
    if (!ip) return true;
    const trimmed = ip.trim().toLowerCase();
    
    // Check loopback, localhost, and unknown
    if (
      trimmed === 'unknown' ||
      trimmed === '127.0.0.1' ||
      trimmed === '::1' ||
      trimmed === 'localhost' ||
      trimmed === '::ffff:127.0.0.1'
    ) {
      return true;
    }
    
    // Check private ranges
    if (trimmed.startsWith('10.')) return true;
    if (trimmed.startsWith('192.168.')) return true;
    if (trimmed.startsWith('fe80:')) return true;
    if (trimmed.startsWith('127.')) return true;
    
    if (trimmed.startsWith('172.')) {
      const parts = trimmed.split('.');
      const secondOctet = Number.parseInt(parts[1] ?? '', 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
    
    return false;
  }

  static async getCombinedStatus(visitorId: string | undefined, ip: string): Promise<UsageStatus> {
    try {
      // 1. IP check first (authoritative blocker)
      if (!UsageService.isExemptIp(ip)) {
        const ipStatus = await redis.get(`ip_used:${ip}`);
        if (ipStatus === 'USED') return 'USED';
      }
 
      // 2. Fallback to visitor ID session status
      if (visitorId) {
        const visitorStatus = await redis.get(`visitor:${visitorId}`);
        if (visitorStatus === 'USED') return 'USED';
        if (visitorStatus?.startsWith('RESERVED:')) return 'RESERVED';
      }
 
      return 'AVAILABLE';
    } catch (error: unknown) {
      console.error('[UsageService.getCombinedStatus] Redis error:', getErrorMessage(error));
      throw new Error('Unable to connect to the database service.');
    }
  }
 
  static async getStatus(visitorId: string): Promise<UsageStatus> {
    try {
      const status = await redis.get(`visitor:${visitorId}`);
      if (status === 'USED') return 'USED';
      if (status?.startsWith('RESERVED:')) return 'RESERVED';
      return 'AVAILABLE';
    } catch (error: unknown) {
      console.error('[UsageService.getStatus] Redis error:', getErrorMessage(error));
      throw new Error('Unable to connect to the database service.');
    }
  }
 
  /** Returns a unique reservation token so stale requests cannot release a newer lock. */
  static async reserve(visitorId: string): Promise<string | null> {
    try {
      const reservationId = crypto.randomUUID();
      const result = await redis.set(`visitor:${visitorId}`, `RESERVED:${reservationId}`, 'PX', reservationTtlMs, 'NX');
      return result === 'OK' ? reservationId : null;
    } catch (error: unknown) {
      console.error('[UsageService.reserve] Redis error:', getErrorMessage(error));
      throw new Error('Unable to connect to the database service.');
    }
  }

  static async consume(visitorId: string, reservationId: string, ip: string): Promise<boolean> {
    try {
      const result = await redis.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then redis.call("set", KEYS[1], "USED"); return 1 else return 0 end',
        1,
        `visitor:${visitorId}`,
        `RESERVED:${reservationId}`,
      );
      if (result === 1) {
        // Log the IP as permanently USED (if not exempt)
        if (!UsageService.isExemptIp(ip)) {
          await redis.set(`ip_used:${ip}`, 'USED');
        }
        return true;
      }
      return false;
    } catch (error: unknown) {
      console.error('[UsageService.consume] Redis error:', getErrorMessage(error));
      throw new Error('Unable to connect to the database service.');
    }
  }

  static async release(visitorId: string, reservationId: string): Promise<void> {
    try {
      await redis.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        1,
        `visitor:${visitorId}`,
        `RESERVED:${reservationId}`,
      );
    } catch (error: unknown) {
      console.error('[UsageService.release] Redis error:', getErrorMessage(error));
    }
  }

  private static async checkRateLimit(key: string, limit: number, windowSecs: number): Promise<{ success: boolean; current: number; limit: number }> {
    try {
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, windowSecs);
      return { success: current <= limit, current, limit };
    } catch (error: unknown) {
      console.error('[UsageService.checkRateLimit] Redis error:', getErrorMessage(error));
      throw new Error('Unable to connect to the rate limiter service.');
    }
  }

  static checkIPRateLimit(ip: string) { return this.checkRateLimit(`ip_limit:${ip}`, envInt('IP_LIMIT_MAX', 30), envInt('IP_LIMIT_WINDOW_SECS', 900)); }
  static checkVisitorRateLimit(visitorId: string) { return this.checkRateLimit(`visitor_limit:${visitorId}`, envInt('VISITOR_LIMIT_MAX', 5), envInt('VISITOR_LIMIT_WINDOW_SECS', 600)); }
  static checkAdminLoginRateLimit(ip: string) { return this.checkRateLimit(`admin_login_limit:${ip}`, envInt('ADMIN_LOGIN_LIMIT_MAX', 5), envInt('ADMIN_LOGIN_LIMIT_WINDOW_SECS', 900)); }
  static checkExportRateLimit(visitorId: string) { return this.checkRateLimit(`export_limit:${visitorId}`, envInt('EXPORT_LIMIT_MAX', 20), envInt('EXPORT_LIMIT_WINDOW_SECS', 3_600)); }

  static async createAdminSession(): Promise<string> {
    try {
      const sessionId = crypto.randomBytes(32).toString('hex');
      await redis.set(`admin_session:${sessionId}`, 'active', 'EX', envInt('ADMIN_SESSION_TTL_SECS', 28_800));
      return sessionId;
    } catch (error: unknown) {
      console.error('[UsageService.createAdminSession] Redis error:', getErrorMessage(error));
      throw new Error('Unable to create an admin session.');
    }
  }

  static async isAdminSession(sessionId: string): Promise<boolean> {
    try { return (await redis.get(`admin_session:${sessionId}`)) === 'active'; }
    catch (error: unknown) { console.error('[UsageService.isAdminSession] Redis error:', getErrorMessage(error)); throw new Error('Unable to validate the admin session.'); }
  }

  static async deleteAdminSession(sessionId: string): Promise<void> {
    try { await redis.del(`admin_session:${sessionId}`); }
    catch (error: unknown) { console.error('[UsageService.deleteAdminSession] Redis error:', getErrorMessage(error)); }
  }

  static async logEvent(type: EventType, ip: string, details?: string, visitorId?: string): Promise<void> {
    try {
      const event = { id: crypto.randomUUID(), type, ip, visitorId, timestamp: new Date().toISOString(), details };
      await redis.lpush('stats:recent_activity', JSON.stringify(event));
      await redis.ltrim('stats:recent_activity', 0, 99);
    } catch (error: unknown) { console.error('[UsageService.logEvent] Redis error:', getErrorMessage(error)); }
  }

  private static async incrementStat(key: string, type: EventType, ip: string, details?: string, visitorId?: string): Promise<void> {
    try { await redis.incr(key); await this.logEvent(type, ip, details, visitorId); }
    catch (error: unknown) { console.error('[UsageService.incrementStat] Redis error:', getErrorMessage(error)); }
  }

  static recordVisitor(ip: string, visitorId?: string) { return this.incrementStat('stats:total_visitors', 'visitor_created', ip, undefined, visitorId); }
  static recordSearchSuccess(ip: string, details?: string, visitorId?: string) { return this.incrementStat('stats:successful_searches', 'search_success', ip, details, visitorId); }
  static recordBlocked(ip: string, details?: string, visitorId?: string) { return this.incrementStat('stats:blocked_attempts', 'blocked_duplicate', ip, details, visitorId); }
  static recordRateLimit(ip: string, details?: string, visitorId?: string) { return this.incrementStat('stats:rate_limit_events', 'rate_limited', ip, details, visitorId); }
  static logSearchStart(ip: string, details?: string, visitorId?: string) { return this.logEvent('search_started', ip, details, visitorId); }
  static logSearchFailed(ip: string, details?: string, visitorId?: string) { return this.logEvent('search_failed', ip, details, visitorId); }
  static recordRedirect(ip: string, linkType: string) { return this.incrementStat('stats:sbl_clicks', 'sbl_click', ip, `Redirected to SBL.so website (via: ${linkType})`); }
  static recordUnblockIP(adminIp: string, targetIp: string) { return this.logEvent('unblock_ip', adminIp, `Admin unblocked IP address: ${targetIp}`); }
  static recordUnblockVisitor(adminIp: string, targetVisitorId: string) { return this.logEvent('unblock_visitor', adminIp, `Admin reset visitor session: ${targetVisitorId}`); }

  static async getAnalytics() {
    try {
      const [totalVisitors, successfulSearches, blockedAttempts, rateLimitEvents, sblClicks, rawEvents] = await Promise.all([
        redis.get('stats:total_visitors'), redis.get('stats:successful_searches'), redis.get('stats:blocked_attempts'), redis.get('stats:rate_limit_events'), redis.get('stats:sbl_clicks'), redis.lrange('stats:recent_activity', 0, 99),
      ]);
      const recentActivity = rawEvents.flatMap((raw: string) => { try { return [JSON.parse(raw) as unknown]; } catch { return []; } });
      return { totalVisitors: Number.parseInt(totalVisitors ?? '0', 10), successfulSearches: Number.parseInt(successfulSearches ?? '0', 10), blockedAttempts: Number.parseInt(blockedAttempts ?? '0', 10), rateLimitEvents: Number.parseInt(rateLimitEvents ?? '0', 10), sblClicks: Number.parseInt(sblClicks ?? '0', 10), recentActivity };
    } catch (error: unknown) { console.error('[UsageService.getAnalytics] Redis error:', getErrorMessage(error)); throw new Error('Unable to retrieve stats from database.'); }
  }
}
