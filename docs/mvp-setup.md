# Home Area Reporter

ZIP-based research: What documented development, transit, public investment and parking activity is shaping this Seattle area?

Status: working Next.js website, local PostgreSQL persistence compatible with Neon, complete background permit ingestion for 98101–98105, canonical project construction, compact summary APIs, synchronized map/list presentation, full evidence report and an extension summary on Redfin/Zillow. Cloud Neon provisioning, durable jobs, transit/parking/infrastructure connectors, payments and deployment remain planned.

## Product
- Chrome popup on Redfin/Zillow with up to fifteen highlights, plus direct website ZIP entry and full report.
- Initial service-area records are 98101–98105. Adding coverage is configuration plus a jurisdiction connector, not a validation-regex change.
- Free area brief first. Pro pricing: $10 single property report / $20 five-report bundle; guest checkout. Pricing does not imply all source categories are integrated.
- No comparison or favorites in MVP.

## Stack
Implemented: Next.js App Router + JavaScript/ES modules, React, CSS, Drizzle schema definitions, committed PostgreSQL migrations, postgres.js, server-only Socrata adapters and Node tests. Local PostgreSQL uses the same `DATABASE_URL` boundary planned for Neon. Latitude/longitude and in-process Haversine ordering avoid a PostGIS requirement for the initial five ZIPs. A durable queue remains a later production decision; email and hosted payment remain later work.

## Sources
See docs/free-sources.md and sources.json. Sources have independent access, reuse, geographic and freshness limits. A free public page is not automatically commercially reusable. Never turn missing source coverage into 'no changes'.

## Repository plan
GitHub repository: https://github.com/aarushi12002/home_area_reporter (public, created by the owner).

## Checks
Run `npm test`, `npm run build`, `node --check extension/popup.js`, and optionally `python scripts/probe_sources.py`. The probe requires internet and only inspects source metadata. See README for local run and Vercel root-directory instructions.

Implemented testing layers: deterministic Node tests for normalization, adapter failure/pagination/deadline behavior, the real API handler with mocked upstream fetches (including cache TTL, in-flight sharing and recovery), and VM-based extension handoff checks. GitHub Actions runs tests, extension syntax and a production build on push/PR with Node 22; no live APIs or credentials are required. The workflow supplies checks, not branch protection.

Release validation still required: unpacked-extension journeys on live Redfin and Zillow pages, print/mobile layouts, and a manually reviewed official-record fixture set to evaluate relevance, inferred grouping and omissions. Deterministic tests, database smoke checks and live ingestion establish software behavior only; they do not establish complete coverage, factual interpretation or forecast quality.

## First implementation
1. Implemented: website/extension validation for 98101–98105; listing JSON-LD supplies optional address/coordinates and the listing URL is never sent.
2. Implemented: persistent building + land-use ingestion, explainable project grouping, stale/undated suppression in the primary view, compact ranking and paginated evidence. Never imply permit issuance establishes construction started.
3. Planned: current transit schedule context with required attribution; future rail project coverage remains unresolved.
4. Planned: parking context; policy-change detection waits for dated rules/announcements and reusable sources.
5. Evidence fields and source coverage in the full website report; the compact extension intentionally omits normal coverage detail. Deployment + private beta remain before payments.

## Implementation increments

1. **Portable persistence foundation — implemented.** Define service areas, sources, sync runs, immutable source evidence, canonical projects, record relationships and project events in Drizzle/PostgreSQL. Commit migrations and keep local database files and credentials ignored so the same application boundary can later point at Neon.
2. **Complete background ingestion — implemented.** Page through both Seattle permit feeds with stable ordering, retries and a safety ceiling; record each source/ZIP run; upsert raw evidence idempotently; retire missing active records only after a complete successful source run; preserve the prior snapshot after a failure.
3. **Normalization and canonical projects — implemented.** Validate dates and coordinates, retain original statuses and source links, filter closed/routine records, assign conservative category/stage labels, group explicit permit references before high-confidence address/description matches, and retain confidence plus traceable relationships.
4. **Focused ranking and summary API — implemented.** Suppress stale/undated projects from the primary view, score stage/recency/scale/evidence, apply request-only proximity when listing coordinates exist, expose transparent ranking reasons, and cap `/api/area-summary` at fifteen items while leaving all evidence queryable.
5. **Progressive website report — implemented.** Render a compact snapshot first; lazily request paginated project evidence only after **Open full report**; place source coverage/limitations in a collapsed full-report section; preserve official evidence links and print/save-PDF support.
6. **Thin extension and operating path — implemented locally.** Extract listing JSON-LD only after the user clicks the extension, send ZIP plus optional address/coordinates but never the listing URL, render the fifteen-item summary, and hand off to the website. Add protected scheduled-ingestion configuration, setup documentation and deterministic/browser checks; cloud database provisioning, deployment hardening and live Redfin/Zillow unpacked-extension acceptance remain release work.
7. **Focused map visualization — implemented locally.** Return existing project coordinates in the compact contract, display numbered stage-colored markers plus an optional listing marker, and add paginated projects to the detailed-report map as the user loads them. The extension embeds a compact same-origin website map so Manifest V3 code remains packaged locally. Records without usable coordinates remain in the list. Local development defaults to OSM tiles; production requires a configurable provider with verified terms, quotas, caching and attribution.

