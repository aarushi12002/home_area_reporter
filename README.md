# home_area_reporter

A Seattle ZIP-based research tool answering: **What documented changes are shaping this area?**

## Current status
Each supported ZIP has an **About this ZIP** section before the proposed-change snapshot: a short local-character summary and exact names of workplaces/institutions, transport options, groceries/shopping and medical care. Profiles cover 98101–98105 and use manually reviewed facts with official destination links. Outside-ZIP institutions are labeled **Nearby** with their postal code. These highlights are not copied from Redfin/Zillow and do not imply a complete directory, walking distance, hiring activity or live transit service. Profiles checked on 2026-10-21 expire on 2027-01-19 unless reviewed again.

Implemented: a runnable Next.js website, a local-Postgres/Neon-compatible persistence model, complete background ingestion for the initial ZIPs 98101–98105, canonical project construction, compact summary APIs and a Chrome extension that shows up to fifteen ranked highlights on Redfin or Zillow. Numbered maps show the listing and geocoded results in both the popup and detailed report. The full website report keeps pagination, source coverage and official evidence available on demand. If `DATABASE_URL` is absent or an area has not been ingested, the summary API uses a smaller live-source fallback.

The website snapshot first summarizes **What’s planned**, then **What it could mean**, with the **Projects in this ZIP** map alongside on wider screens and stacked underneath on mobile. A combined set of decision cards follows: homes/local activity, building height, shops/services, commercial space/reuse, on-site parking, demolition/site work and explicit building upgrades, shown only when records support them. **All**, **Buying / renting a home** and **Retail / commercial** controls tailor the cards and takeaways. Concrete plan counts and largest individual recorded values replace the repetitive density/economy score display; legacy score metadata remains in the API for compatibility. Example project links expand on demand, with no scoring-method/source-origin block. Individual project cards retain their city-record links. Housing additions are never summed into a neighborhood total or treated as net gains.

Unconnected factors are omitted from the free score grid and grouped in a blurred **Go deeper with Pro** preview, including future transit changes, zoning and prices/rents. It uses illustrative placeholders, not hidden data. **Upgrade to Pro** opens a coming-soon dialog with the planned $10 single-report / $20 five-report pricing. Additional connectors, paid reports, checkout and access enforcement remain unimplemented. The [free-source plan](docs/free-sources.md) records access, coverage, licensing checks and delivery order; planned sources are separate in `sources.json`.

The extension also shows up to four compact decision highlights above its project list; the website has the full audience views. Permit filtering now includes explicit business fit-outs/use changes and seismic/access/fire-system upgrades while continuing to exclude ordinary home maintenance and sign-only work. A fit-out is not a confirmed new business, vacancy or opening. Refresh database ingestion after pulling these eligibility changes; live fallback applies them immediately.

The free report now includes a toggleable **Bus routes** overlay from King County’s current Metro route layer, clipped to a ZIP-vicinity query window (not an exact postal boundary). **Parks & public improvements** combines qualifying permit descriptions with selected reviewed city-project facts for 98101, 98103 and 98104. Completion targets are shown only where explicitly published, with phase/program targets distinguished and past unconfirmed targets flagged. Permit issue, expiry and review dates are never completion estimates. These sections are not complete project inventories.

**Soundscore™** is part of the free report: select a point using **Pick noise location** on the map, then click **Check Soundscore**. The server adapter requires an optional `HOWLOUD_API_KEY` in `.env.local`; no real score is available until a partner key is configured. HowLoud’s published free plan permits fewer than 2,500 queries/month, single webpages and no caching; confirm the partner agreement for this application. The adapter uses no-store requests/responses, no persistence and no automatic/background score queries. A specific location is required; the report does not invent a ZIP-wide noise score. Provider-key production acceptance, durable quota/abuse controls and a real authorized response remain release work.

The public website is live at [home-area-reporter.vercel.app](https://home-area-reporter.vercel.app/). Home, privacy, report, map and summary/transit endpoints were verified on October 22, 2026. The 98103 report uses the live-source fallback with partial coverage; cloud database ingestion and scheduled refresh have not been verified. Committed PostgreSQL migrations, idempotent upserts, failed-refresh retention and daily Vercel Cron configuration are available. A deployed Neon database and `CRON_SECRET` are required for scheduled ingestion.

Not implemented: live transit arrivals, future-service detection, parking feeds, a complete public-capital-project connector, verified construction-start data, accounts or email access, payment/credit limits, a durable job queue, or broader Greater Seattle coverage. Inferred project grouping and ranking require ongoing review against real records.

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

The extension stores only the reporter origin in Chrome storage. Listing URL is never sent. Listing-location sharing defaults off. When enabled, address/coordinates are used in the current report URL/request and map, without application-database or extension-storage persistence; browser history and hosting-provider logs can retain request URLs. Extension-context JavaScript is packaged locally; a same-origin website iframe renders the map separately. Normal source-coverage details are kept in the website's full report; the popup shows explicit errors only for unsupported, unavailable or invalid states.

Release preparation is implemented for extension **0.4.0**: PNG icons, explicit listing-location opt-in, a `/privacy` page, store-listing/permission-disclosure text and a production packager. After the backend is deployed and verified, run `npm run extension:package -- --origin=https://your-production-host`. The generated ZIP pins host access and map frames to that origin, hides the development origin control and contains only the eight extension runtime/icon files. It is written under ignored `.local/releases/`; no credentials or development files are included. Python 3 is required for ZIP packaging/tests.

Chrome extension 0.4.0 is uploaded as draft `gkcknhnphkocdbelbeggbeofcgkhdbmh`, pinned to the verified Vercel origin. Listing copy, two production screenshots, icon, permission/data disclosures and reviewer instructions are saved. Publisher registration and the owner’s trader declaration are complete; Google still requires a verified public contact email before review submission. No public store listing exists yet. Store copy lives in `extension/store-listing.json`, and packaging is owned by `scripts/package-extension.mjs`.

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
Complete this checkout's database setup and full permit ingestion, review grouping/ranking across 98101–98105, then add transit-service/alert context and zoning before historical FHFA/ACS market context. Follow the [source plan](docs/free-sources.md) for validation and remaining infrastructure, parking and view-analysis gaps.

## Tracked follow-ups
- [#1 Vercel deployment](https://github.com/aarushi12002/home_area_reporter/issues/1)
- [#2 Homepage headline and conversion](https://github.com/aarushi12002/home_area_reporter/issues/2)
- [#3 Google Analytics](https://github.com/aarushi12002/home_area_reporter/issues/3)
- [#4 Marketing drafts for Reddit, X and forums](https://github.com/aarushi12002/home_area_reporter/issues/4)
