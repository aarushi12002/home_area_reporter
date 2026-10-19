# home_area_reporter

A Seattle ZIP-based research tool answering: **What documented changes are shaping this area?**

## Current status
Implemented: a runnable Next.js website, a local-Postgres/Neon-compatible persistence model, complete background ingestion for the initial ZIPs 98101–98105, canonical project construction, compact summary APIs and a Chrome extension that shows up to fifteen ranked highlights on Redfin or Zillow. Numbered maps show the listing and geocoded results in both the popup and detailed report. The full website report keeps pagination, source coverage and official evidence available on demand. If `DATABASE_URL` is absent or an area has not been ingested, the summary API uses a smaller live-source fallback.

Implemented but not deployed: committed PostgreSQL schema/migrations, idempotent source-record upserts, failed-refresh retention, daily Vercel Cron configuration, automatic listing ZIP/address/coordinate extraction where listing JSON-LD supplies it, distance-aware ranking and a repository-local PostgreSQL instance for development. A deployed Neon database and `CRON_SECRET` are still required before the scheduled route can run in production.

Not implemented: transit/parking/public-infrastructure connectors, verified construction-start data, accounts or email access, payment/credit limits, a durable job queue, public deployment, or broader Greater Seattle coverage. Inferred project grouping and ranking require ongoing review against real records.

## Run locally
For a clean laptop or a new Codex checkout, follow the canonical [fresh-machine setup guide](docs/fresh-machine-setup.md). It covers Homebrew prerequisites, PostgreSQL creation, environment configuration, ingestion, extension loading, restart and troubleshooting.

Requires Node.js 22+, npm and PostgreSQL 14+. Set `DATABASE_URL` in `.env.local`, install the repository hooks, then run:

```sh
npm ci
npm run hooks:install
npm run db:migrate
npm run db:ingest
npm run dev
```
Open http://localhost:3000 and enter 98101, 98102, 98103, 98104 or 98105. The checked-in database artifacts are `db/schema.mjs` and `drizzle/*.sql`; PostgreSQL data, `.env.local` and credentials are ignored. No API key is required for small public-data lookups; set the optional server-side `SOCRATA_APP_TOKEN` for higher API limits. Upstream availability and throttling still apply.

Maps default to OpenStreetMap tiles for low-volume local development. Before a public deployment, configure `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` for a production-capable provider and confirm its commercial terms, quotas, cache rules and required attribution. These values are browser-visible by design; restrict any provider token accordingly.

## Extension
1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select `extension/`.
3. Open a Redfin or Zillow listing and click the extension.
4. The extension attempts to detect listing ZIP, address and coordinates. Confirm a supported ZIP, keep `http://localhost:3000` under **Website connection**, then click **Check this area**.

The extension stores only the reporter origin in Chrome storage. Listing URL is never sent. Address and coordinates are used only in the current report URL/request and map and are not persisted. The compact map is served by the reporter website, so the extension does not load remote JavaScript. Normal source-coverage details are kept in the website's full report; the popup shows explicit errors only for unsupported, unavailable or invalid states.

## Validation
```sh
npm run docs:check
npm test
npm run build
node --check extension/popup.js
python scripts/probe_sources.py
```
The deterministic suite covers report evidence/filtering, explicit grouping, ZIP boundaries, unsafe links/origins, API status codes, cache expiry, concurrent request coalescing, outage recovery, pagination failures, malformed upstream responses, timeouts and extension handoff. Tests mock upstream APIs and need no credentials or live network.

GitHub Actions runs `npm ci`, all tests, extension syntax validation and the production build on pushes and pull requests using Node 22. Workflow success does not enforce merge protection; required status checks must be configured separately.

Live validation is separate: `python scripts/probe_sources.py` checks metadata, not report accuracy. Before releasing a connector or classification change, inspect real report evidence against official records, including empty, high-volume and source-failure cases. The report and compact map have been browser-smoke-tested locally, including rendered tiles, marker counts and paginated marker growth. Release checks must still cover loading/error/empty states, evidence links, print output and unpacked-extension behavior on both listing sites. Automated browser end-to-end coverage and a reviewed real-record fixture set remain outstanding; VM extension tests are not browser tests.

Local ingestion smoke check: all five initial ZIPs completed against both permit sources. The database stored complete active-source pagination rather than applying the old 1,000-record user-request ceiling. Source event dates can still be absent; undated and stale records remain available as evidence but are hidden from the primary view.

## MVP scope
- Initial service areas are 98101–98105. Listing coordinates improve ordering when supplied, but no complete-coverage or impact claim is made.
- Completed, cancelled, expired and administrative records are filtered. Explicit permit references are grouped first; high-similarity same-address descriptions may be grouped with recorded confidence. Other duplicates may remain; housing units use a per-project maximum rather than a sum.
- Current public records can include old or undated entries. Review their official source status before drawing conclusions.
- Pro pricing remains $10 per property / $20 for five, guest checkout; not implemented. Super Pro pricing remains undecided.
- Favorites and comparison are deferred.

## Deployment
Vercel: import this repository, keep **Root Directory at the repository root**, choose Next.js and use the package scripts. Provision Neon through Vercel Marketplace, set `DATABASE_URL`, `CRON_SECRET` and optional `SOCRATA_APP_TOKEN`, then run the migration before ingestion. `vercel.json` invokes the protected ingestion route daily at 08:17 UTC on production deployments.

Before public beta, provision the actual Neon project, test scheduled-function duration and concurrency, add public-endpoint abuse protection, and decide whether ingestion needs a durable queue rather than one scheduled function. No cloud database or Vercel project has been provisioned by this contribution.

## Design and data
- [Canonical system design and setup](docs/mvp-setup.md)
- [Free sources, licensing and coverage limits](docs/free-sources.md)
- [Source registry](sources.json)

## Agent workflow
Read [AGENTS.md](AGENTS.md) and [agents_start.md](agents_start.md) before editing; follow [wrapup.md](wrapup.md) before finishing. Extend existing files and keep README plus accepted design changes current.

## Next milestone
Manually review the top-ranked and hidden projects across 98101–98105, tune grouping/ranking against official records, then provision Neon and add construction-status, transit, infrastructure and parking connectors.
