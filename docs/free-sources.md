# Free-source inventory
Checked 2026-10-17 Pacific time. 'Metadata verified' means fetched the official dataset metadata; it is not a completed connector or a guarantee of freshness. Public Domain classification applies to the specific dataset, not automatically to linked plans, images or other materials.

## Sources usable as the initial foundation

### Seattle Building Permits — 76t5-zqzr
- Official metadata: https://data.seattle.gov/api/views/76t5-zqzr.json
- Data: https://data.seattle.gov/resource/76t5-zqzr.json
- Direct metadata verified: Public Domain; Daily refresh.
- Fields: permitnum, permitclass, permittypedesc, description, housingunitsadded/removed, applieddate, issueddate, completeddate, statuscurrent, relatedmup, parentpermitnum, development_site, originalzip, address, coordinates, source link.
- Use: new housing and mixed-use proposals/permits, net unit changes where populated, documented stage, chronology.
- Limits: permit != project; issued != construction started; apartments do not establish growth, occupancy, rent or price appreciation. Filter closed/cancelled/administrative records; deduplicate child permits.

### Seattle Land Use Permits — ht3q-kdvx
- Metadata: https://data.seattle.gov/api/views/ht3q-kdvx.json
- Data: https://data.seattle.gov/resource/ht3q-kdvx.json
- Direct metadata verified: Public Domain; Daily refresh; sample query previously succeeded.
- Fields: permitnum, description, units added/removed, dates including decisiondate, statuscurrent, originalzip, address, coordinates, source link.
- Use: earlier-stage land-use activity, published decisions and applications.
- Limits: planning universe is incomplete; do not assume missing rows mean no plans. Date types differ from building dataset; parse defensively.

### Seattle paid-parking data
- Transactions gg89-k5p6: Public Domain, Daily metadata verified.
- 2026 occupancy q2e4-e7e5: Public Domain, refresh metadata To Be Determined.
- Rolling occupancy jzyn-cn4n: Public Domain, Daily metadata verified; replacement for old hiyf-7edq.
- Metadata URLs: https://data.seattle.gov/api/views/ID.json
- Available: blockface, area, occupancy/time, capacity, time-limit category, paidparkingrate, coordinates depending on dataset.
- Use: dated parking context. Aggregate; do not export individual transaction IDs unnecessarily.
- Critical limit: transactions/occupancy do NOT establish a new legal rule or future effective date. Never compute authoritative hourly rate from amount/duration. Paidparkingrate may be blank/time-dependent. Signs and current official rules govern.
- Exact locations lack ZIP in these datasets. A licensed ZIP join or reviewed street-to-ZIP crosswalk is additional implementation work. Do not silently use approximate ZCTA boundaries as exact postal ZIPs.

### Seattle capital budget — m6va-m4qe
- Metadata: https://data.seattle.gov/api/views/m6va-m4qe.json
- Direct metadata verified: Public Domain; refresh One Time.
- Fields: fiscal_year, deptname, bclname, projecttitle, projectcode, fundname, amount.
- Use: fiscal-year budget context, grouped by project/year/fund.
- Limits: no ZIP, project geometry or implementation status in this schema. Not sufficient to label upcoming works, current funding or completion dates. Check fiscal years before using; treat as secondary context, not live infrastructure feed.

## No-fee transit feeds with conditions

### King County Metro GTFS
- Official source + terms: https://kingcounty.gov/en/dept/metro/rider-tools/mobile-and-web-apps
- Feed linked there: https://metro.kingcounty.gov/GTFS/google_transit.zip
- Includes Metro, Streetcar, Water Taxi, Link rail and some regional bus service according to official page.
- Routes, stops, trip shapes, calendars and stop times; frequency estimates can be computed for a stated service date/window. Check calendar exceptions and feed expiry.
- Terms grant use, reproduction, redistribution, storage and derivative works; prominently display required attribution: Transit scheduling, geographic, and real-time data provided by permission of King County.
- No data-license fee identified in published terms. Not Public Domain; license is revocable and carries conditions/disclaimers.
- Source page/terms verified. Download/parsing not tested this turn. Stop coordinates need explicit ZIP association; GTFS does not inherently establish postal ZIP membership.
- Does NOT establish unbuilt future rail openings or guaranteed long-term service levels.

### Sound Transit Open Transit Data
- https://www.soundtransit.org/help-contacts/business-information/open-transit-data-otd/otd-downloads
- Terms: https://www.soundtransit.org/help-contacts/business-information/open-transit-data-otd/transit-data-terms-use
- Terms permit broad use subject to conditions: current unchanged data, user terms, contact email, usage metrics on request, trademark limits and disclaimers. Register/contact through prescribed process before launch as needed; no email sent by this project.
- No fee identified in published data terms. Keep raw data unchanged; distinguish app-calculated analysis.
- Standard Sound Transit WEBSITE terms separately restrict commercial reuse and automated copying. Do not extend feed permission to expansion project webpages, board PDFs, renderings or other website material.

## Useful discoveries NOT yet approved as production connectors
- SDOT capital-project dashboard: official page describes monthly open-data updates for design/construction projects over $500k. Exact dataset/license still to verify.
- SDOT current projects and parking-rate announcements: valuable factual leads; individual reuse rights and historical effective-date structure still to verify.
- Sound Transit system expansion, board decisions, future station timelines: need appropriately licensed source or written permission. GTFS alone cannot supply this feature.
- Public parks/school/utility capital projects and new parking-zone policies: dataset-by-dataset verification outstanding.
- Bellevue major projects map has explicit commercial-use restriction; do not ingest commercially without authorization.
- King County generic GIS/parcel terms differ from transit-specific terms; don't reuse transit permission for parcel records.

## Product readiness
Green: Seattle permit-based ZIP brief.
Conditional: current transit context with feed terms and geography mapping; parking context with coverage limitations.
Not yet established: fully automated future rail, public infrastructure timeline, new paid-parking policy announcements.

## Operational rules
Use app tokens/rate-limit handling for Socrata. Store source-as-of and retrieval date separately. Snapshot metadata/licenses periodically and detect changes. Preserve raw status. Every claim carries evidence; no complete coverage claim. Nightly cached ingestion, async retries; never scrape every source per user request.
