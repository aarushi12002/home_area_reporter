# home_area_reporter

ZIP-based neighborhood research combining **Seattle development reports** with **national Census snapshots**.

## Current status
Each supported ZIP has an **About this ZIP** section before the proposed-change snapshot: a short local-character summary and exact names of workplaces/institutions, transport options, groceries/shopping and medical care. Profiles cover the 31 reviewed city-intersecting areas in [the coverage registry](data/service-areas.json), using selected facts checked against official destination pages. Outside-ZIP institutions are labeled **Nearby** with their postal code. These highlights are not copied from Redfin/Zillow and do not imply a complete directory, walking distance, hiring activity or live transit service. The original five profiles expire on 2027-01-19; the 26 additions reviewed on 2026-10-24 expire on 2027-01-22. Each profile carries its own dates.

Implemented: a runnable Next.js website, a local-Postgres/Neon-compatible persistence model, citywide batch ingestion for 31 reviewed Seattle areas, canonical project construction, compact summary APIs and a Chrome extension that shows up to fifteen ranked highlights on Redfin or Zillow. Numbered maps show the listing and geocoded results in both the popup and detailed report. The full website report keeps pagination, source coverage and official evidence available on demand. Production serves stored snapshots; reports are prepared outside visitor requests. Only the original five ZIPs retain a database-free live preview in non-production development. New areas require two complete refreshes and reviewed context before becoming available.

The website snapshot first summarizes **What’s planned**, then **What it could mean**, using up to two named local standouts selected from all current eligible projects before the highlight cap. The story pairs the highest-ranked permit project with one current reviewed public improvement when available, otherwise preferring a different permit category. It names the location, work and stage rather than always reporting the largest apartment plan. Existing-business alterations stay distinct from use changes and unconfirmed openings. The two rows are capped at 45/35 words; expired references and elapsed unconfirmed targets are excluded. Candidates are prepared in the background, and older snapshots retain their previous text until refreshed. The **Projects in this ZIP** map appears alongside on wider screens and below on mobile. A combined set of decision cards follows: homes/local activity, building height, shops/services, commercial space/reuse, on-site parking, demolition/site work and explicit building upgrades, shown only when records support them. **All**, **Buying / renting a home** and **Retail / commercial** controls tailor the cards and takeaways. Concrete plan counts and largest individual recorded values replace the repetitive density/economy score display; legacy score metadata remains in the API for compatibility. Example project links expand on demand, with no scoring-method/source-origin block. Individual project cards retain their city-record links. Housing additions are never summed into a neighborhood total or treated as net gains.

Unconnected factors are omitted from the free score grid and grouped in a blurred **Go deeper with Pro** preview, including future transit changes, zoning and prices/rents. It uses illustrative placeholders, not hidden data. **Upgrade to Pro** opens a coming-soon dialog with the planned $10 single-report / $20 five-report pricing. Additional connectors, paid reports, checkout and access enforcement remain unimplemented. The [free-source plan](docs/free-sources.md) records access, coverage, licensing checks and delivery order; planned sources are separate in `sources.json`.

The extension also shows up to four compact decision highlights above its project list; the website has the full audience views. Permit filtering now includes explicit business fit-outs/use changes and seismic/access/fire-system upgrades while continuing to exclude ordinary home maintenance and sign-only work. A fit-out is not a confirmed new business, vacancy or opening. Refresh database ingestion after pulling these eligibility changes; live fallback applies them immediately.

The free report now includes a toggleable **Bus routes** overlay from King County’s current Metro route layer, clipped to a ZIP-vicinity query window (not an exact postal boundary). **Parks & public improvements** combines qualifying permit descriptions with selected reviewed city-project facts, including West Seattle, Lake City, Bitter Lake and Magnolia additions. Completion targets are shown only where explicitly published, with phase/program targets distinguished and past unconfirmed targets flagged. Permit issue, expiry and review dates are never completion estimates. These sections are not complete project inventories.

**Soundscore™** is part of the free report: select a point using **Pick noise location** on the map, then click **Check Soundscore**. The server adapter requires an optional `HOWLOUD_API_KEY` in `.env.local`; no real score is available until a partner key is configured. HowLoud’s published free plan permits fewer than 2,500 queries/month, single webpages and no caching; confirm the partner agreement for this application. The adapter uses no-store requests/responses, no persistence and no automatic/background score queries. A specific location is required; the report does not invent a ZIP-wide noise score. Provider-key production acceptance, durable quota/abuse controls and a real authorized response remain release work.

