# Free-source inventory
Checked 2026-10-17 Pacific time. 'Metadata verified' means fetched the official dataset metadata; it is not a completed connector or a guarantee of freshness. Public Domain classification applies to the specific dataset, not automatically to linked plans, images or other materials.

## Seattle batch expansion — 2026-10-24

The shared registry is `data/service-areas.json`: 31 generalized 2020 Census ZCTAs with nontrivial intersection with the ACS2024 Seattle incorporated-place boundary (GEOID 5363000). Geometry URLs and vintages are preserved in the registry and `sources.json.reference_sources`. The old candidate `k473-p8hz` was resolved and rejected: it describes 1936 aerial imagery boundaries, not Seattle municipal limits. Census-derived envelopes are ZIP vicinity, not exact postal boundaries. Shared ZIPs cover Seattle municipal records only; institutional areas are explicitly reviewed.

Both existing permit connectors now download their citywide active sets once per batch, checking counts around complete pagination. Invalid/unregistered ZIPs and invalid/outside-city geometry are quarantined with evidence, not assigned to a plausible neighborhood. Local October 24 runs received 26,606 building and 4,651 land-use rows, accepting 23,389 and 4,253 respectively. These are source rows, not canonical project or housing totals. Two complete local refreshes enabled 31 areas and materialized 3,027 visible projects; production ingestion is verified separately in the canonical design.

