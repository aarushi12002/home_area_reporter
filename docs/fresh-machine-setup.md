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

## 4. Schema and initial data

Apply the committed migration and ingest the five initial Seattle ZIP codes, 98101 through 98105:

```sh
npm run db:migrate
npm run db:ingest
```

The initial live ingestion can take several minutes and requires internet access. To refresh one area later, use:

```sh
npm run db:ingest -- --zips=98103
```

## 5. Run the website

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and test ZIP `98103`. Keep this terminal running while using the extension. The website snapshot first describes **What’s planned**, then **What it could mean**. Supported factors appear as grouped decision cards with concrete counts/largest single-plan values and icons. Test **All**, **Buying / renting a home** and **Retail / commercial** to change the cards and takeaways; unconnected topics move into the blurred Pro preview. The snapshot omits scoring-method and data-origin explanations; individual project cards retain their city-record links. Check the **Upgrade to Pro** dialog: these additional topics and checkout are coming soon, not currently unlockable. The **Projects in this ZIP** map sits beside the planned-change summary above 650px and stacks below it on smaller screens. Decision cards and stage counts follow, with project cards under **Project details**; **Open full report** loads paginated evidence. A partial live response displays its warning alongside the assessment. If the live lookup is truncated, use the existing complete database ingestion rather than suppressing the warning. The future source/access plan is in [free-sources.md](free-sources.md); no additional provider keys are needed for today's permit-only report.

Above the snapshot, verify **About this ZIP**: for 98103, expect Adobe/Brooks Running, Metro Route 40/RapidRide E Line, PCC and Fremont Sunday Market. All five supported ZIPs have profiles. Check 98102 and 98105 for explicit Nearby labels on Fred Hutch (98109) and UW's Seattle campus (98195). Names link to official pages, with no additional provider key. The reviewed directory in `lib/zip-profile.mjs` is valid from 2026-10-21 until 2027-01-19; review and refresh its facts/dates before expiry, otherwise it is hidden. These are selected area highlights, not property-specific distances or a live transit/business feed.

Verify the **Bus routes** toggle on the map: purple route lines appear around the ZIP with King County attribution; a source failure leaves project markers usable and offers retry. This overlay is route geography, not live arrival times or future service changes. **Parks & public improvements** shows selected reviewed city projects for 98101/98103/98104 plus qualifying civic permits. September 2026 is a past, unconfirmed target for Lower Woodland Playfield #1; the Ship Canal 2027 target is program-wide, and Hing Hay’s October 2026 target covers Phase I only. Medical care is a fourth **About this ZIP** group; outside-ZIP facilities remain labeled Nearby.

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

Current extension manifest version: `0.4.0`.

Listing-location sharing is off by default. Turn on **Include the listing location for nearby results** only when you want coordinates/address included in report requests/links. The popup links to `/privacy`. Verify ZIP-only requests contain no `lat`, `lng` or address, and confirm opting in restores location-aware behavior.

For a store build, first verify the deployed HTTPS origin, then run:

```sh
npm run extension:package -- --origin=https://your-production-host
```

Use the actual verified origin, not this placeholder. The script writes the ZIP, unpacked release directory and resolved store listing under ignored `.local/releases/home-area-reporter-0.4.0/`. Use `--out=/absolute/new/path` for a subsequent build; it refuses an existing bundle. It copies only the manifest, popup HTML/JS/CSS and four PNG icons. Release host/frame permissions reference only the chosen origin, and saved localhost preferences cannot override the hidden production origin. The source `extension/` folder remains a local-development build.

The current verified origin is `https://home-area-reporter.vercel.app` (October 22, 2026). Extension 0.4.0 is uploaded under Chrome draft ID `gkcknhnphkocdbelbeggbeofcgkhdbmh`; use that existing item for subsequent releases rather than creating another listing. Saved production screenshots and privacy/reviewer disclosures are in the dashboard. A verified publisher contact email still blocks review submission. Production uses the partial live-source fallback; cloud database ingestion and scheduled refresh have not been verified.

The owner must sign in to Vercel and the Chrome Web Store developer dashboard. Complete any publisher registration, fee and binding agreements personally when required. A 128px PNG icon and at least one valid screenshot are required by the store; prepare screenshots from the verified live product, complete privacy/permission declarations and contact details, then submit for review. An uploaded ZIP or review submission is not a live store listing. Do not record success until the store status is published and its installation link works.

## 7. Validate the checkout

Run these checks before pushing:

```sh
npm run docs:check
npm test
node --check extension/popup.js
npm run build
```

The default tests do not require a database or live network. A successful build does not prove live source accuracy or unpacked-extension behavior, so manually test at least one supported listing after source, map or extension changes.

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
- **No listing coordinates:** the project cards still work. The map shows projects with source coordinates and omits only unlocated markers.
- **Documentation check fails:** follow its reported missing command, variable, route, version or link; update code and canonical documentation together.

## Codex handoff prompt

When opening this checkout in a new Codex task, a useful first instruction is:

> Read AGENTS.md and docs/fresh-machine-setup.md completely. Set up this existing checkout without committing credentials, run the documented validation, keep the local server running, and report any machine-specific deviation rather than silently changing the canonical setup.
