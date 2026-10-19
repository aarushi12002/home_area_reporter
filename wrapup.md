# Agent wrap-up instructions

This is the mandatory end-of-contribution procedure, not a scratch log. Update existing documents in place; do not generate a new wrap-up file per session.

## 1. Validate the change
- Review the complete diff for accidental replacements, duplicate implementations, unrelated edits and secrets.
- Run `npm run docs:check`. When setup commands, package scripts, environment variables, supported areas, routes, extension metadata or contributor workflow changed, update `docs/fresh-machine-setup.md`, README and the relevant canonical design text together.
- Add/update regression coverage for changed behavior and run the checks required by `agents_start.md`. Report exact checks and results, including failures or checks not run. Never describe local passing tests as a successful remote CI run or claim merge protection without verifying it.
- For docs-only changes, verify referenced paths exist, relative links resolve and design/status/pricing statements agree.
- Distinguish a local syntax check from a browser test, live connector test, database migration or deployed verification.

## 2. Update README.md in the same contribution
Keep the README accurate and useful. Update the existing sections with:
- What now works, what remains scaffolded/planned, and material limitations.
- Setup/run/validation instructions when changed.
- Links to the canonical design and source inventory.
- The next concrete milestone or blocker when it changed.

If no README content is affected, explicitly say “README reviewed; no changes needed” in the final summary. Do not add meaningless edits just to touch it. Do not replace the README with a chronological chat transcript.

## 3. Update the system design in place
Read and update `docs/mvp-setup.md` for accepted design decisions discussed during the task, even if implementation is deferred. Cover whichever changed:
- Scope and customer journey.
- Component responsibilities, stack and deployment.
- Data sources, licensing status, schema and API contracts.
- Sync/async flow, refresh/caching, failure handling.
- Guest access, pricing/credits and privacy boundaries.

State what is implemented versus proposed, the rationale/tradeoff, and outstanding decisions. Keep the main design current; if useful, maintain a short dated decision history within that same document. Proposed/unaccepted alternatives remain clearly marked. If nothing changed, state “System design reviewed; no changes needed.”

Update `docs/free-sources.md` and `sources.json` together whenever source contracts, license findings, coverage or readiness change. Do not label an untested connector integrated.

## 4. Publish only within authorization
- Preserve others' changes. Re-read the remote head before updating it; use guarded fast-forward updates and handle concurrent changes.
- Follow the repository's existing branch/PR workflow. Commit/push only within the user's authorization; do not infer authorization for deployment, merging or changing access.
- Include code and corresponding documentation together in the contribution.
- Verify the resulting commit/PR/files exist before claiming upload success.
- If blocked, leave concrete reusable work, describe the blocker and state what was not completed. Do not claim a deployed MVP from a scaffold.

## 5. Final handoff
Give a concise summary:
1. What changed and why, with repository file/commit/PR links.
2. What was verified and any remaining limitations.
3. README and canonical-design updates (or explicit reviewed/no-change statements).
4. The next actionable milestone when useful.

Do not claim success from an attempted action or repeat the entire design in the final response.
