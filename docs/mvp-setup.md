# Home Area Reporter

ZIP-based research: What documented development, transit, public investment and parking activity is shaping this Seattle area?

Status: source inventory + extension scaffold. No live report backend, ingestion, payments or deployed website yet. Extension opens a local Seattle ZIP confirmation screen; data ingestion is not connected. No sample output is represented as verified live research.

## Product
- Thin Chrome extension on Redfin/Zillow, plus direct website URL/ZIP entry.
- Seattle-only permit coverage; a ZIP crossing city boundaries does not imply coverage outside Seattle.
- Free area brief first. Pro pricing: $10 single property report / $20 five-report bundle; guest checkout. Pricing does not imply all source categories are integrated.
- No comparison or favorites in MVP.

## Stack
Next.js + TypeScript on Vercel; Neon Postgres through Vercel Marketplace; ZIP-indexed records (no PostGIS needed initially); Inngest scheduled ingestion/durable research; transactional email and hosted payment later.

## Sources
See docs/free-sources.md and sources.json. Sources have independent access, reuse, geographic and freshness limits. A free public page is not automatically commercially reusable. Never turn missing source coverage into 'no changes'.

## Repository plan
GitHub repository: https://github.com/aarushi12002/home_area_reporter (public, created by the owner).

## Checks
Run `node --check extension/popup.js`, `node --check extension/report.js`, and `python scripts/probe_sources.py` to inspect current Seattle metadata. The probe does not store source records, secrets or personal information.

## First implementation
1. ZIP input and validation; no exact-distance claims.
2. Import building + land-use datasets; deduplicate related permits; filter cancelled, expired, completed and administrative records from upcoming-project results.
3. Current transit schedule context with required attribution; keep future rail project coverage explicitly unresolved.
4. Parking context only; policy-change detection waits for dated rules/announcements and reusable sources.
5. Evidence fields and source coverage on every report; deployment + tests; private beta before payments.

## Contribution documentation
Read `AGENTS.md` and `agents_start.md` at the start of each contribution. This file is the canonical system design: update accepted decisions and implemented-versus-planned status here in place. Complete `wrapup.md`, including README updates, before finishing. Avoid parallel design files.