## Current request flow
1. Direct website and extension accept only enabled initial service areas. Unsupported ZIPs receive an explicit response.
2. Extension reads available listing JSON-LD after the user invokes it, requests `GET /api/area-summary`, renders up to fifteen highlights, and links to `/report`. It stores only the reporter origin.
3. Scheduled/manual ingestion uses fixed official dataset endpoints, complete stable pagination, retries and one sync run per source/ZIP. Successful syncs replace records no longer present in the active query; failed syncs preserve earlier data.
4. Raw JSON, hashes, retrieval time, source event time and status are persisted. Normalization invalidates sentinel dates, classifies category/stage and retains traceable source links.
5. Project construction groups explicit references first and high-similarity same-address descriptions second, recording relationship type and confidence. Stale and undated projects remain stored but are hidden from the primary view.
6. `/api/area-summary` returns counts and at most fifteen highlights. `/api/projects` returns paginated current evidence and coverage. `/api/projects/:id` returns a persistent project timeline. `/map` renders the compact same-origin extension map. The old `/api/report` remains as a compatibility/live diagnostic route.
7. Listing coordinates alter display ordering through proximity but are not persisted. Without coordinates, ranking uses stage, recency, scale and evidence confidence.
8. When the database is missing or has not ingested a supported area, the summary API uses a 15-minute live fallback and still returns only a compact response.
9. Printing uses the browser's print/save-PDF action. Sources remain online links; there is no server PDF or email delivery.

## Background versus click path

Eight background steps run outside the listing click: select enabled areas/sources, fetch all active pages, persist raw records, normalize, classify, resolve geography, group projects, and materialize ranking features. Five click-path steps remain: capture listing context, validate/resolve location, query persisted candidates, apply property-relative ranking, and render the compact result. Only validation, querying and ranking happen synchronously on the backend.

## Persistence and scheduling

`db/schema.mjs` and `drizzle/0000_area_pipeline.sql` are canonical, committed database artifacts. Local database files and `.env.local` are ignored. `npm run db:migrate` is idempotent; `npm run db:ingest` refreshes all five areas or accepts `-- --zips=98103`. Production scheduling is declared in `vercel.json` and protected by `CRON_SECRET`; Vercel Cron is a scheduler, not a durable job queue, so overlapping runs, per-source workflows and stronger retry orchestration remain a production-hardening decision.

The scheduled request enters through `/api/internal/ingest`; it is not a public browser endpoint. Fresh-machine setup is canonical in `docs/fresh-machine-setup.md`. Repository-local post-commit diagnostics, a blocking pre-push hook and CI all run `npm run docs:check` to keep setup commands, environment variables, routes, supported ZIPs and extension metadata synchronized.

## Evidence and model boundaries
No LLM is used. Official descriptions and original status are shown with conservative stage labels. Available source dates are event dates, not update dates; retrieval timestamps are separate. No price forecast, inferred growth score or automatic proximity/impact conclusion. Unit counts remain per record, not summed across permits. The report explicitly lists disconnected source categories and coverage limits.

## Accepted implementation decisions

### 2026-10-18
- Preserve the live on-demand permit slice as a fallback while moving the primary experience to persisted background ingestion. This permits local validation before cloud Neon provisioning without keeping external crawling on the user click.
- Initial area rollout is data-driven for 98101–98105. Normal coverage detail belongs in the website full report, while unsupported/stale/unavailable states remain visible in the extension.
- Maps are a secondary evidence-navigation view, not an impact-radius claim. Marker numbers follow ranking order, marker colors encode only documented stage, and missing coordinates never cause records to disappear from the list.

### 2026-10-17
- Use JavaScript ES modules initially to share server normalization with built-in Node tests and minimize tooling. This changes the prior TypeScript proposal without claiming a deployed backend.
- Retire the local extension report page in favor of one canonical website report.
- No free-use quota or paid credits in this increment. Public abuse protection is outstanding; don't present this as ready for an unrestricted paid launch.

## Contribution documentation
Read `AGENTS.md` and `agents_start.md` at the start of each contribution. Update this canonical design in place and complete `wrapup.md`, including README updates, before finishing. Preserve the distinction between implemented and proposed work.
