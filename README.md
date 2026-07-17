# Leads from Likes

SBL.so's secure, enterprise-grade lead-generation microsite. Visitors paste a LinkedIn post URL, retrieve up to **50** high-value reaction targets in the background, and can export their results as CSV, PDF, or Word.

## Tech Stack
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Express 5 (TypeScript) running on Node.js
- **Database**: Redis (used for async job states, caching, rate limiting, and analytics)
- **Scraper**: Apify (`apimaestro/linkedin-post-reactions` actor)

---

## Architectural Scaling (1000+ Concurrent Users)

To handle heavy traffic spikes without connection dropouts or scraper timeouts:
1. **Asynchronous Scraping Queue**: The API does not wait synchronously for the scraper. Instead, it immediately registers the job on Apify, saves a tracking token in Redis, and returns a `jobId` within **100ms**.
2. **Client-Side Polling**: The frontend client polls `/api/leads/job/:id` every 2 seconds to check status, allowing the user connection to remain lightweight.
3. **Redis Caching**: Successful search results are cached in Redis under `post_cache:POST_URL` for **1 hour**. Duplicate concurrent requests are deduplicated using job locking keys (`post_job_url:POST_URL`). Subsequent hits serve instantly from Redis in **5ms**, bypassing Apify entirely.

---

## Local Setup

1. **Environment Variables**:
   Copy `.env.example` to `.env` and set the required secrets:
   ```bash
   cp .env.example .env
   ```

2. **Start Redis**:
   Ensure Redis is running locally on port 6379, or provide a `REDIS_URL` in `.env`.

3. **Install Dependencies & Start**:
   ```bash
   npm install
   ```
   Start the client (port `5173`) and the Express server (port `5001`) concurrently:
   ```bash
   npm run dev
   ```

---

## Production Configuration

Set `NODE_ENV=production` and configure these environment variables on your host:
- `APIFY_API_TOKEN` (or `SBL_API_KEY`)
- `COOKIE_SECRET` — minimum 32 characters
- `ADMIN_PASSWORD` — minimum 16 characters
- `ALLOWED_ORIGINS` — comma-separated browser origins (essential for iframe framing)
- `REDIS_URL` — production Redis connection string

Build the static assets and run the production server:
```bash
npm run build
npm run start
```
In production, the Express backend serves the React SPA assets from `dist/` directly.

---

## Security Model
- **IP & Cookie Dual Blocker**: A visitor is limited to **one free search** locked by both their IP address and browser session cookie in Redis.
- **Rate Limiting**: Protects endpoints (`/api/leads/*` and admin routes) using Redis token buckets.
- **Framing Protection**: Configured with Content Security Policy and Frame Ancestors headers, allowing it to be safely embedded inside WordPress pages.
- **Fail-Safe Config Checks**: The production server fails closed immediately if key variables or API integrations are missing.

---

## CLI Reference

```bash
npm run dev       # Start client and API in hot-reload mode
npm run build     # Compile production client bundle and server TS
npm run start     # Run compiled production Express server
npm run lint      # Run ESLint validation
```
