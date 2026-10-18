# Agent start instructions

Read this file at the beginning of every contribution. These instructions apply to the whole repository; explicit user instructions take precedence.

## Establish current context before editing
1. Read `AGENTS.md`, `README.md`, this file, and `wrapup.md`.
2. Read the latest `docs/mvp-setup.md`: this is the canonical system design and implementation-status document. Read it from the current checkout/branch, not a previous conversation or cached copy.
3. For data work, read `docs/free-sources.md` and `sources.json`; inspect the relevant adapter, schema and tests.
4. Inspect repository status, current branch, recent relevant changes and existing files. Search with `rg` before creating or replacing anything. Preserve unrelated/uncommitted work.
5. State the smallest intended change and identify which existing files own that behavior.

## Build on what exists
- Modify and extend the existing implementation, design document and tests in place.
- Do not regenerate the application, replace whole modules for a small change, introduce a parallel implementation, or create alternate copies such as `design-v2.md`, `README-new.md` or `final-final`.
- Create a file only when it has a distinct responsibility with no suitable existing home. Explain the reason in the contribution summary; routine new files do not require extra approval.
- Reuse existing dependencies, naming, API contracts, configuration and UI patterns. Add dependencies only for a concrete need.
- Keep one canonical system design in `docs/mvp-setup.md`; README summarizes and links to it. Record accepted design changes there rather than scattering decisions across new documents.
- Do not silently promote proposals to implemented functionality. If design and code differ, document the actual state and resolve the discrepancy within scope.
- Do not silently adopt unaccepted brainstorming ideas. Mark unresolved choices and blockers explicitly.

## Current product constraints
- MVP: a useful Seattle ZIP-based area-change brief, entered through a Redfin/Zillow extension or the website.
- Extension is a thin entry point; research and report delivery belong in the website/backend. No exact property-coordinate requirement.
- Show development, transit, infrastructure and parking only to the extent sources actually support them. ZIP coverage does not imply coverage outside Seattle.
- No favorites or comparison in the MVP.
- Proposed backend: Next.js/TypeScript on Vercel, Neon Postgres via Vercel integration, async ingestion/retries. These are design choices, not proof of deployment.
- Paid pricing: $10 one property report; $20 five-report bundle; guest checkout. Super Pro pricing remains undecided.
- At the initial baseline, only extension/source-inventory scaffolding exists. Read current design status for subsequent progress.

## Evidence and safety
- Check source-specific reuse rights before adding a connector; public access does not establish commercial permission.
- Preserve source URLs, source dates, retrieval dates, original statuses and explicit missing coverage.
- Separate proposals, approvals, permits and construction. Never equate apartment proposals with guaranteed growth or price appreciation.
- Cancelled/completed/administrative permits must not become upcoming construction alerts.
- Current transit schedules do not establish future rail opening dates; parking occupancy does not establish a policy change.
- Do not fabricate findings, dates, license clearance, successful tests or deployment.
- Never commit credentials, user documents, private browsing information, or environment secrets. Keep provider credentials server-side.
- Do not change repository visibility or access, force-push, delete unrelated work, deploy publicly or make purchases unless authorized.

## Verification and completion
Testing is a required part of implementation. Add or update meaningful regression tests for changed behavior, especially evidence correctness, filtering, incomplete coverage, failure recovery and API contracts. When fixing a bug, first reproduce it with a failing test when practical; verify the test passes after the fix. Keep default tests deterministic with synthetic records and mocked upstream APIs; never require secrets, private listings or live availability in ordinary CI. Run `npm test`, `npm run build` and extension syntax validation for application changes. Run relevant browser and live-source checks when those boundaries change; explicitly record checks not run and remaining release gaps. A green build does not prove source accuracy or browser usability. Avoid tests that only repeat implementation. A docs-only change needs link/path and consistency review, not network calls or full application tests. Follow `wrapup.md` before finishing.