The existing current-area directory now includes 26 additional reviewed profiles in `data/zip-profiles.json`, valid 2026-10-24 through 2027-01-22. Four groups use selected official company/institution, Seattle Public Library, PCC/QFC/Costco and medical-location facts. Reuse short names/address facts and original summaries only; no marketing copy, proprietary scores, hours or business-size claims. References include [library locations](https://www.spl.org/hours-and-locations), [PCC locations](https://www.pccmarkets.com/store-locator), [QFC Seattle stores](https://www.qfc.com/stores/grocery/wa/seattle), UW Medicine, Neighborcare and Swedish location pages linked in each profile. Outside-ZIP references remain explicitly Nearby. Original five profiles keep their earlier review window below.

Selected transit names in `data/transit-reference.json` come from current/in-service route geometry intersecting reviewed vicinity envelopes on October 24. This does not establish stops, frequency or listing-specific accessibility. Existing King County attribution and free-context-only reuse limits remain applicable. Expanded reviewed public-project references cover Hiawatha, Lake City Floodplain Park, Little Brook Park, Bitter Lake Reservoir and Magnolia Bridge; construction windows and design milestones are not completion promises. Parks facts remain selected references, not an exhaustive per-ZIP inventory.

The ACS bulk importer is implemented. A protected server-side `CENSUS_API_KEY` is configured in Vercel; the CLI returns `[SENSITIVE]` instead of the key. The October 24 import executed inside Vercel with the real secret and received Census’s “Invalid Key” response; activation/value correction remains required, and no rows were imported. It preserves 5-year observation periods, ZCTA geography, suppressed values, margins of error and estimate/MOE annotations. Preserve upper/lower median annotations in display rather than presenting coded values as exact rents; see [Census annotation guidance](https://cdn.www.census.gov/data/developers/data-sets/acs-1year/notes-on-acs-estimate-and-annotation-values.html). National baseline availability is independent of local permit coverage and paid access. No current-rent, valuation or price-causation claim is introduced.

For national named-place expansion, Overture's [Places guide](https://docs.overturemaps.org/guides/places/) and [licensing page](https://docs.overturemaps.org/attribution/) describe public bulk access and CDLA Permissive 2.0 / Apache 2.0 / CC0 1.0 provider licenses. It also documents duplicates, junk and incomplete attributes. Validate versioned schema, source attribution, operating-status filtering and deduplication before publication; do not treat confidence as proof of business prominence. Greater Seattle connectors (starting with Bellevue) require separate endpoint/license/status/geography verification; King County permitting is not coverage of every incorporated city.

A bounded South Lake Union/Queen Anne sample from release `2026-10-21.0` was downloaded on October 24: 4,192 records, including 309 permanently closed places, 754 with no operating status, 673 with no website and two duplicate name/rounded-coordinate buckets. The sample includes `taxonomy.primary`/`hierarchy` rather than assuming the older categories schema. This validates access and exposes filtering needs; no place feed is published in the application. Keep release/GERS ID, provider provenance and applicable CDLA/Apache/CC0 license copies/notices with selected records. Filter closed and unverified-status destinations, map reviewed categories, deduplicate by name/location/address and check representative official websites before activation.

## Current ZIP reference facts — reviewed 2026-10-21

The website now has a separate manually reviewed **About this ZIP** directory in `lib/zip-profile.mjs`, recorded in `sources.json.reference_sources`. It contains short factual names, addresses/postal codes, official destination links and our own short area descriptions. It does not reproduce listing descriptions, proprietary ratings, photographs, retailer marketing copy or schedules. No automated business/place feed has been added, and this work does not grant permission to scrape or republish third-party page content in a future connector. API keys and external accounts are not needed for these static references.

| ZIP | Work / institutions | Transport reference | Groceries / shopping |
| --- | --- | --- | --- |
| 98101 | Seattle Convention Center Summit; Nordstrom Downtown Seattle | Westlake Station | H Mart 2nd & Pine; Nordstrom |
| 98102 | Seattle Preparatory School; Fred Hutch Cancer Center explicitly nearby in 98109 | Capitol Hill Station | QFC Broadway Market |
| 98103 | Adobe; Brooks Running | Metro Route 40 Fremont and RapidRide E Line Aurora | PCC Fremont; PCC Green Lake Aurora; Fremont Sunday Market |
| 98104 | F5; Harborview Medical Center | Pioneer Square Station | Uwajimaya Seattle |
| 98105 | Seattle Children's Hospital; UW Seattle campus explicitly nearby with campus postal code 98195 | U District Station | University Village; Trader Joe's U District; QFC University Village |

Each entry's official reference URL and address is stored beside the fact, rather than copied into a separate attribution block in the product. Checks include company contact/location pages, retailer store directories, the market's seasonal-location page, and published transit stop/route pages. Two noteworthy boundaries: UW publishes 98195 for its Seattle campus direction/mailing address, and Fred Hutch publishes 98109; neither is silently presented as an inside-ZIP institution. Transit entries identify an area service, not exact home distance, frequency, accessibility or future service improvement. No GTFS or real-time payload is ingested by this directory; the transit-feed integration below remains planned and requires its own terms/attribution workflow.

Profiles are valid from 2026-10-21 until 2027-01-19 (90 days), after which the API returns null until facts and dates are reviewed. Review source changes and store closures when known; do not treat this window as a guarantee that nothing changes. The API retains profiles during a permit-source outage, but never fabricates permit findings or extends ZIP coverage. Deterministic tests cover all five profiles, explicit nearby labels, expiry, invalid ZIPs and response isolation.

## Free-data implementation plan — researched 2026-10-21

The two Seattle permit feeds and free Metro geometry overlay are connected; the ACS importer awaits successful Census key activation/value correction and import acceptance. The free website should show the building-plan summary and supported implications; unconnected topics belong in the blurred, clearly coming-soon Pro preview. Charging for a report will not create missing evidence. Do not sell an unlock until the underlying connector, coverage and paid access exist.

### Why the current report has gaps

- The live 98103 lookup returned 1,000 building records with `truncated: true`, while the land-use lookup completed at 280 records during this session. That explains the current partial-source warning. It is a request pagination limit, separate from missing transit/zoning/market connectors. Results change as the city updates its feeds.
- At the October 21 checkpoint there was no configured database. The October 24 batch implementation now has verified complete local ingestion and a provisioned production database; see current verification above. Do not remove the live warning or describe this lookup as complete.
- Permit records establish applications, descriptions and recorded stages. They do not establish actual occupancy, transport improvements, adopted area-wide rezoning or a price forecast. Views need a particular home's geometry and reviewed proposed plans.

### Source/access plan

| Priority / topic | Free source and access | Useful report output | Prerequisites and limits |
| --- | --- | --- | --- |
| 0 · Building plans | Existing [building permits](https://data.seattle.gov/Built-Environment/Building-Permits/76t5-zqzr) and [land-use permits](https://data.seattle.gov/Built-Environment/Land-Use-Permits/ht3q-kdvx), Socrata JSON; optional app token | New housing/building proposals, recorded heights, status and evidence links | Configure local PostgreSQL or Neon, migrate and run existing complete ingestion. Review grouping and replacements; do not sum permit units or call additions a net gain. Existing dataset licenses are Public Domain; linked plans have separate rights. |
| 1 · Transport | [King County Metro GTFS and service alerts](https://kingcounty.gov/en/dept/metro/rider-tools/mobile-and-web-apps); public download, no API key documented for the static feed | Stops, scheduled frequency, service windows; later, compare dated feed snapshots | Terms permit reuse with the required King County attribution. Validate calendars, expiry and geography joins; current GTFS cannot prove future station openings or that journeys will improve. Static-download availability and terms reviewed; parsing not implemented. |
| 1 · Zoning | [Seattle Current Land Use Zoning Detail](https://catalog.data.gov/dataset/current-land-use-zoning-detail), ArcGIS item `dd29065b5d01420e9686570c2b77502b`, plus [adopted planning legislation](https://seattle.gov/planning-and-community-development/comprehensive-plan) | Current zone/overlay, enacting ordinance and effective date; reviewed before/after rule changes | Catalog and fetched ArcGIS item metadata publish PDDL; retain the city's accuracy/service disclaimers and test the feature schema before ingestion. The layer itself warns it is not the official zoning map. Spatial join, archived snapshots and official ordinance checks are needed; proposal maps are not adopted rules. |
| 1 · Historical price trends | [FHFA HPI downloads](https://www.fhfa.gov/data/hpi/datasets?tab=master-hpi-data) and [methodology/coverage FAQ](https://www.fhfa.gov/faqs/hpi); public spreadsheet downloads | Annual historical price-index changes where a five-digit ZIP series exists | ZIP indexes are developmental and annual, not current asking prices, dollar valuations, rental rates or forecasts. Check each initial ZIP before promising coverage; show broader fallback geography explicitly. Review dataset-specific notices, retain vintage/revisions and display FHFA's required non-endorsement notice from its [policy](https://www.fhfa.gov/about/fhfa-policies/website-privacy-policy). No workbook coverage test or connector yet. |
| 1 · Rent / density context | [ACS five-year data](https://www.census.gov/programs-surveys/acs/data/data-via-api.html), [API examples](https://api.census.gov/data/2024/acs/acs5/examples.html), [free API-key registration guide](https://www.census.gov/data/developers/guidance/api-user-guide.API_Key.html) | Median gross rent (`B25064`), housing stock (`B25001`), population (`B01003`), with margins of error | All API queries now require a key; the key is free and must stay server-side when integrated. Use ZCTA geography, explicitly distinct from postal ZIPs. Five-year estimates describe an earlier period, not today's advertised rent; preserve period, uncertainty and consistent/non-overlapping comparisons. Cite Census; no key requested or data calls implemented. |
| 2 · Streets / public investment | [SDOT capital-project dashboard documentation](https://www.seattle.gov/transportation/about-us/asset-and-performance-management) and official project records | Reviewed project scope, stage, budget and dated milestones | The page describes monthly data for projects over $500,000 in design/construction. Resolve the actual dataset endpoint, geometry, reuse terms and schema before building a connector. Do not equate a budget allocation with delivery or infer travel-time gains. Endpoint/license discovery remains open. |
| 2 · Parking | Existing Seattle parking inventory feeds listed below, plus dated SDOT rate/rule publications | Block/time-specific parking context, later verified policy changes | Existing free feeds are inventory-only. A geographic crosswalk and field/date validation are needed; occupancy does not establish a legal rate change or a future effective date. |
| 3 · Views / daylight | [Seattle project/plan research](https://seattle.gov/construction-and-inspections/resources/research-a-project) and [Washington DNR lidar](https://www.dnr.wa.gov/lidar) | An eventual site-specific sightline/shadow assessment | Check plan reuse rights, lidar tile coverage/date/license and building footprints. Require property location, floor/orientation, proposed massing and terrain; validate a geometric model against reviewed sites. Public downloads do not by themselves establish all required commercial rights. No reliable blocked-view score is ready. |

### Delivery order and acceptance checks

1. **Complete the permit baseline first:** configure the database, ingest all five initial ZIPs, verify complete runs/failure retention and manually review several grouped projects. Keep source timestamps, source dates and proposal/permit distinctions.
2. **Build one non-market connector at a time:** Metro first, zoning next. Store dated snapshots and explicit coverage so “change” can be compared against a prior state. Add synthetic regression tests and a small reviewed real-record sample per initial ZIP.
3. **Build historical market context:** FHFA and ACS, after ZIP/ZCTA coverage validation and a free Census key. Show geography, observation period, uncertainty and attribution. Estimate and index are distinct labels; never infer a causal price effect from a nearby apartment proposal.
4. **Add capital projects and parking after endpoint/license validation.** Defer exact views/daylight until plans, geometry and validation can support it. An arbitrary numeric score is not a substitute for this work.
5. **Release Pro only after useful coverage exists:** verify the priced report actually contains the advertised topics, implement server-side access/checkout, and test empty/outage cases. Until then, use illustrative blur and “coming soon,” not fabricated hidden numbers.

The permit feeds and current Metro geographic overlay are connected; the other planned feeds below remain unimplemented. No external account/key has been created. Manual ZIP and public-project references are documented separately. See the machine-readable `planned_sources` in `sources.json`; keep plans separate from the current Socrata `sources` array so the existing metadata probe continues to work.

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

## Implementation update — 2026-10-18
The building and land-use datasets are connected through reusable source definitions, persistent ingestion and a live fallback. Local ingestion completed all active-result pages for 98101–98105 and preserved latitude/longitude when supplied. The background ingestion safety ceiling is 50,000 rows per source/ZIP; reaching it fails the sync rather than publishing an incomplete replacement. Daily production scheduling is configured but remains inactive until a Vercel project, Neon database and `CRON_SECRET` exist. Other source categories remain inventory-only. Date/status incompleteness, inferred grouping and the absence of verified construction-start evidence remain explicit limitations.

## Free context additions — reviewed 2026-10-21

### Metro route overlay

Connected and live-tested: [King County Metro Routes](https://www5.kingcounty.gov/sdc?Layer=transitroute_line), ArcGIS item `ec3ec9492c0846e8a5e93d056a8cdc4f`, layer `TRANSITROUTE_LINE_2647/FeatureServer/0`. `IN_SERVICE_FLAG=Y` and `CURRENT_NEXT_CODE=IN SERVICE` select current geography; query/output use EPSG:4326. The 98103 check returned 28 intersecting route features, clipped to the vicinity envelope. Successful queries cache six hours; failures/truncation do not become a successful empty overlay. This is not GTFS parsing, realtime arrivals, rail coverage or future transit-change detection.

[County GIS terms](https://kingcounty.gov/en/dept/kcit/data-information-services/gis-center/about/terms-conditions-copyrights) permit copying/distribution/use where county rights apply, with an exception for selling the information without written agreement; third-party rights and accuracy disclaimers remain. Keep this in the free report and resolve rights before paid exports. Display “Transit scheduling, geographic, and real-time data provided by permission of King County” with the overlay. Public geometry does not prove transit service at any particular time.

### Public improvements and completion targets

The connected Seattle permit feeds have no structured forecast completion field. Building `CompletedDate` is a recorded completion, not an expected future finish. Issue/expiry/plan-review dates are not substitutes. `lib/project-details.mjs` only extracts explicit, unambiguous expected project-completion phrases and identifies civic descriptions; existing eligibility rules still exclude completed/cancelled permits. Rerun database ingestion after changing permit eligibility.

Selected manual references in `lib/public-projects.mjs` supplement permit evidence. Use short factual summaries and official links, not bulk copyrighted page text. These are not a complete or automated capital-project feed:

| ZIP | Official project | Schedule interpretation |
| --- | --- | --- |
| 98101 | [Freeway Park improvements](https://www.seattle.gov/parks/about-us/projects/freeway-park-improvements) | Summer 2026 Phase 1 target has passed; final completion unconfirmed; later phases distinct |
| 98103 | [Lower Woodland Playfield #1](https://www.seattle.gov/parks/about-us/projects/lower-woodland-playfield-1) | Page updated October 20 still describes work nearing completion with September 2026 target; flag the past target, do not infer reopening |
| 98103 | [Olmsted restoration](https://www.seattle.gov/parks/about-us/projects/olmsted-parks-and-boulevards-restoration-project) | Lower Woodland planning from summer 2026; no finish date. Early 2027 construction on that page concerns Colman Park and must not be assigned to Woodland |
| 98103 | [Ship Canal Water Quality Project](https://www.seattle.gov/utilities/neighborhood-projects/ship-canal) | 2027 operational program target, not every local site’s finish date |
| 98104 | [Hing Hay restroom](https://www.seattle.gov/parks/about-us/projects/hing-hay-park-restroom-renovation) | October 2026 estimated Phase I finish; Phase II depends on property transfer, final public opening not announced |

References reviewed 2026-10-21 expire 2027-01-19. No selected reference for a ZIP means no curated card, not no public investment. No civic ownership is inferred from the word parking or from private apartment amenities.

### Medical locations

Profiles now include medical care for each supported ZIP. Locations use official UW Medicine, Seattle Children’s, Swedish and Virginia Mason pages. [UW Medicine Fremont](https://www.uwmedicine.org/locations/primary-care-fremont) lists **459 N 35th St, Suite 203, 98103**; older directory text using 400 N 34th St was not adopted. Swedish Central Seattle is in 98122 and is explicitly Nearby for 98102. Selected name/address facts are not clinical guidance, a quality rating, insurance acceptance or live appointment availability.

### Soundscore: optional adapter, awaiting account/key

[HowLoud pricing](https://howloud.com/pricing) advertises a free plan for single webpages, fewer than 2,500 monthly queries and no caching. [API documentation](https://api.howloud.com/docs/) requires a partner key and latitude/longitude. This is a proprietary partner API with a free tier, not public-domain/open data. Registration/trial eligibility, exact account terms and production use still need confirmation by the account holder. No key has been obtained or real score fetched.

The adapter accepts a selected Seattle location, uses server-only `HOWLOUD_API_KEY`, user-triggered calls, request/response no-store and no database/cache writes. It supports documented result-object/array shapes and validates 50–100 scores. It does not infer a ZIP-wide score, substitute traffic noise models, scrape a listing site or gate the section behind Pro. Real-provider acceptance and durable quota/abuse controls remain pending before public release.

## What the existing permits can support — decision cards

The same public-domain Seattle building and land-use feeds now power richer free decision cards. No new source/account is required. Existing filtering previously hid explicit business fit-outs; eligibility now retains those and explicit seismic/access/fire-system upgrades, while closed/cancelled records, ordinary home maintenance and sign-only work remain excluded. Database snapshots need re-ingestion after this change.

| Dimension | Recorded facts used | Conditional implication and limit |
| --- | --- | --- |
| Homes & local activity | Individual added-home count; current project count | More housing choices or potential customers if built/occupied; not net growth, demand or a neighborhood unit sum |
| Building height | Story mentions | Investigate privacy/daylight and adjacent scale; no confirmed view obstruction |
| Shops & services | Explicit retail, food, grocery or care/service uses | Possible future destinations/complementary or competing uses; not confirmed openings |
| Commercial space & reuse | Proposed destination of use changes; named office/retail/industrial/hotel uses; fit-out descriptions | Space and permitted-use research leads; no vacancy, leasable inventory, footfall or tenant identity inference |
| On-site parking | Explicit vehicle-space counts, no-parking proposals and removal | Parking scope of a project; not street availability, loading rights, occupancy or a net area total |
| Demolition & site work | Demolition, excavation, shoring or pile-driving descriptions | Potential future noise/dust/truck activity if work proceeds; not confirmed ongoing work or a schedule |
| Access & building upgrades | Explicit seismic retrofits, access ramps/elevators or fire-system work | Scope worth checking; not completed safety/compliance or a quality rating |

[SDCI’s new-business guidance](https://www.seattle.gov/construction-and-inspections/permits/common-projects/new-businesses) distinguishes existing-business tenant improvements from a change in use. [Establishing use](https://seattle.gov/construction-and-inspections/permits/permits-we-issue-%28a-z%29/construction-permit---establishing-use) describes permitted use changes such as office to retail. Match the new use in those descriptions; do not count the previous use as incoming supply. Maximum housing/parking figures are linked to the example project that contains that maximum. The existing source-support rubric remains legacy API metadata, not a benefit score. No crime, school-quality, rent/price, ROI or guaranteed business-success factor is manufactured from permit activity.


## Seattle-wide geography planning (October 22, 2026)

Coverage expansion is tracked in [issue #6](https://github.com/aarushi12002/home_area_reporter/issues/6) and the canonical [system design](mvp-setup.md). The current five ZIPs remain the only enabled areas. Aggregate queries of the two existing permit feeds returned 23,416 building rows and 4,258 land-use rows before relevance/grouping, with 30 distinct five-digit 981xx candidates plus malformed ZIPs. These values describe a point-in-time source inventory, not final Seattle coverage or canonical project counts.

Two geography candidates are recorded as `planned_not_connected` in `sources.json`: the [official Seattle boundary catalog](https://data.seattle.gov/dataset/Boundary/k473-p8hz) and [Census ZCTAs](https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html). The city catalog points to a GIS download whose schema, vintage and dataset-specific reuse notices need validation. Census describes ZCTAs as approximate statistical representations and says not every postal ZIP has one. Pin the chosen download/version and provenance; review institutional/PO-box ZIPs and shared city-boundary ZIPs separately. Boundary intersection is a coverage-review input, not permission to claim all records in a postal ZIP or neighboring jurisdictions. No geography has been imported and no additional ZIP enabled.
