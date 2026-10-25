# Fresh laptop setup

This is the canonical setup guide for a new contributor or a new Codex checkout. It assumes macOS, Chrome, GitHub repository access and a local PostgreSQL database. Do not commit `.env.local`, database files, API tokens or browser data.

## 1. Prerequisites

- Git and GitHub CLI authenticated for `aarushi12002/home_area_reporter`.
- Node.js 22 or newer and npm.
- Python 3 for release ZIP packaging and the deterministic package tests.
- PostgreSQL 14 or newer.
- Google Chrome for the unpacked extension.

Homebrew is the simplest macOS installation path:

```sh
brew install node@22 postgresql@14 gh python
gh auth status
node --version
npm --version
```

Both Apple Silicon and Intel Homebrew installations are supported because the commands below use `brew --prefix` instead of a hard-coded `/opt/homebrew` or `/usr/local` path.

## 2. Checkout and install

For a new checkout:

```sh
gh repo clone aarushi12002/home_area_reporter
cd home_area_reporter
npm ci
npm run hooks:install
cp .env.example .env.local
```

For an existing clean checkout, run `git pull --ff-only` followed by `npm ci`. Read `AGENTS.md`, `agents_start.md`, `README.md` and `docs/mvp-setup.md` before changing the project.

The hook installer sets this checkout's local `core.hooksPath` to the committed `.githooks` directory. It does not change global Git configuration. The post-commit hook reports drift immediately, the pre-push hook blocks an inconsistent push, and CI runs the same `npm run docs:check` command. A post-commit hook alone cannot undo a commit that already exists.

## 3. Local PostgreSQL

Start PostgreSQL and create the development database:

```sh
brew services start postgresql@14
PG_BIN="$(brew --prefix postgresql@14)/bin"
"$PG_BIN/psql" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'home_area_reporter'" | grep -q 1 || "$PG_BIN/createdb" home_area_reporter
```

The default `.env.example` connection is:

```dotenv
DATABASE_URL=postgresql://localhost/home_area_reporter
```

`SOCRATA_APP_TOKEN` is optional for local use and must remain server-side. `CRON_SECRET` is only needed for deployed scheduled ingestion. `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` may stay empty for low-volume local development; configure a production-capable tile provider before deployment. Variables beginning with `NEXT_PUBLIC_` are browser-visible and must not contain secret credentials.

To use Neon instead of local PostgreSQL, place its pooled connection string in `DATABASE_URL` and skip the Homebrew database creation. Never commit that connection string.

Optional website analytics: `NEXT_PUBLIC_GA_MEASUREMENT_ID` overrides the configured public default `G-4R4PJRD22N`; `NEXT_PUBLIC_GA_ENABLED=false` disables collection. Copying `.env.example` leaves analytics disabled. With no override, production uses the dedicated stream only on `https://home-area-reporter.vercel.app`, after visitor opt-in. Variables are embedded at build time: rebuild/redeploy after edits. Localhost, preview hosts, extension popups and embedded maps are excluded even if the flag is enabled. Never put an Analytics API secret or account credential into these public variables.

Before changing the GA4 stream, keep **Enhanced Measurement off** (including history pageviews, form interactions and outbound URLs); `send_page_view:false` alone does not disable history-based enhanced events. The current dedicated property is `560464819`, stream `16186613747`. Seven URL keys have extra redaction: `address`, `lat`, `lng`, `zip`, `url`, `listing_url`, `email`. In production, check that no Google tag loads before **Allow analytics**, **No thanks** keeps it absent, and **Analytics preferences** can withdraw consent and reload. Production receipt and reject/allow/withdraw behavior were verified on October 23, 2026; repeat those checks when changing the tag. Use synthetic values to test an address/coordinate-bearing report URL without sending those values. See README for the event list and canonical design for payload boundaries. Chrome-install/purchase events remain future work.

## 4. Schema and initial data

Apply the committed migrations and ingest every reviewed Seattle area in [the registry](../data/service-areas.json). The original five preview ZIPs are 98101 through 98105; production coverage now depends on stored readiness:

```sh
npm run db:migrate
npm run db:ingest
npm run db:ingest
npm run db:status
```

Each batch downloads both citywide feeds once, then partitions and publishes selected ZIPs. Two successful refreshes plus current neighborhood/transit references enable a new ZIP. A failed/truncated source or failed transaction preserves the prior report. Invalid ZIP/geometry rows are quarantined for 24 hours. Ingestion requires internet access and can take several minutes. To refresh one area later, use:

```sh
npm run db:ingest -- --zips=98103
```

### Background production refresh and national imports

Set `DATABASE_URL` as a Vercel Production variable and as an encrypted GitHub Actions repository secret; never commit it. Set optional `SOCRATA_APP_TOKEN` in both environments if used. `.github/workflows/ingest.yml` runs daily at 08:17 UTC; dispatch it manually first, using region `seattle` and optional comma-separated ZIPs. Other regions are rejected until an adapter is verified. The production manual dispatch passed on October 24, and the [first automatic run](https://github.com/aarushi12002/home_area_reporter/actions/runs/40196449759) passed on October 25 (13:11–13:14 UTC), with all 31 areas ready afterward. Its start was about 4 hours 54 minutes later than the configured trigger, so do not rely on an exact publication time. The legacy Vercel cron is removed. `CRON_SECRET` protects the legacy `/api/internal/ingest` endpoint; it is not needed by the Actions worker.

`DATABASE_STORAGE_LIMIT_BYTES` defaults to 1000000000. Confirm the account allowance; the batch pauses at 80%. Use `npm run db:status` for readiness, last publication, batch failures and database size. Provider compute/transfer remain separate account checks. Recover delayed/disabled GitHub schedules through manual dispatch; public-repository schedules may be disabled after 60 days without activity.

For optional national ACS context, register/activate a free `CENSUS_API_KEY`, keep it server-side, then run `npm run db:baseline -- --vintage=2024`. Vercel Sensitive variables cannot be pulled: `[SENSITIVE]` is a placeholder, not evidence of a bad Census key. Use an independently configured local key or the one-time production import build below, keeping the production key protected. Imports validate the complete response and publish in a transaction. Preserve observation period, ZCTA geography, suppressed values and margins of error. This is historical context, not local permit coverage or current property pricing. No key is needed for Seattle permits. Future Overture Places and regional source connectors must pass source/terms/quality checks before activation.

## 5. Run the website

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and test ZIP `98103`. Keep this terminal running while using the extension. The website snapshot first describes **What’s planned**, then **What it could mean**. Supported factors appear as grouped decision cards with concrete counts/largest single-plan values and icons. Test **All**, **Buying / renting a home** and **Retail / commercial** to change the cards and takeaways; unconnected topics move into the blurred Pro preview. The snapshot omits scoring-method and data-origin explanations; individual project cards retain their city-record links. Check the **Upgrade to Pro** dialog: these additional topics and checkout are coming soon, not currently unlockable. The **Projects in this ZIP** map sits beside the planned-change summary above 650px and stacks below it on smaller screens. Decision cards and stage counts follow, with project cards under **Project details**; **Open full report** loads paginated evidence. A partial live response displays its warning alongside the assessment. If the live lookup is truncated, use the existing complete database ingestion rather than suppressing the warning. The future source/access plan is in [free-sources.md](free-sources.md); no additional provider keys are needed for today's permit-only report.

Above the snapshot, verify **About this ZIP**: for 98103, expect Adobe/Brooks Running, Metro Route 40/RapidRide E Line, PCC and Fremont Sunday Market. All 31 reviewed city-intersecting areas have profiles; availability still requires database publication. Check 98102 and 98105 for explicit Nearby labels on Fred Hutch (98109) and UW's Seattle campus (98195). Names link to official pages, with no additional provider key. The original directory in `lib/zip-profile.mjs` is valid from 2026-10-21 until 2027-01-19; the 26 entries in `data/zip-profiles.json` are valid from 2026-10-24 until 2027-01-22; review and refresh its facts/dates before expiry, otherwise it is hidden. These are selected area highlights, not property-specific distances or a live transit/business feed.

Verify the **Bus routes** toggle on the map: purple route lines appear around the ZIP with King County attribution; a source failure leaves project markers usable and offers retry. This overlay is route geography, not live arrival times or future service changes. **Parks & public improvements** shows selected reviewed city projects, with additions for West Seattle, Lake City, Bitter Lake and Magnolia, plus qualifying civic permits. September 2026 is a past, unconfirmed target for Lower Woodland Playfield #1; the Ship Canal 2027 target is program-wide, and Hing Hay’s October 2026 target covers Phase I only. Medical care is a fourth **About this ZIP** group; outside-ZIP facilities remain labeled Nearby.

Optional noise integration: obtain a HowLoud partner key and put `HOWLOUD_API_KEY` in `.env.local`, then restart the server. The free plan has fewer than 2,500 queries/month, single webpages and no caching. Keep the key server-side and confirm account-specific terms. Use **Pick noise location**, click a map location, then **Check Soundscore**; no automatic provider lookup is made. A missing key displays a connection-pending message, never a fabricated score or Pro paywall. No key has been provisioned or paid plan purchased by this contribution.

The decision cards combine housing and local activity and add building height, shop/service plans, commercial space/use changes, on-site parking, demolition/site work and explicit seismic/access/fire-system upgrades. Cards without evidence stay hidden. **Example projects** expands supporting addresses and statuses. Counts are matching canonical projects in the available search, not confirmed business openings or complete area totals. Parking values refer to one plan, never street supply. Commercial fit-outs do not prove space is vacant or leasable. If this checkout uses a database, rerun `npm run db:ingest` after updating the expanded permit filters; the live fallback applies them without a migration.

## 6. Load the Chrome extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this checkout's `extension` directory.
4. Pin **Home Area Reporter**.
5. Open a Redfin or Zillow listing in ZIP 98101, 98102, 98103, 98104 or 98105.
6. Open the extension, keep **Website connection** set to `http://localhost:3000`, and choose **Check this area**.
7. Confirm that up to four compact decision highlights, fifteen project cards, fifteen numbered map markers, the listing marker when listing-location sharing is enabled and coordinates are available, and zoom controls appear.

After pulling extension changes, return to `chrome://extensions` and click **Reload** on the extension card.

Current extension manifest version: `0.5.0`.

Listing-location sharing is off by default. Turn on **Include the listing location for nearby results** only when you want coordinates/address included in report requests/links. The popup links to `/privacy`. Verify ZIP-only requests contain no `lat`, `lng` or address, and confirm opting in restores location-aware behavior.

For a store build, first verify the deployed HTTPS origin, then run:

```sh
npm run extension:package -- --origin=https://your-production-host
```

Use the actual verified origin, not this placeholder. The script writes the ZIP, unpacked release directory and resolved store listing under ignored `.local/releases/home-area-reporter-0.5.0/`. Use `--out=/absolute/new/path` for a subsequent build; it refuses an existing bundle. It copies only the manifest, popup HTML/JS/CSS and four PNG icons. Release host/frame permissions reference only the chosen origin, and saved localhost preferences cannot override the hidden production origin. The source `extension/` folder remains a local-development build.

The current verified origin is `https://home-area-reporter.vercel.app` (October 22, 2026). Extension 0.4.0 is submitted under Chrome item ID `gkcknhnphkocdbelbeggbeofcgkhdbmh`; use that existing item for subsequent releases rather than creating another listing. Saved production screenshots and privacy/reviewer disclosures are in the dashboard. Publisher contact-email verification is complete. The October 22, 2026 submission is pending Google review, with automatic publication enabled after approval; it is not yet publicly installable. That October 22 verification used the partial live fallback. The 0.5.0 batch release requires a production database and stored snapshots; current production verification is recorded in the canonical design.

The owner must sign in to Vercel and the Chrome Web Store developer dashboard. Complete any publisher registration, fee and binding agreements personally when required. A 128px PNG icon and at least one valid screenshot are required by the store; prepare screenshots from the verified live product, complete privacy/permission declarations and contact details, then submit for review. An uploaded ZIP or review submission is not a live store listing. Do not record success until the store status is published and its installation link works.


For an owner-configured Sensitive production key, use a one-time build override from the linked project. This fetches Census data and writes the production baseline before building/deploying; ordinary future deployments keep the normal build command. Do not commit the override or log environment values.

```sh
mkdir -p .local
node --input-type=module -e 'import { readFileSync, writeFileSync } from "node:fs"; const config = JSON.parse(readFileSync("vercel.json", "utf8")); config.buildCommand = "npm run db:baseline -- --vintage=2024 && npm run build"; writeFileSync(".local/acs-import.vercel.json", JSON.stringify(config));'
npx --yes vercel@65.2.0 deploy --prod --yes --local-config .local/acs-import.vercel.json
```

Production activation passed on October 24 after Census activation propagated: 33,772 ZCTA baselines (2024 vintage, 2020–2024 period), approximately 154 MB total database size, and all 31 Seattle permit areas still ready. Try `/report?zip=02139` for a leading-zero national baseline or `/report?zip=98004` for Bellevue historical context; these are separate from local permit coverage. Re-import only after reviewing a new ACS vintage; daily permit refreshes do not download Census data. Seattle reports stay available when an import/build fails.

The importer rejects redacted placeholders, incomplete/non-JSON payloads and unavailable geography schemas before any database write. Upper/lower rent-median bounds and estimate/MOE annotations survive normalization. Reconcile received/imported counts, database size and representative baseline-only pages after the import; Seattle permit readiness is independent.

## 7. Validate the checkout

Run these checks before pushing:

```sh
npm run docs:check
npm test
node --check extension/popup.js
npm run build
```

The default deterministic tests need no database or live network. `tests/batch-db.test.mjs` additionally runs real PostgreSQL integration checks when `TEST_DATABASE_URL` points to a disposable development database server whose role can create/drop test databases. It creates a fresh random database and removes it afterward; CI supplies PostgreSQL 16. Never point this test at production. Example: `TEST_DATABASE_URL=postgresql://localhost/postgres npm test`. A successful build does not prove live source accuracy or unpacked-extension behavior, so manually test at least one supported listing after source, map or extension changes.

## 8. Restart and shutdown

After a laptop restart:

```sh
brew services start postgresql@14
npm run dev
```

The PostgreSQL service normally remains available between terminal sessions. Stop the Next.js server with `Ctrl-C`. Only run `brew services stop postgresql@14` if no other local project needs that shared database service.

## 9. Troubleshooting

- **`createdb`, `psql` or PostgreSQL is not found:** use the `PG_BIN` commands above; Homebrew's versioned formula may not be linked globally.
- **Database connection refused:** confirm `brew services list`, the `DATABASE_URL` value, and whether another PostgreSQL installation owns port 5432.
- **Port 3000 is busy:** stop the other local server. The extension development manifest expects port 3000.
- **Extension map or request fails:** confirm `npm run dev` is still running, reload the extension, and verify its Website connection is exactly `http://localhost:3000`.
- **Seattle API throttling:** add a personal Socrata application token to `SOCRATA_APP_TOKEN` in `.env.local`; never place it in extension code.
- **Map click opens a neighboring marker at the ZIP overview:** markers can overlap. Zoom in before selecting, or focus the numbered marker and press Enter. Decluttering remains a tracked usability issue.
- **No listing coordinates:** the project cards still work. The map shows projects with source coordinates and omits only unlocated markers.
- **Documentation check fails:** follow its reported missing command, variable, route, version or link; update code and canonical documentation together.

## Codex handoff prompt

When opening this checkout in a new Codex task, a useful first instruction is:

> Read AGENTS.md and docs/fresh-machine-setup.md completely. Set up this existing checkout without committing credentials, run the documented validation, keep the local server running, and report any machine-specific deviation rather than silently changing the canonical setup.
