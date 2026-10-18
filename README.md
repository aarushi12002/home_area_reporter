# home_area_reporter

A Seattle ZIP-based research tool answering: **What documented changes are shaping this area?**

## Current status
Implemented: a Chrome extension scaffold that opens from Redfin/Zillow and asks for a Seattle ZIP code, plus a source registry and metadata-check script.

Not implemented: live report generation, ingestion, website/API, database, payments or Vercel deployment. The local extension screen explicitly reports that no live search has run.

## MVP scope
- Free area-change brief: development applications/permits first; transit, public infrastructure and parking as source coverage is established.
- Seattle records only, even for ZIP codes crossing city boundaries. No precise-distance or complete-coverage claims.
- Paid property reports: $10 single / $20 bundle of five, with guest checkout; payments not connected.
- Favorites and comparison are deferred. Super Pro document-analysis pricing is undecided.

## Setup
1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select `extension/`.
3. Open a Redfin or Zillow listing, click the extension and confirm a ZIP code.
4. This demonstrates the handoff only; it does not generate live research.

## Validation
```sh
node --check extension/popup.js
node --check extension/report.js
python scripts/probe_sources.py
```
The first two commands check syntax. The probe reads current official Seattle metadata; it requires internet access and does not establish a functioning ingestion pipeline.

## Design and data
- [Current system design and setup](docs/mvp-setup.md)
- [Free sources, licensing and coverage limits](docs/free-sources.md)
- [Machine-readable source registry](sources.json)

Planned stack: Next.js/TypeScript on Vercel, Neon Postgres, ZIP-based queries and background ingestion/retries.

## Agent contribution workflow
Read [AGENTS.md](AGENTS.md) and [agents_start.md](agents_start.md) before editing; follow [wrapup.md](wrapup.md) before finishing. Extend existing code/documents and update README plus accepted system-design changes in the same contribution.

## Next milestone
Connect one Seattle permit-data ingestion path to a ZIP-based report and validate cancelled, duplicate, stale and missing-source cases before charging users.
