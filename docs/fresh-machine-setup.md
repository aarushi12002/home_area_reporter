# Fresh laptop setup

This is the canonical setup guide for a new contributor or a new Codex checkout. It assumes macOS, Chrome, GitHub repository access and a local PostgreSQL database. Do not commit `.env.local`, database files, API tokens or browser data.

## 1. Prerequisites

- Git and GitHub CLI authenticated for `aarushi12002/home_area_reporter`.
- Node.js 22 or newer and npm.
- PostgreSQL 14 or newer.
- Google Chrome for the unpacked extension.

Homebrew is the simplest macOS installation path:

```sh
brew install node@22 postgresql@14 gh
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

Open [http://localhost:3000](http://localhost:3000) and test ZIP `98103`. Keep this terminal running while using the extension. The expected flow is summary cards and a numbered map, followed by paginated evidence after **Open full report**.

## 6. Load the Chrome extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this checkout's `extension` directory.
4. Pin **Home Area Reporter**.
5. Open a Redfin or Zillow listing in ZIP 98101, 98102, 98103, 98104 or 98105.
6. Open the extension, keep **Website connection** set to `http://localhost:3000`, and choose **Check this area**.
7. Confirm that up to fifteen cards, fifteen numbered map markers, the listing marker when coordinates are available, and zoom controls appear.

After pulling extension changes, return to `chrome://extensions` and click **Reload** on the extension card.

Current extension manifest version: `0.3.0`.

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
