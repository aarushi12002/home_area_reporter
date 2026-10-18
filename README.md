# home_area_reporter

A Seattle ZIP-based research tool answering: **What documented changes are shaping this area?**

## Current status
Implemented: a runnable Next.js website and `/api/report?zip=98109` endpoint backed by the free Seattle Building Permits and Land Use Permits APIs. Reports show descriptions, original statuses, available source event dates, source links, explicit permit grouping, query limits and source failures. The Chrome extension accepts a ZIP and opens the same website from Redfin or Zillow.

Not implemented: Neon persistence, scheduled ingestion, durable async jobs, transit/parking/public-infrastructure connectors, account or email access, payment/credit limits, automatic listing ZIP extraction, or public deployment. Source retrieval is live on demand with a short best-effort per-instance cache. This is a functional first slice, not a complete property due-diligence service.

## Run locally
Requires Node.js 22+ and npm. From the repository root:

```sh
npm ci
npm run dev
```
Open http://localhost:3000 and enter a ZIP such as 98109. No API key is required for small public-data lookups; set the optional server-side `SOCRATA_APP_TOKEN` from `.env.example` for higher API limits. Upstream availability and throttling still apply.

## Extension
1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select `extension/`.
3. Open a Redfin or Zillow listing and click the extension.
4. Enter its Seattle ZIP. Under **Website connection**, use `http://localhost:3000` locally or your deployed HTTPS origin. Click **Open area report**.

The origin setting lasts while the popup is open. No browser-history access, account or automatic extraction is implemented. The extension sends the ZIP only; the listing stays open.

## Validation
```sh
npm test
npm run build
node --check extension/popup.js
python scripts/probe_sources.py
```
Tests cover filtering, grouping, malformed inputs, unsafe links/origins, partial/all-source failures, caps and extension handoff. The metadata probe requires internet. A build or mocked test does not establish live source availability.

Live smoke check: both permit APIs returned records for 98109. The building-source 1,000-record cap was reached; the resulting report was correctly marked partial. Source event dates are often absent and are displayed as unknown; this is not a guarantee of upcoming construction.

## MVP scope
- Seattle permit activity by ZIP; no exact-distance or complete-coverage claims. ZIPs may extend beyond the covered city.
- Completed, cancelled, expired and administrative records are filtered; only explicit permit relations are grouped. Other duplicates may remain; housing units are not summed.
- Current public records can include old or undated entries. Review their official source status before drawing conclusions.
- Pro pricing remains $10 per property / $20 for five, guest checkout; not implemented. Super Pro pricing remains undecided.
- Favorites and comparison are deferred.

## Deployment
Vercel: import this repository, keep **Root Directory at the repository root**, choose Next.js and use the package scripts. No database environment variable is required for this first slice. The API route declares a 30-second maximum; verify your plan's execution allowance. Optional API token is server-only.

Before public beta, connect Neon through Vercel Marketplace, replace the ephemeral cache with durable ZIP records, add scheduled ingestion and protect the public endpoint against abuse. No Vercel project or database has been provisioned by this contribution.

## Design and data
- [Canonical system design and setup](docs/mvp-setup.md)
- [Free sources, licensing and coverage limits](docs/free-sources.md)
- [Source registry](sources.json)

## Agent workflow
Read [AGENTS.md](AGENTS.md) and [agents_start.md](agents_start.md) before editing; follow [wrapup.md](wrapup.md) before finishing. Extend existing files and keep README plus accepted design changes current.

## Next milestone
Connect Neon-backed ingestion/cache, add persistent source freshness and improve project relevance/deduplication using a manually checked set of Seattle ZIPs before expanding source categories or charging users.