The public website is live at [home-area-reporter.vercel.app](https://home-area-reporter.vercel.app/). A free Neon database is now linked to the production project and the batch schema has been migrated. Two full production refreshes have enabled all 31 reviewed areas in the database. The deployed API has verified all 31 ready reports. Both the manual production refresh and the [first automatic GitHub Actions refresh](https://github.com/aarushi12002/home_area_reporter/actions/runs/40196449759) passed. The October 25 automatic run started at 13:11 UTC and completed at 13:14 UTC; all 31 published areas were ready afterward. The canonical design records acceptance evidence and remaining performance limits. The website/extension use `/api/service-areas` and stored report readiness, with explicit preparing/unsupported/stale responses.

Batches fetch each of the two permit feeds once, validate source counts before/after pagination, quarantine invalid geography, and publish each ZIP atomically. Failed sources/publication preserve the last report. Database leases prevent overlapping writers. Indexed SQL pagination returns 20 projects by default, at most 50, with a generation-bound cursor; report updates return `409 REPORT_UPDATED` and reload the list. Summaries contain 15 highlights; maps cap project markers at 100. Credentials and listing context never enter report snapshots.

The daily GitHub workflow is `.github/workflows/ingest.yml` (08:17 UTC), with manual region/ZIP inputs and encrypted `DATABASE_URL`/optional `SOCRATA_APP_TOKEN` secrets. Its manual dispatch and first scheduled production run passed, and the older Vercel cron has been removed. The first scheduled run started about 4 hours 54 minutes after the configured time, so 08:17 UTC is not a guaranteed publication deadline. GitHub schedules can be delayed or disabled after 60 inactive days; use `npm run db:status` to inspect freshness, failures and storage. The default storage allowance is 1,000,000,000 bytes; confirm it with the provider and pause expansion at 80%. This estimates database size, not provider compute/transfer billing.

National Census context is live for **33,772 ZCTAs** from the 2024 ACS five-year release (2020–2024). Outside connected permit areas, the website and extension serve a separate historical neighborhood snapshot. Refresh through the bulk ACS importer: `npm run db:baseline -- --vintage=2024`, requiring an activated, server-only `CENSUS_API_KEY`. It stores population, housing, tenure, historical gross rent and commuting estimates with margins of error and Census annotations, preserving capped medians such as “$3,500+”. Sensitive Vercel keys must be used inside a production build/runtime rather than pulled locally; the setup guide documents the one-time import build. It does not enable local permit coverage, imply current rents or turn ZCTAs into exact postal boundaries. After key activation, the October 24 production import accepted and stored all 33,772 returned rows; 2,577 preserve leading-zero geography codes. Data quality checks found no malformed codes, missing metric groups or negative sentinel values in stored estimates/MOEs. The database was approximately 154 MB after import; all 31 Seattle permit areas remained ready. Greater Seattle adapters and Overture Places publication remain separate expansion work; a bounded 4,192-place sample has been checked for schema, closed records and duplicates; The national statistical baseline is operational; useful verified paid content and entitlement/checkout remain prerequisites for paid reporting.

Not implemented: live transit arrivals, future-service detection, parking feeds, a complete public-capital-project connector, verified construction-start data, accounts or email access, payment/credit limits, a separate queue service, or broader Greater Seattle permit coverage. Inferred project grouping and ranking require ongoing review against real records.

## MCP access

The MCP display name is **Home Area Reporter for Redfin & Zillow**. It describes an independent companion for home searches; the endpoint and tool identifiers stay unchanged.

A public, read-only MCP adapter is deployed at [the MCP endpoint](https://home-area-reporter.vercel.app/mcp), controlled by `MCP_ENABLED` (off by default in new environments). It reuses stored reports through four tools: `list_supported_zipcodes`, `get_zip_summary`, `list_projects` and `get_project`. ZIPs remain five-character strings, including leading zeros. Coverage lookup without a ZIP enumerates reviewed Seattle project areas; an individual ZIP lookup can also resolve an imported national Census baseline. Baseline-only areas explicitly have no connected local-project coverage.

Run `npm run db:migrate` to apply `0003_mcp_rate_limits.sql`, configure a private random `MCP_RATE_LIMIT_SECRET` of at least 32 characters, and set `MCP_ENABLED=true` only after acceptance. `MCP_ALLOWED_ORIGINS` contains exact comma-separated browser origins; server-to-server clients can omit Origin. Requests are limited across instances through PostgreSQL counters (60/minute per hashed connection IP and 300/minute globally); counters expire after an hour and are purged on the next MCP request. Production requires Vercel's trusted client-IP headers. See the [setup guide](docs/fresh-machine-setup.md) for local testing and the ChatGPT connection.

The pinned MCP SDK v2 supports modern `2026-07-28` and stateless `2025-11-25` clients. Tool results preserve publication/generation, evidence and unavailable states; lists default to 20 projects, maximum 50. No MCP call starts permit ingestion, queries Soundscore, accepts a listing location or sends Analytics events. Production migration/configuration, SDK calls for all four tools and strict Inspector validation passed on October 25, 2026. The installed personal ChatGPT plugin returned a three-point 98109 report with the website and official evidence links in **Work mode**. Regular Chat mode showed a response-loading error and is not verified. All 90 tests passed with real PostgreSQL; production build and extension syntax checks passed. Public-directory submission, paid access and deep-research `search`/`fetch` integration remain separate work. [Issue #7](https://github.com/aarushi12002/home_area_reporter/issues/7) tracks acceptance.

## Run locally
For a clean laptop or a new Codex checkout, follow the canonical [fresh-machine setup guide](docs/fresh-machine-setup.md). It covers Homebrew prerequisites, PostgreSQL creation, environment configuration, ingestion, extension loading, restart and troubleshooting.

Requires Node.js 22+, npm and PostgreSQL 14+. Set `DATABASE_URL` in `.env.local`, install the repository hooks, then run:

```sh
npm ci
npm run hooks:install
npm run db:migrate
npm run db:ingest
npm run db:ingest
npm run db:status
npm run dev
```
Open http://localhost:3000 and enter a ready Seattle ZIP, such as 98103 or 98109. The two ingestion runs establish the initial release gate. The checked-in database artifacts are `db/schema.mjs` and `drizzle/*.sql`; PostgreSQL data, `.env.local` and credentials are ignored. No API key is required for small public-data lookups; set the optional server-side `SOCRATA_APP_TOKEN` for higher API limits. Upstream availability and throttling still apply.

Maps default to OpenStreetMap tiles for low-volume local development. Before a public deployment, configure `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` for a production-capable provider and confirm its commercial terms, quotas, cache rules and required attribution. These values are browser-visible by design; restrict any provider token accordingly.

## Extension
1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select `extension/`.
3. Open a Redfin or Zillow listing and click the extension.
4. The extension attempts to detect listing ZIP, address and coordinates. Confirm a supported ZIP, keep `http://localhost:3000` under **Website connection**, then click **Check this area**.

The extension stores only the reporter origin in Chrome storage. Listing URL is never sent. Listing-location sharing defaults off. When enabled, address/coordinates are used in the current report URL/request and map, without application-database or extension-storage persistence; browser history and hosting-provider logs can retain request URLs. Extension-context JavaScript is packaged locally; a same-origin website iframe renders the map separately. Normal source-coverage details are kept in the website's full report; the popup shows explicit errors only for unsupported, unavailable or invalid states.

Release preparation is implemented for extension **0.5.0**: PNG icons, explicit listing-location opt-in, a `/privacy` page, store-listing/permission-disclosure text and a production packager. After the backend is deployed and verified, run `npm run extension:package -- --origin=https://your-production-host`. The generated ZIP pins host access and map frames to that origin, hides the development origin control and contains only the eight extension runtime/icon files. It is written under ignored `.local/releases/`; no credentials or development files are included. Python 3 is required for ZIP packaging/tests.

Chrome extension 0.4.0 (`gkcknhnphkocdbelbeggbeofcgkhdbmh`) was submitted on October 22, 2026 and is **pending Google review**, with automatic publication enabled after approval. It is pinned to the verified Vercel origin. Listing copy, two production screenshots, icon, permission/data disclosures and reviewer instructions are saved. Publisher registration, the owner’s trader declaration and contact-email verification are complete. The extension is not yet publicly installable; approval and publication remain pending. Store copy lives in `extension/store-listing.json`, and packaging is owned by `scripts/package-extension.mjs`.

## Website analytics

Google Analytics 4 is implemented for the top-level production website with visitor opt-in. The dedicated Home Area Reporter property is `560464819`, stream `16186613747`, public Measurement ID `G-4R4PJRD22N`. `lib/analytics.mjs` holds that public default; `NEXT_PUBLIC_GA_MEASUREMENT_ID` overrides it and `NEXT_PUBLIC_GA_ENABLED=false` disables collection. These are build-time public settings, not secrets; redeploy after changing them. The `.env.example` explicitly disables analytics for new local setups. Local development, preview hosts, extension popups and embedded maps do not send analytics.

The tag stays blocked until **Allow analytics**. **No thanks** keeps it blocked; **Analytics preferences** can withdraw permission, clear this site's `_ga` cookies and reload to unload the tag. Events: `page_view`, `zip_search`, `report_loaded`, `audience_selected`, `full_report_opened`, `pro_interest`. Only fixed page names/actions, a coarse five-digit ZIP and categorical coverage/audience values are sent. Listing addresses/coordinates/URLs, query strings, raw referrers and document titles are excluded. Advertising consent stays denied, Google Signals/personalization are disabled, and no install/purchase event exists before those actions ship. Acquisition attribution is intentionally limited by omitting query strings and referrers.

GA4 stream Enhanced Measurement is **off**; keep it off to avoid duplicate/history events and unwanted URL/form collection. Additional redaction covers `address`, `lat`, `lng`, `zip`, `url`, `listing_url`, `email`. Production consent behavior and event receipt were verified in GA4 Realtime on October 23, 2026. Event-scoped ZIP, audience and coverage dimensions are registered. The public privacy policy describes cookies, Google processing and choices. [Issue #3](https://github.com/aarushi12002/home_area_reporter/issues/3) tracks activation/verification.

Seattle-wide batch implementation and release verification are tracked in [issue #6](https://github.com/aarushi12002/home_area_reporter/issues/6) and the [canonical design](docs/mvp-setup.md): reviewed ZIP/jurisdiction coverage, resumable background ingestion, current Postgres report snapshots with generation identifiers, indexed detail pagination and bounded map rendering. The registry contains 31 areas; actual release readiness comes from database publication, not a ZIP regex.

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

Live acceptance retest (2026-10-25): 83 tests passed with real PostgreSQL, plus production API/browser checks for Seattle and national reports, ZIP validation, private caching, audience views, transit toggling, Pro availability, pagination and mobile layouts. One open map usability issue: markers overlap at the ZIP overview, so a pointer click can select a neighboring project. Zooming in or keyboard selection works; see the canonical verification section and issue #6.

Local ingestion smoke check (2026-10-24): both citywide feeds completed twice and all 31 areas passed the local release gate; 3,027 visible projects were materialized. This is separate from production verification. The database stored complete active-source pagination rather than applying the old 1,000-record user-request ceiling. Source event dates can still be absent; undated and stale records remain available as evidence but are hidden from the primary view.

## MVP scope
- Reviewed Seattle coverage is defined by `data/service-areas.json`; new areas require two complete refreshes and current context. Listing coordinates improve ordering when supplied, but no complete-coverage or impact claim is made.
- Completed, cancelled, expired and administrative records are filtered. Explicit permit references are grouped first; high-similarity same-address descriptions may be grouped with recorded confidence. Other duplicates may remain; housing units use a per-project maximum rather than a sum.
- Current public records can include old or undated entries. Review their official source status before drawing conclusions.
- Pro pricing remains $10 per property / $20 for five, guest checkout; not implemented. Super Pro pricing remains undecided.
- Favorites and comparison are deferred.

## Deployment
Vercel: keep **Root Directory at the repository root**, use Next.js/package scripts and link Neon through Marketplace. Set `DATABASE_URL` in Vercel Production and GitHub Actions secrets, then migrate before backfill. The configured `home-area-reporter-db` is Neon Free; credentials remain private provider settings. `CRON_SECRET` is only for the legacy administrative endpoint.

The daily Actions workflow replaces the old Vercel cron after a successful production dispatch. Database leases, retries and atomic snapshots provide recovery; no separate queue vendor is required for this release. Production acceptance and the current verified state are recorded in the canonical design.

## Design and data
- [Canonical system design and setup](docs/mvp-setup.md)
- [Free sources, licensing and coverage limits](docs/free-sources.md)
- [Source registry](sources.json)

## Agent workflow
Read [AGENTS.md](AGENTS.md) and [agents_start.md](agents_start.md) before editing; follow [wrapup.md](wrapup.md) before finishing. Extend existing files and keep README plus accepted design changes current.

## Next milestone
Resolve the public load-test protection/performance limit, then pilot Bellevue and maintain the national ACS baseline with reviewed release-vintage updates. Complete category/status/deduplication checks before named-destination import; paid reporting waits for national baseline readiness and useful verified paid content. Follow the [source plan](docs/free-sources.md) for validation and remaining infrastructure, parking and view-analysis gaps.

## Tracked follow-ups
- [#1 Vercel deployment](https://github.com/aarushi12002/home_area_reporter/issues/1)
- [#2 Homepage headline and conversion](https://github.com/aarushi12002/home_area_reporter/issues/2)
- [#3 Google Analytics](https://github.com/aarushi12002/home_area_reporter/issues/3)
- [#4 Marketing drafts for Reddit, X and forums](https://github.com/aarushi12002/home_area_reporter/issues/4)
- [#6 Seattle-wide ZIP coverage, storage and rendering](https://github.com/aarushi12002/home_area_reporter/issues/6)
