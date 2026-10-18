# Home Area Reporter

ZIP-based research: What documented development, transit, public investment and parking activity is shaping this Seattle area?

Status: working Next.js website and live on-demand permit API report plus extension handoff. Neon, ingestion schedules, durable jobs, transit/parking/infrastructure connectors, payments and deployment remain planned. Reports display live source records and coverage gaps, not fabricated findings.

## Product
- Thin Chrome extension on Redfin/Zillow, plus direct website URL/ZIP entry.
- Seattle-only permit coverage; a ZIP crossing city boundaries does not imply coverage outside Seattle.
- Free area brief first. Pro pricing: $10 single property report / $20 five-report bundle; guest checkout. Pricing does not imply all source categories are integrated.
- No comparison or favorites in MVP.

## Stack
Implemented: Next.js App Router + JavaScript/ES modules, React, CSS, server-only Socrata adapters and Node tests. TypeScript is deferred for this small first slice; migration can follow as contracts grow. Proposed hosting remains Vercel, with Neon Postgres via Marketplace and Inngest scheduled ingestion/durable research next. ZIP-indexed records need no PostGIS initially. Email and hosted payment remain later work.

## Sources
See docs/free-sources.md and sources.json. Sources have independent access, reuse, geographic and freshness limits. A free public page is not automatically commercially reusable. Never turn missing source coverage into 'no changes'.

## Repository plan
GitHub repository: https://github.com/aarushi12002/home_area_reporter (public, created by the owner).

## Checks
Run `npm test`, `npm run build`, `node --check extension/popup.js`, and optionally `python scripts/probe_sources.py`. The probe requires internet and only inspects source metadata. See README for local run and Vercel root-directory instructions.

Implemented testing layers: deterministic Node tests for normalization, adapter failure/pagination/deadline behavior, the real API handler with mocked upstream fetches (including cache TTL, in-flight sharing and recovery), and VM-based extension handoff checks. GitHub Actions runs tests, extension syntax and a production build on push/PR with Node 22; no live APIs or credentials are required. The workflow supplies checks, not branch protection.

Release validation still required: browser report/extension journeys and print/mobile layouts, plus a manually reviewed official-record fixture set to evaluate relevance and omissions. Metadata probes and live HTTP smoke checks establish availability only. They do not establish complete coverage, factual interpretation or forecast quality. Browser end-to-end automation remains planned.

## First implementation
1. Implemented: website/extension ZIP input and validation; no exact-distance claims.
2. Implemented: on-demand building + land-use API lookup, explicit permit grouping and filtering. Durable import/persistence remains next. Never imply permit issuance establishes construction started.
3. Current transit schedule context with required attribution; keep future rail project coverage explicitly unresolved.
4. Parking context only; policy-change detection waits for dated rules/announcements and reusable sources.
5. Evidence fields and source coverage on every report; deployment + tests; private beta before payments.

## Current request flow
1. Direct website `/` accepts a five-digit Seattle-area ZIP beginning with 98. This is format validation, not proof the ZIP is covered.
2. Extension opens `/report?zip=...` on the selected website origin. ZIP entry is manual; no listing DOM scraping. No local extension report copy remains.
3. The report client requests `GET /api/report?zip=...`. Server uses only fixed official dataset endpoints and selected fields; no arbitrary user URL fetches.
4. Both sources execute concurrently with an 18-second deadline each, stable ordered pagination (250 rows/page, maximum four pages/source). Reaching the cap marks coverage limited. Mid-fetch failure retains retrieved rows but marks that source failed.
5. Server filters closed/cancelled/expired/completed/administrative work; groups only explicit parent/MUP relations; sorts available source-event dates descending, then undated records. UI shows 20 records at a time with an expand action.
6. Report state is ready, partial or unavailable. If both sources fail, HTTP 503 includes coverage details. Missing/unsupported ZIPs do not become definitive no-development findings.
7. Short cache: ready results only, 15 minutes, bounded at 100 ZIP entries per runtime instance. In-flight requests are coalesced per instance. This is NOT persistent, distributed, scheduled or a rate limiter.
8. Printing uses the browser's print/save-PDF action. Sources remain online links; there is no server PDF or email delivery.

## Evidence and model boundaries
No LLM is used. Official descriptions and original status are shown with conservative stage labels. Available source dates are event dates, not update dates; retrieval timestamps are separate. No price forecast, inferred growth score or automatic proximity/impact conclusion. Unit counts remain per record, not summed across permits. The report explicitly lists disconnected source categories and coverage limits.

## Accepted implementation decisions — 2026-10-17
- Build the first live on-demand permit slice before provisioning persistence. This enables source and UX validation; Neon + background ingestion remain required next for a scalable beta.
- Use JavaScript ES modules initially to share server normalization with built-in Node tests and minimize tooling. This changes the prior TypeScript proposal without claiming a deployed backend.
- Retire the local extension report page in favor of one canonical website report.
- No free-use quota or paid credits in this increment. Public abuse protection is outstanding; don't present this as ready for an unrestricted paid launch.

## Contribution documentation
Read `AGENTS.md` and `agents_start.md` at the start of each contribution. Update this canonical design in place and complete `wrapup.md`, including README updates, before finishing. Preserve the distinction between implemented and proposed work.
