# Agent Instructions

## Required Orientation

Before making changes, read `STATE.md` completely. It is the durable handoff for this project and describes the product, architecture, current health, and known constraints.

## Project Intent

Preserve this as a simple, trustworthy SBL lead-generation microsite: a LinkedIn post URL produces a limited set of reaction leads and guides users to the full SBL product.

## Safety Rules

- Never print, commit, copy, or add real values from `.env` to source, documentation, logs, or chat responses.
- Treat Apify usage as paid/external work. Do not run live lead lookups merely for testing unless explicitly asked.
- Preserve the one-free-search behavior unless a requested product change explicitly modifies it.
- Keep server-side validation authoritative; client-side validation is only for user experience.
- Do not weaken CORS, cookie, rate-limit, or security-header behavior without explaining the tradeoff.

## Change Guidelines

- The URL schema and API types are duplicated in `src/` and `server/`; update both copies when changing their contract.
- Keep API responses consistent with the existing `success`, `count`, `leads`, `error`, and optional `code` shapes.
- Prefer focused, small changes. Do not replace the stack or redesign the data flow without an explicit request.
- If a change affects visitor usage, Redis keys, Apify payloads, or admin functionality, update `STATE.md` in the same task.
- Update `README.md` when setup, deployment, or public usage instructions change.

## Verification

- Run the narrowest relevant checks first.
- For broad code changes, run `npm run build` and `npm run lint`.
- Lint failures already exist at baseline; clearly distinguish new failures from the recorded baseline in `STATE.md`.
- Do not rely on live Apify calls as routine tests.

## End-of-Task Handoff

When work materially changes the product or architecture, update `STATE.md` with:

- what changed,
- any new configuration or operational requirement,
- verification results, and
- remaining risks or follow-up work.
