# Project State: Leads from Likes

## Purpose

This is a small full-stack SBL.so acquisition microsite. A visitor pastes a LinkedIn post URL and can receive up to **50** people who reacted to that post. The free result acts as an upgrade path to the full SBL platform.

## Architecture

```text
React + Vite + Tailwind client
  -> Express API
    -> Redis (visitor state, rate limits, async jobs, cached results)
    -> Apify LinkedIn post-reactions actor (asynchronous runs)
```

### Client (`src/`)

- `App.tsx` manages public flow (checking visitor status and rendering search/results views).
- `components/` contains the URL form, loading/error states, lead cards/results, upgrade CTA, and header.
- `services/postLikesService.ts` handles asynchronous polling of lead jobs from the backend.
- `schemas/postLikesSchema.ts` performs client-side LinkedIn URL validation.
- `utils/analytics.ts` records outbound SBL click events.

### Server (`server/`)

- `index.ts` defines API routes (search triggers, polling, exports, track-click, admin panel unblockers).
- `services/sblLeadService.ts` contains API client methods to start runs, poll statuses, and fetch dataset items from Apify.
- `services/usageService.ts` owns Redis-backed visitor usage, limits, event logging, and analytics.
- `schemas/postLikesSchema.ts` validates URL and export payloads (limits up to 50 elements).
- `utils/logger.ts` masks sensitive log fields and anonymizes IPs in application logs.

---

## Core User Flow

1. **Visitor Identification**: A visitor session is identified by custom header `X-Visitor-Id` (supplied from `localStorage` in WordPress contexts) or a signed `sbl_visitor_id` HttpOnly cookie.
2. **Usage Checks**: `GET /api/leads/status` checks both the client IP address (`ip_used:${ip}` in Redis) and visitor ID session status, reporting `AVAILABLE`, `RESERVED`, or `USED`.
3. **Trigger Search (`POST /api/leads/post-likes`)**:
   - Checks Redis cache: If cached, returns leads instantly.
   - Otherwise, checks if a job is already processing for this URL to deduplicate.
   - Reserves the visitor state as `RESERVED:${jobId}` and triggers an asynchronous Apify Actor run.
   - Returns `{ success: true, status: 'processing', jobId }` within **100ms**.
4. **Client-Side Polling (`GET /api/leads/job/:jobId`)**:
   - Client polls every 2 seconds.
   - Server checks the status of the run on Apify.
   - Once completed, the server downloads the dataset items, stores them in Redis cache (`post_cache:POST_URL`) for **1 hour**, flags the visitor and IP as `USED`, and returns the leads.
5. **Deduplication**: If the user double-clicks or triggers concurrent requests for the same URL, the server matches the active `RESERVED` status block to the active `jobId` and continues polling without erroring out.
6. **Upgrade CTA**: The UI presents results and an SBL upgrade CTA. A consumed visitor/IP sees the upgrade state instead of the form.

---

## Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `GET /api/leads/status` | `GET` | Free-search status for the visitor session (header or cookie) |
| `POST /api/leads/post-likes` | `POST` | Trigger asynchronous lookup job for LinkedIn post reactions |
| `GET /api/leads/job/:jobId` | `GET` | Poll active scraper job run status and fetch results |
| `POST /api/leads/export` | `POST` | Export results up to 50 items as CSV, PDF, or Word |
| `POST /api/leads/track-click` | `POST` | Record outbound SBL link clicks |
| `POST /api/admin/unblock` | `POST` | Bearer-token authorized unblocking of an IP or resetting visitor state |

---

## Runtime Configuration

Do not place credential values in this file. The server reads:

- `PORT` (defaults to 5001)
- `APIFY_API_TOKEN` (or `SBL_API_KEY`)
- `REDIS_URL`
- `ADMIN_PASSWORD` (defaults to `pas@123`)
- `COOKIE_SECRET` (required to be custom in production)
- `ALLOWED_ORIGINS`
- `IP_LIMIT_MAX`, `IP_LIMIT_WINDOW_SECS`
- `VISITOR_LIMIT_MAX`, `VISITOR_LIMIT_WINDOW_SECS`
- `TRUST_PROXY_HOPS` (Must be set to `1` behind Render's load balancer to read real client IPs)

### Render Cloud Deployment Configuration

The application is deployed using a `render.yaml` Blueprint:
- **Build & Start**: Build runs `npm run build` (which compiles React assets and Express TypeScript server files to `dist/`). Start command runs `npm run start` (starts compiled Node server).
- **Auto-Provisioned Redis**: Configured via a Render Redis service linked to the Node web service using the internal connection string dynamic property (`REDIS_URL` = `fromService.property: connectionString`).
- **Proxy Hops**: `TRUST_PROXY_HOPS=1` ensures the rate limiters read client IPs correctly behind Render's load balancer.

---

## Known Integration Notes for AIs

- **LinkedIn Actor behavior**: The scraper run uses the `apimaestro/linkedin-post-reactions` actor on Apify.
- **Port Conflict Safeguards**: When restarting server processes, always check for detached node processes (holding onto port 5001) running under parent PID `1` using `ps -ef | grep node` and kill them to prevent stale code or old validation limits from running.
- **Redis writes block safety**: If the local Redis instance throws write/snapshot errors (e.g. `MISCONF Redis is configured to save RDB snapshots...`), disable it dynamically with `redis.config('SET', 'stop-writes-on-bgsave-error', 'no')`.
- **Client and server duplicate schemas**: URL validation logic resides in both `src/schemas/` and `server/schemas/`. When editing rules, ensure consistency.
