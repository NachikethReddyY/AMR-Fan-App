# Work record

## 2026-09-27: durable USD 1 Google routing allowance

GOOGLE-001 is an unlinked follow-up to route planning. The user authorized USD 1
total for AMR Google routing, with no automatic reset. A single independent
PostgreSQL row now admits at most 200 lifetime attempts at the reviewed USD 0.005
Essentials list price. It reserves all selected modes atomically before dispatch,
with synchronous commit, no retries, refunds or reset path. Errors, timeouts,
process death, lost acknowledgements and unused late reservations burn allowance.
The API injects the store through its existing pool. The complete comparison
deadline includes admission and both provider batches; late commits cannot send.

| Evidence                | Observed result                                                                                                                                                                                                            | Limits                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Failing-first admission | Four expected failures before implementation, then seven focused tests pass                                                                                                                                                | Fetch intercepted, no Google request                                                                                                          |
| PostgreSQL/API          | Nine tests pass on isolated PostgreSQL 18; four processes admit 200 of 320 attempted reservations, restart rejects further admission, SIGKILL before/after commit spends 0/4, late or lost acknowledgement cannot dispatch | One isolated local run after correcting a test mock accessor; injected acknowledgement loss after a real commit, not a physical network fault |
| Registration            | Real authenticated local HTTP consumes the durable row; unauthorized request and exhausted allowance dispatch nothing                                                                                                      | Real Google endpoint intercepted                                                                                                              |
| Protected routes        | Existing geometry, mode, CO2 and responsiveness cases pass; full `pnpm check` exits 0                                                                                                                                      | No browser/device or live response proof                                                                                                      |
| Cost/request shape      | Exact four mode bodies and ten-field mask tested; repeated failed searches reserve again, no automatic retry or route-result cache                                                                                         | Current official SKU/pricing evidence, not a Google billing statement                                                                         |

`pnpm security:check` exits 0 with zero source findings and scanner positive/
negative fixtures passing. One existing moderate dependency advisory remains.
DAST was not rerun: no HTTP endpoint changed, and its configured unauthenticated
crawl covers the unrelated admin participation page. The protected route and
cost boundary instead have real authenticated HTTP/PostgreSQL proof above.

The isolated fixture used generated credentials, a random loopback port and test
database, PostgreSQL 18, one CPU, 512 MiB memory and a 384 MiB tmpfs. Exact
containers were removed after every run and absence checked. No host credential
mount, shared database or provider credentials were used. New local planning
stays unstaged in TODO. Evidence is private under
`.evidence/google-routing-budget/`. Application code only increments the counter;
database operators and compromised database credentials remain outside the cap.

The [route operations contract](docs/operations/routes.md) records SKU sources,
limits and rollout requirements. Migration `0012_google_route_budget.sql` SHA256
is `00aeddb091fe0c43ff753ef6d89e937d041a07cef4849c06240f54aa625dff45`.
Runtime requires table SELECT and column UPDATE(used_attempts), nothing else.
Migration 0011, AI source, mobile, Auth, awards and deployment runner are unchanged.
Production remains held on the separately owned, independently reviewed runner
path that installs AI schema suspended and without spending grants. Historical AI
liability is unknown, not zero; AI_COST_DATABASE_URL stays absent and AI disabled.
No key, billing setting, cloud mutation, live DDL or live provider call occurred.
The cutoff covers participating AMR routing calls, not other consumers, leaked
keys, account-wide billing, taxes or currency effects. Root owns review/deployment.

Implemented by gpt-6-astra through Codex (T3 Code).

## 2026-09-27: labelled illustrative test data

Tracking: TEST-DATA-001, unlinked. Root approved a data-only slice on
`feat/labelled-test-data`, based on `7754117`. The public
[getTestDataView()](src/features/test-data/index.ts) export takes no arguments and
returns a deeply readonly display type with string leaves: label, notice,
summary, activity, rewards, travelNotice and travel. It uses no account hooks,
session selection, callbacks, API requests, storage or provider objects. Each
call creates independent display objects. The UI owner owns the component and
entry/exit after design selection and consumes this slice through main only.

The fixed illustrative manifest shows 1,250 example points and 30 kg example CO₂
reduction. Fictional journey entries add 600, 500 and 400 points; a content
example subtracts 250. These are display arithmetic, not actual journey evidence
or typical earnings. Reward examples cover content at 250 points, tree programme
participation at 1,000 and a 10% discount at 500, all explicitly illustrative
prices rather than policy or live offers. Copy disclaims content unlocking,
tree allocation/planting and vouchers/official offers. Travel contains bus,
train, car, electric car, walk and cycle comparisons with example distance,
duration and CO₂ emissions. It is separate from the fictional activity history.

Saved demo profiles, selected state, purchases, History and shared contributions
are untouched. This view neither represents nor replaces saved demo data. The
UI owner retains the responsibility to label an existing selected demo and offer
explicit Return to real data, while Account always displays the real identity.
There are no new navigation destinations, live catalogue seeds or UI edits.

Verification: frozen install passed without dependency changes; missing export
produced the initial failing test. Seven new tests plus 43 existing session and
catalogue tests pass. Checks cover independent labels, total arithmetic,
supported reward/travel kinds, rejection as offer/purchase/receipt payloads,
string-only public data, independent copies, zero network calls and a runtime
dependency boundary excluding account/storage/provider code. Typecheck and
focused lint pass. Evidence: `.evidence/labelled-test-data/`.

The allocated `pnpm check` run is red: existing `tests/onboarding.test.tsx:181`
expected transient full progress but found no element. Its reduced-motion mock
uses the production zero-delay completion timer; scheduling is a hypothesis, not
a proven root cause. The one isolated unchanged suite rerun passes 6/6 tests.
The original failing log is preserved. Earlier aggregate stages passed, including
234 Jest tests; all stages after the web suite were then run serially and passed.
No assertion, timeout or peer source was edited. The UI owner owns follow-up.

`pnpm security:check` passed with zero source findings across 330 SAST targets,
zero secrets findings and passing safe/unsafe scanner fixtures. One existing
moderate dependency advisory remains below the high-severity gate. Both command
sessions exited; no owned check process or scanner container remains. The heavy
slot was released immediately. Fetched main remains `7754117`; rebase was a no-op
and TODO was restored with a matching SHA-256 checksum. No UI/native/browser,
database integration, build, provider, CI or deployment proof is claimed. Initial
interface review is complete. Root authorized PR delivery with the red aggregate
gate explicit; final merge awaits independent review and root's test disposition.
The UI owner identified the zero-delay timer draining inside React act and owns
the completion-hold and deterministic fake-timer correction in a separate branch.
This slice does not alter that production code or test.

After Google PR #56 merged, rebased onto actual fetched main `b78be4f`.
Both owners' bug/work records were preserved through the two documentation
conflicts. The test-data source is byte-identical to its original verified slice.
TODO's checksum still matches. Post-rebase typecheck and seven fixture tests
pass; no full/security rerun was needed for unchanged fixture code. The earlier
red aggregate result remains explicit in the PR handoff.

Implemented by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: prepare the offline TokenRouter Jev request

Related to [#3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3).
The signed-in console established the Jev gateway path, string state and Choice
criteria, displayed model rates and finite key quota. The pure request mapper
copies validated route/activity decisions into that documented request and caps
the serialized body at 60,000 bytes. It has no dispatch, credentials or response
parser. Existing product transport and upstream parsing remain unchanged.
[Contract evidence](docs/ai/gateway-contract.md) distinguishes observed facts
from unresolved billing, substitution, image and response contracts.

Three new failing-first tests and 21 existing decision tests pass. The tests
cover exact request fields, route eligibility, untrusted observation text,
independent copies, the byte cap and zero dispatch. Rebased through main
`575787768868946dbc34a1bbe0d00298936ecfe9` without peer-file copying. TODO remains
byte-identical; exact stash IDs are retained in ignored local evidence. Durable
store/interface/migration and peer integration paths are untouched. The serial
`pnpm check` and `pnpm security:check` both exited 0 on this base. Security scans
reported zero source findings; the existing moderate dependency advisory remains
visible below the high-severity failure threshold. Scanner positive/negative
fixtures passed. Both command sessions exited and no scanner container or check
process remained; the heavy slot was released before PR delivery. CI remains
paused and unverified. No size label exists and self-review is not requested.

One explicitly authorized support email was sent and its final body/headers
verified. It asks for aggregate charge bounds, exact-model routing and separate
Luna image/billing support. No credentials, account IDs, attachments or private
source were sent. A clipboard conflict was corrected before Send; direct field
entry is the proposed shared lesson, with no shared instructions edited. No
provider reply is claimed. Later read-only account usage inspection could not
establish complete shared-scope history or pending liability. Sanitized receipts
and accounting evidence remain private under `.evidence/tokenrouter-live-integration/`.

Root corrected the diagnostic probe prerequisite: unknown response fields may be
observed later, with unavailable product output and the full reservation held.
Aggregate charge bounds, no substitution, verified shared-scope liability and
root's explicit allocation still precede a paid probe. No provider call, live
activation, database deployment, model substitution or CI action was performed.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: execute the database CLI through casing aliases

- Tracking: INFRA-001, PR #23, independent review R1. The prior correction failed the actual CLI execution criterion: the entry guard canonicalized argv but compared it with an unnormalized module path, so an uppercase absolute script alias exited successfully without running the command. Namespace helper tests did not prove CLI execution.
- Reproduced the empty output with a real PostgreSQL-backed subprocess test, then canonicalized both entry-guard paths. The regression checks nonempty status JSON and matching database, role and PostgreSQL version through the normal path and a same-inode casing alias. It runs the normal path on every platform and skips only the casing subtest on case-sensitive filesystems.
- Verification: nine PostgreSQL tests passed with no local skips, including actual alias CLI execution; pnpm check and pnpm security:check passed. Replacement hosted CI and independent review remain required.
- Classification: project implementation defect and insufficient end-to-end proof; no reusable guidance edited. Preserved stdin import guards, connection-target/TLS fixes and all existing data. No shared service restart or reset.

Corrected by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: worktree namespace and database configuration corrections

- Tracking: INFRA-001, PR #23. Reviewer provisioning exposed a failed acceptance criterion: case aliases of the same macOS directory produced different namespace hashes, so credentials provisioned through T3's uppercase path were unavailable to Node's lowercase runtime path. No incorrect reviewer database was provisioned.
- Reproduced alias mismatch and Node stdin import failure before the fix. Use filesystem-native canonical paths for root/provisioning/hash inputs and guard the CLI entry point before resolving a stdin marker. Added filesystem-backed same-inode case and symlink alias tests, plus a real stdin import regression. The case test explicitly skips only on case-sensitive filesystems.
- Independent review also reproduced pg query parameters overriding the validated host and TLS decision. Reject all URL query parameters, normalize network host aliases, set local TLS explicitly and retain verified remote TLS. Regression tests inspect pg Client effective connection parameters without network calls, including ambient PGSSLMODE and loopback aliases.
- Classification: project implementation defects; no reusable guidance edited. Existing owner database names/data stay unchanged. Verification passed: four focused filesystem/import tests (no local skips), pnpm check, security checks and seven real database tests. Provisioning through the uppercase alias created the native-path reviewer namespace; both reviewer databases accept its restricted role. Replacement CI and exact-head review are required; no shared service restart.

Corrected by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: local PostgreSQL and foundation checks

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: INFRA-001; [tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3), supporting roots #4/#6 without closing them. Base: `e87268368bc12d4909293228df7b311213a3ea6e`.
- Added one pinned PostgreSQL 17.11 Compose service, private local credentials, per-worktree development/test databases and restricted roles. Added TypeScript pool/transaction helpers, SQL migration checksums/locking, synthetic fixtures, safe own-test reset and reproducible lifecycle/proof commands. Root Expo layout and phone navigation are unchanged; no business tables, account/auth adapter, API or admin implementation.
- Repaired the baseline formatting failure and replaced web theme inline HTML with direct layout-effect initialization. System mode reads the current preference and cleans up its listener when mode changes. Original security rules remain enabled.
- Proof: `pnpm db:verify` passed real restart persistence, bidirectional namespace denial, preservation of peer/development data during own reset, repeatable migration/seed, exact single loopback binding and credential permissions. Seven database tests passed, including rollback, twelve concurrent increments, migration drift/missing migration and restricted privileges. `pnpm check`, frozen install, `pnpm security:check` and iOS/Android exports passed. Browser fixture of the actual web provider passed initial system mode and Light/Dark/System changes with zero inline scripts.
- Security scorecard: source secrets pass (one full repository snapshot); SAST pass (25 source targets, four unchanged rules); scanner acceptance/rejection fixtures pass; database isolation/rollback/concurrency pass (two namespaces and twelve writes); production local-seed/configuration denial pass. Confidence is high for these executed local boundaries; no claim of product authorization or cloud deployment proof. One pre-existing moderate UUID tooling advisory remains visible as SEC-001; no high/critical audit findings.
- Evidence: ignored `.evidence/local-infrastructure/`, including `db-verify.txt`, `security.txt`, `check-current.txt`, native export logs, theme screenshot and browser results. Commands and Azure setup gates: [local development](docs/operations/local-development.md). Shared PostgreSQL intentionally remains running on leased `127.0.0.1:55432`; owner is this infrastructure worktree, Compose project `amr-local-postgres`. Stop with `pnpm db:stop` only after consumers release it. Temporary theme server stopped; preview proof complete.
- Limits: Azure credentials/services, cloud transaction/deployment checks, production authentication and all product behavior remain pending their owners. Hosted PR checks and independent review follow delivery; no merge or cloud action authorized here. Operations serializes this branch's record integration.

Implemented by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: prepare final specification for main

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: SPEC-012; [implementation tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3).
- The user authorized committing and pushing the final-spec HTML to the existing private repository's main branch. Scope: the HTML snapshot, its documentation link and this task's steering/work records. Unrelated app, dependency, design, instruction and local planning changes are excluded.
- Verification: pending checks of the exact staged documentation and preserved worktree changes. The previously published Postplan page matches the HTML snapshot; rendered layout and interactions remain unverified.
- Delivery: preparing the authorized commit and push; no PR or application deployment requested.

Prepared by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: final specification HTML on Postplan

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: SPEC-011; [implementation tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3).
- Created [the HTML reading copy](docs/fan-app-final-spec.html) from the accepted specification, all 12 feature documents and the shared points/rewards design. Added a plain-language overview, contents navigation, expandable dependencies and all 82 acceptance cases. The Markdown feature specifications remain the maintained source; the HTML is a dated snapshot.
- Preserved the phone app, actual location assessment, capped 50-point fallback, difference-only later awards, shared submission model, paid voting and report extraction/review. Kept implementation choices and unimplemented status explicit. App code and the separate team brief remain untouched by this task.
- Proof: checked 320 source statements/table cells and 55 internal links; parsed HTML without errors; JavaScript syntax and Postplan validation passed. The local curl readback matched the 115,792-byte file. `pnpm agents:check` passed. Evidence is local in `.evidence/spec-html/`. Rendered layout, responsive behavior and interaction execution remain unverified because browser testing was not requested.
- External action: published [the final specification](https://dcv0l5eirsbh.postplan.dev) as public Postplan version 1. Both the public page and raw HTML returned HTTP 200 and matched the verified local file byte for byte. Excluded private repository links, identifiers and local paths from the document; process-scoped Git discovery isolation prevented repository metadata attachment, confirmed by reading back the draft metadata. No commit, GitHub push or application deployment was performed in this task.

Published by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: publish feature specifications

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: SPEC-010; [implementation tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3).
- The user authorized pushing the completed specification work to GitHub. Scope: the feature documents, glossary, decision records and tracker references. Unrelated app, dependency, design and agent-guidance work remains local; temporary plans and raw evidence are excluded.
- Corrected delivery-state wording to distinguish the committed Expo starter from separate uncommitted Home/navigation changes. Promoted the platform tracking conclusion into maintained internals guidance.
- Proof: frozen-lockfile installation and `pnpm check` passed in an isolated copy of the staged tree, including seven tooling tests and 26 maintained-document checks. Gitleaks found no source secrets; 115 added/changed local links and anchors passed. Corrected staged steering-table formatting after the first check reported it. No runtime product/UI validation is claimed.
- Delivery: verified for the authorized documentation commit and push to the existing private repository's main branch; implementation issues remain open.

Prepared by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: feature specification and ticket drafts

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: SPEC-007 through SPEC-009 under SPEC-001; [implementation tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3).
- Recorded the four approved decisions: a single-driver emissions baseline, extra time measured from the fastest route, difference-only top-ups after later GPS evidence and personal/community lifetime savings with separate official figures.
- Split accepted behavior into 12 feature documents. The main specification now links to their rules and acceptance cases; historical source sections remain unchanged. Updated the glossary, plan, module discussion, roadmap and documentation entry points.
- Prepared 19 issue bodies with 133 acceptance criteria. Each delivers an observable fan/admin flow; admin controls accompany the feature they operate. The user then explicitly requested creation for separate worktrees, superseding the planned to-tickets pre-publication quiz. Implementation prerequisites remain explicit.
- External action: created overview #3 and implementation issues #4 through #22 in the existing private repository. All implementation issues have native parent links, 24 native blocking edges, worktree handoff notes and the existing enhancement/ready-for-agent labels. The label does not bypass dependencies or decision gates. No pre-existing issue was modified or closed. No branch, worktree, commit, push, PR or deployment was created.
- Proof: preserved 69 original acceptance cases, updated the one late-evidence case and added 13 examples; 163 local links/anchors, acyclic ticket dependencies, historical sections and protected application/configuration hashes passed. `pnpm agents:check`, `git diff --check` and focused formatting passed. GitHub read-back confirmed all 19 bodies, 133 criteria, labels, parent links, 24 blocker links and reverse relationships. Product implementation and UI behavior remain unverified.

Prepared by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: one fan-submission feature

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: SPEC-006 under SPEC-001; unlinked.
- Failed criterion: the previous round kept questions and challenges as separate reward types and reopened selection grouping after the user said they were the same thing. Corrected the spec, glossary and related active plans to one fan-submission feature, one ranking and up to three selections total. Optional content tags do not change fees, voting or selection. This supersedes the earlier five-type count and preserves each accepted experience.
- The updated contract covers documentation and the remaining interview. Classification: project domain decision; no agent guidance changed. The 500-point fee, contributions from 10, moderation, backlog, fulfilment and demo-reset protections remain.
- Proof: `pnpm agents:check`, `git diff --check`, work/roadmap formatting and 20 relative links passed. Focused checks confirmed the shared selection examples, unchanged fees and preserved historical sections. No application code or external action; runtime behavior remains unimplemented. Journey correction, calculation and dashboard details remain open.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: shared question and challenge process

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: SPEC-005 under SPEC-001; unlinked.
- The user confirmed that driver questions and fan challenges use the same process. Recorded a non-refundable 500-point submission, admin approval, contributions of at least 10 points with equal ranking weight, and up to three selections at admin session close with earlier approval breaking ties. Applied the existing backlog, no-refund and selection lifecycle rules to both kinds of fan submission; all five reward types remain.
- Removed the question-pricing ambiguity from the spec, glossary and related plans. Remaining selection decision: whether questions/challenges compete for three places together or have three per type. GPS later-evidence handling and previously deferred calculations remain open.
- Classification: project product decision; no agent-guidance edit. No application code or external action.
- Proof: `pnpm agents:check`, `git diff --check`, work-record formatting, 17 relative links and focused shared-rule/acceptance-example checks passed. Application behavior remains unimplemented and unverified.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: GPS fallback accepted and paid voting confirmed

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: SPEC-004 under SPEC-001; unlinked.
- Recorded "ig" as acceptance of Q6: the smaller of 50 points and the expected journey award, only with start and arrival recorded. Confirmed that fans spend points to vote on driver questions, replacing the free-vote suggestion. Updated the active spec, glossary and affected documentation.
- The earlier 500-point rule is a non-refundable challenge submission fee, with separate contributions of at least 10 points and up to three selections at admin session close. The user's reference to that rule needs clarification before applying the whole process to driver questions; no 500-point vote price was inferred.
- Classification: project product decisions. No agent guidance changed. Endpoint quality and later-evidence handling remain open.
- Proof: `pnpm agents:check`, `git diff --check`, work-record formatting, 19 relative links and focused checks for the recorded fallback examples, endpoint prerequisite and paid-vote rules passed. No application implementation, device test or external action.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: report extraction, GPS fallback and question votes

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: SPEC-003 under SPEC-001; unlinked.
- Recorded the user's next answers: upload reports and extract supported details; small awards for missing GPS, with about 50 points tentative; select the highest-voted driver questions; retain the 2,000-point journey cap without an added daily cap. Updated the spec, glossary and affected plans. Existing report approval and provenance rules remain in place.
- Open: fallback amount, minimum evidence, relationship to a smaller normal award and later evidence; question vote cost/unit, selection count, cutoff, ties and demo participation. A fallback must not imply verified travel or avoided emissions. The user did not supply content after "6.", so no sixth decision was inferred.
- Guidance classification: project product decisions. The user's fallback and voting choices replace the assistant's proposed manual review and discretionary selection. No agent guidance changed.
- Proof: `pnpm agents:check`, `git diff --check`, work-record formatting and 19 relative links in the affected active documents passed. Read back the revised spec and reconciliation; obsolete ingestion/selection uncertainty was removed and the fallback amount remains tentative. These are requirements for future implementation; no application behavior or device tracking was tested.
- External action: none.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: phone app and real-journey scope confirmed

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: SPEC-002 under SPEC-001; unlinked.
- The user confirmed the phone app, real journeys checked using location and five rewards: driver questions, tree dedications, exclusive content, fan challenges and merchandise discounts. Updated the active specification, glossary, reconciliation, plan, roadmap and affected architecture/reward/user documentation. Labelled demo activity and its existing reset protections remain separate from real journey awards.
- Failed criterion in the earlier plan: real travel was deferred and the platform/reward scope remained unresolved. Classification: project product decisions. The updated contract covers documentation and the requested interview; no agent-guidance edit or app implementation is included.
- Proof: `pnpm agents:check`, `git diff --check`, 26 local document links and focused checks for stale simulation-only requirements passed. Formatting passed for `ROADMAP.md` and `work.md`; `bug.md` has an existing formatting warning, reproduced against its pre-edit copy. Remaining interview topics include missing location evidence, ESG ingestion and question selection; calculated-award details remain open. No device behavior was tested.
- External action: none.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: new technical-spec comparison

- Owner: gpt-6-sol through Codex (T3 Code). Tracking: SPEC-001; unlinked.
- Compared the supplied draft with the current product specification, glossary, architecture status and Expo shell. Added shared route, emissions and ESG provenance requirements; recorded conflicting POC choices in `docs/technical-spec-reconciliation.md` without silently replacing prior product decisions.
- Defined official reported metric and app-community estimate in `CONTEXT.md`. A focused research note records official browser and Expo tracking limits. No ADR is warranted before the platform and evidence choices are accepted.
- Proof: `pnpm agents:check` and `git diff --check` passed; affected links and code status were checked. No app behavior was changed or device behavior tested.
- External action: none. Product decisions and implementation remain pending the requested interview.

Edited by gpt-6-sol through Codex (T3 Code).

Keep compact entries: date, issue/inbox ID, maintainer or agent, owned area,
outcome, proof, limits and external actions. Do not paste transcripts, credentials,
raw research or detailed implementation plans. Update after a material change
and before handoff.

## 2026-09-25: native bottom tabs

- Owner: gpt-6-sol through Codex (T3 Code). Tracking: UI-003; unlinked.
- The user corrected the navigation choice to standard bottom tabs. Replaced
  the custom dock with React Navigation tabs for Home, Travel, Rewards and
  Impact. The latter three show explicit placeholders because their product
  screens are not built. Kept Lucide icons and Home content.
- Added `@react-navigation/native`, `@react-navigation/bottom-tabs`,
  `react-native-screens` and `lucide-react-native`. Removed the custom dock
  and its `expo-blur` dependency. NativeWind v5 and TypeScript remain.
- Proof: `pnpm check` and iOS/Android Expo exports passed. On an iPhone 17
  Pro Max simulator in Expo Go, Home rendered and taps opened Travel, Rewards,
  Impact and returned Home. Screenshot:
  `.evidence/native-tabs/iphone-17-pro-max.png`. An older Metro process briefly
  displayed a stale module-resolution error; the current app loaded on the
  active project server.
- External action: no commit, push, PR or deployment.

Edited by gpt-6-sol through Codex (T3 Code).

## 2026-09-25: tab bar color and selection

- Owner: gpt-6-sol through Codex (T3 Code). Tracking: UI-004; unlinked.
- Changed the standard tab bar to AM green `#04524B` and placed a gray circle
  behind the selected icon. Icons and labels remain visible and tabs still
  switch views. This is a one-off visual correction to the supplied screenshot.
- Proof: inspected Home and Rewards selected states on the iPhone 17 Pro Max
  simulator. TypeScript, ESLint and formatting checks passed.
- External action: no commit, push, PR or deployment.

Edited by gpt-6-sol through Codex (T3 Code).

## 2026-09-25: home and tabs visualization

- Owner: gpt-6-sol through Codex (T3 Code). Tracking: UI-002; unlinked.
- Initial home concepts failed the user's content and dock-style criteria.
  This is a one-off correction. Revised three options at
  `/tmp/amr-home-tabs/revision.html`, each with fan/race updates,
  points/rewards and team impact. They vary only navigation style and keep
  ordinary travel reachable, zero starting points and Rewards' confirmed tabs.
- Inspected relevant Mobbin screens for sports and loyalty navigation patterns.
  A further revision at `/tmp/amr-home-tabs/mobbin-inspired.html` uses the
  Formula 1 lead-story layout, Qantas points hierarchy and NBA section rhythm
  as visual references. It links each source screen and keeps placeholder
  content distinct from actual published updates and sourced ESG figures.
  The user then supplied a floating translucent navigation reference. A focused
  revision at `/tmp/amr-home-tabs/glass-navigation.html` applies its capsule,
  icon-and-label destinations and lighter selected inset to the story-led Home.
  Proof: read the local HTML and checked headings, tabs and placeholder labels
  against `DESIGN.md` and the specification. Browser rendering and native
  interaction remain unverified. Selection is pending; the Expo app is unchanged.
- External action: no publication, commit, push, PR or deployment.

Edited by gpt-6-sol through Codex (T3 Code).

## 2026-09-25: phone UI library setup

- Owner: gpt-6-sol through Codex (T3 Code). Tracking: UI-001; unlinked.
- Added gluestack UI with NativeWind v5 and Expo-compatible Reanimated/Worklets.
  Kept the starter content and unselected design direction. Documented library
  usage in `AGENTS.md`.
- Proof: frozen install, `pnpm check`, and iOS/Android Expo exports passed.
  The supplied Expo Go crash report predates the library install and does not
  show its JavaScript error. The later device request verified the dark starter
  screen on an iPhone 17 Pro Max simulator through a fresh Metro session.
  Screenshot: `.evidence/ui-library-device/iphone-17-pro-max.png`.
- External action: no commit, push, PR or deployment.

Edited by gpt-6-sol through Codex (T3 Code).

## 2026-09-25: portable agent workflow and security setup

- Owner: gpt-6-astra through Codex (T3 Code). Maintainer request: Nachiketh.
- Tracking: AGENT-001 in `bug.md`; unlinked because no issue creation was requested.
- Owned area: root guidance, new documentation/skills, security tooling, GitHub
  templates/workflows and focused check configuration.
- Protected work: design artifacts, product specification, existing glossary
  meanings, historical TODO entries and starter behavior.
- Status: implemented and verified locally. Existing unselected design artifacts
  remain unchanged and are excluded from code formatting. Dependency audit found
  the triaged moderate tooling advisory SEC-001; no advisory is suppressed.
- Initial setup external action: enabled requested GitHub Discussions and read back the Ideas
  category. Repository remains private. No post, issue, PR, commit, push, deployment
  or browser/device verification.
- Correction: licensing scope withdrawn; classified as one-off task scope.
  No license file or package license field was added.
- Correction: the skill-folder criterion is automatic discovery. The user chose
  `.agents` after learning `.agents.local` is not a standard loader path.
  Classification: project guidance. Removed `.agents` ignore rules, retained
  `.agents.local/` for optional personal material, and restored the 38 existing
  skills without overwriting the seven new ones. Claude links cover all 45.
- Proof: `pnpm check` passed, including seven runner tests and 45 skill/link checks.
  Frozen installation and checks passed in a fresh temporary source copy without
  the original dependencies or private config. iOS and Android exports passed.
  Gitleaks found no source secrets; four Semgrep rules found no source findings;
  clean/unsafe scanner fixtures passed, including all four source rules.
  ZAP 2.17.0 accepted the safe HTTP fixture and rejected the unsafe fixture with
  two medium alerts and one explicitly blocking header alert. Resource cleanup
  was checked. Actionlint accepted both workflow files.
- Compatibility proof: Pi 0.84.4 discovered all seven AMR skills through offline
  RPC without a model request. All 45 skill names/descriptions and Claude links
  were validated. Claude CLI behavior remains unverified because it is unavailable.
- Limits: hosted CI awaits an authorized push. Application DAST is not applicable:
  there is no HTTP app, backend or AI pipeline yet. Their security requirements
  are documented, not claimed implemented. Browser/device checks were not requested.
  Existing general skills were preserved, not all behavior-tested.
- Evidence: local `.evidence/agent-workflow/verification.md` and
  `.evidence/agent-workflow/results.json`; raw scanner reports remain ignored.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: Azure direction and current device state

- Owner: gpt-6-sol through Codex (T3 Code). Tracking: BACKEND-001 and DEVICE-001; unlinked because no issue creation was requested.
- Changed locally: the active specification and architecture now select Azure for the backend. The old Convex placeholder is marked superseded. Specific Azure services, authentication and transaction design remain open. No backend code or deployment was added.
- Device proof: launched the Expo starter in Expo Go on an iPhone 17 Pro simulator. Its visible screen shows "AMR Fan App" and "Development starter" on a dark background. Product workflows remain unimplemented.
- External action: no commit, push, issue, PR or deployment. The device session and local Metro server were started for inspection.

Edited by gpt-6-sol through Codex (T3 Code).

## 2026-09-25: focused skills and authorized local delivery

- Owner: gpt-6-astra through Codex (T3 Code). Maintainer request: Nachiketh.
- Tracking: AGENT-005 and AGENT-006; unlinked because no issue creation was requested.
- Correction: preserving every imported skill failed the requested relevance
  criterion. Classified as project guidance. Keep workflows used by this app
  and consolidate overlapping task entry points.
- Changed: added the requested `file-pr` from the installed skill, with project
  contribution rules. Removed 31 unrelated or overlapping skills and their Claude
  links, including duplicate PR, implementation and diagnosis workflows, classroom
  exercises, article writing, personal handoffs and one-time setup. Fifteen skills
  remain. Removed files have a temporary local backup outside the repository.
- Protected: global skills, app code, dependency lockfile, existing design work
  and historical task records. Design references now identify those separate
  uncommitted inputs so the workflow commit does not depend on unstaged files.
- Delivery scope: the user authorized a local commit only. No push or PR.
- Proof: `pnpm check` and `pnpm security:check` passed after cleanup. All 15 skill
  names, descriptions and matching Claude links passed validation; `file-pr`
  passed the skill validator. A fresh snapshot of the staged files passed frozen
  installation and `pnpm check` without the separate design files or local task
  edits. The existing moderate dependency advisory remains tracked as SEC-001.
- Status: verified for the authorized local commit. Git history records delivery;
  hosted CI remains unverified until a separately authorized push.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: GitHub delivery authorization

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: AGENT-007; unlinked.
- The user requested committing and pushing the completed setup. Implementation
  commit `82efb87` already exists. This authorization supersedes the earlier
  local-only delivery scope and targets the configured `origin/main` on GitHub.
- Preflight: authenticated GitHub access; remote main is the implementation
  commit's parent. The app and dependency lockfile remain unchanged. Separate
  design files and local `TODO.md` edits are excluded from delivery.
- Proof: the implementation passed local checks, security scanner tests and a
  fresh staged-snapshot install/check. Delivery repeats the applicable local
  gates before pushing; GitHub's branch and Actions runs record the remote result.
- Scope: push the setup and this authorization record. No PR, deployment,
  repository visibility change or browser/device verification was requested.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: account #4 identity and API foundation

- Tracking: [#4](https://github.com/NachikethReddyY/AMR-Fan-App/issues/4), under #3.
  Base `050d5035bd69f476cbcc51d252d1456df58ed947`, owned account worktree.
- Implemented configurable OIDC access-token verification, server-owned real/demo
  profiles with zero initial balances, hashed revocable sessions, assigned roles,
  owner-only profile reads/renames and the transaction/row-lock interface for #5.
  Native account/session code uses SecureStore and code/PKCE, with a separate
  labelled development fixture selector. No points operations or admin web added.
- Observed proof: four token/config tests, five native session tests, ten real
  HTTP/PostgreSQL account tests and nine foundation PostgreSQL tests pass.
  Cross-account reads/writes, forged role/owner fields, invalid token claims,
  concurrent creation, role revocation, restart/resume and logout are exercised.
  Full local checks, source/dependency security checks and both native exports
  passed before final UI observation. Isolated application DAST passed with
  zero alerts on the public unauthenticated API; authenticated boundaries have
  separate HTTP tests.
- Local performance sample: three sequential requests, sign-in 41.04 ms/360 bytes,
  resume 2.67 ms/255 bytes, logout 4.09 ms/18 bytes. Synthetic loopback sample of
  one per operation; no deployment or comparative latency claim.
- Remaining verification: actual leased Android/iOS interaction, required largest
  Dynamic Type/accessibility evidence, live provider provisioning, hosted checks and manager-scheduled independent exact-commit Astra review.
  No external tenant, admin identity, cloud resource or deployment was invented.
- Evidence: ignored `.evidence/account-4/`; sanitized setup and API contract in
  [account operations](docs/operations/accounts.md). Database and API leases are
  isolated; shared PostgreSQL lifecycle remains with infrastructure.

Edited by gpt-6-astra through Codex (T3 Code).

### Account #4 server/UI delivery split

The verified server candidate is on `feat/4-account-api`. Prepared phone code is
preserved in commit `7879ebf` on `feat/4-account-identity`, with actual Android
A/B sign-in, name persistence, demo resume, logout and largest-text scroll proof.
Required small-iPhone/VoiceOver proof remains unavailable after the supported
new-device setup failed; existing occupied iPhones were untouched. The server
candidate excludes native dependencies, app scheme/plugins and UI changes.
Issue #4 remains open. Android tab labels truncate at the largest text size; the
held UI requires the authorized focused correction/proof before final acceptance.
Server-only frozen install, full checks, security, ten HTTP/PostgreSQL tests,
nine foundation tests and both unchanged native exports pass. The launcher
controlled process test and actual API start/owner SIGTERM/closed-port proof pass.

Edited by gpt-6-astra through Codex (T3 Code).

### Account #4 integrated dependency candidate

Rebased the server branch after PR25 merged and all four postmerge checks passed
on `0740a3c731c44e74a4f9a1cef122e271bcbaf126`. Resolved package scripts and
environment examples by retaining both AI and account contracts. The frozen
lock includes `zod@4.1.12` and `jose@6.2.2`; both AI flags remain false.
AI source and its reviewed documentation are unchanged. Native source and
dependencies remain on the held mobile branch, outside this server candidate.
Frozen install, full checks (including both test suites), security, ten actual
HTTP/PostgreSQL account cases, nine foundation cases and both native exports
passed again on the integrated dependency tree. Evidence is kept under
`.evidence/account-4/integrated-*`; current-head CI and independent review follow
the authorized push. Issue #4 and the recorded platform/provider gaps stay open.

Edited by gpt-6-astra through Codex (T3 Code).

### Account #4 independent launcher correction

PR27's independent review found the owned-group cleanup gap described in
ACCOUNT-004-R1. The author reproduced the exact probe, captured a failing
regression, then retained shutdown escalation until the owned group terminated.
Three process tests pass: stubborn-descendant cleanup with unrelated-process
survival, normal success/nonzero outcomes, and service lifetime beyond a bounded
one-shot timeout. The reviewer probe now reports no surviving descendant, and
the actual API starts, remains usable and releases its port on owner SIGTERM.
Only launcher code/tests and these records changed. The account/API/migration
and isolated DAST target are unchanged; prior PostgreSQL and 61-check DAST proof
remain applicable. Full repository/security checks are rerun before delivery.
Mobile PR28 stays separate and preserved; a new server head requires exact-head
independent review and a subsequent mobile rebase. Evidence: ignored
`.evidence/account-4/launcher-descendant-*` and `review-fix-*`.

Edited by gpt-6-astra through Codex (T3 Code).

## PR39 conflict refresh, 2026-09-26

The prepared branch already rebased all nine PR commits onto main `4efa304`.
Range comparison found eight identical patches and only API registration context
changes in the ninth. Participation source, tests and migration 0009 are unchanged
from the published PR; main's authentication and journey changes are retained.
Pre-existing hosted sign-in edits are saved separately and excluded from delivery.

Frozen install, full `pnpm check` and `pnpm exec expo export --platform all` passed.
The first check ran beside the export and failed the unchanged AI transport
test's 40 ms request-count assertion. A serial full rerun passed without source
changes. Security checks passed: no detected secrets, zero SAST findings across
166 targets, successful scanner fixtures, and no high/critical dependency
advisories. The previously triaged moderate UUID advisory remains. Raw proof is under
`.evidence/pr39-conflict-refresh/`. Database integration, DAST and rendered UI
were not rerun for this bounded conflict/build refresh. Existing hosted Actions
pause is preserved; no CI queries, workflow changes or merge are part of this task.

Verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: prepare retained Supabase participation upgrade

- Tracking: DEPLOY-009, unlinked. Base: `09b61e9213d4d08d986621439f9f16c453cc87d7`. One bounded deployment-tool correction; no mobile, admin-origin guard, migration SQL, dependency or CI edits.
- Reproduced the existing bootstrap returning unchanged at eight migrations. Added an explicit checksum-guarded eight-to-nine transaction using the existing migration owner, scoped table/column/sequence/function permissions, collision refusal and verified replay. Existing role identities/passwords, prior ledger timestamps, peer rows and existing ACLs are preserved in real PG17 proof.
- Six isolated bootstrap/API/upgrade tests pass, including restricted real login and writes, role/DDL denial, direct/PUBLIC database CREATE refusal, late DDL failure rollback, object collisions, checksum drift, immutable prior ledger, anon denial and replay. Owned no-host-port/internal-network container, image and network removed. Security gate passes with zero source findings and the existing moderate dependency advisory.
- Hosted read-only receipt confirms Free Render, auto-deploy off and live674273. Supabase has matching migrations0001–0008, no0009 and a restricted amr_api role. Existing ADMIN_ORIGIN is https://amr-fan-app.onrender.com. Preserve it; pending ADMIN_ADDITIONAL_ORIGIN=https://amr-admin.vercel.app requires the admin owner's reviewed candidate and manager deployment window. Prior hosted identity proof is a synthetic fan only; no admin was assigned.
- No cloud/config/auth/SMTP mutation, source publication, production migration, deployment or Actions call. Exact integrated guest catalogue and admin-origin candidates remain pending. Evidence: `.evidence/participation-deployment-readiness/`. Full local gate result is recorded in the handoff; an initial unrelated AI40ms timeout test failure is retained honestly.

Implemented by gpt-6-astra through Codex (T3 Code).

### Account #4 held mobile stack and tab correction

The phone stack now follows server PR27's frozen `77776c0` candidate. It retains
all prepared account source, public native configuration and SecureStore/PKCE/
Geist dependencies. The server PR has none of those additions. Five native
session tests cover persisted sign-in/demo selection, restart, expiry, offline
resume and durable logout intent. Prior synthetic A/B Android identity, profile
persistence and logout evidence is preserved.

The observed largest-text navigation defect is corrected with wrapped labels,
measured bar height and explicit accessible tab names. On leased Pixel Android
16 at font scale 3.2, all four labels are fully visible; tab selection reaches
the expected screen and exposes selected state. Scale 1.0 retains the normal
bar geometry. Frozen install, full checks, security and both native production
exports pass on the integrated stack. The original font scale 1.0 was restored,
both device sessions closed, and owned Metro stopped with a fresh port bind
confirming release. No iPhone was used.

This is partial #4 delivery. Live OIDC issuer/client/scope/redirect setup and
required small-iPhone Dynamic Type/VoiceOver proof remain pending. API ownership
comes only from verified server sessions; native public identifiers grant no
authority. Evidence remains local under `.evidence/account-4/`.

Edited by gpt-6-astra through Codex (T3 Code).

### Account phone continuation on repaired main

PR28's three mobile-only commits were replayed onto reviewed main
`8e346aff606771662312697effe8fbff1742f131`. The only conflict joined the current
server route environment examples with the already prepared public native auth
entries; both were retained. The six native dependencies, app scheme/plugins and
lock changes are unchanged in scope. No server, route source, CI or script was
copied from the old API ancestry. Original head `8d9e2e5`, TODO and raw evidence
remain preserved in the owned checkout's ignored evidence and Git history.
Frozen install, full checks, security and both native exports pass. Root/native
configuration is frozen for lease release before the balance/History UI work.
Devices remain inactive pending an explicit resolved app-session lease. Required
small-iPhone/VoiceOver and live provider evidence remain unavailable.

Edited by gpt-6-astra through Codex (T3 Code).

### Phone current balance and History candidate, #4/#5

Home, the account sheet and Rewards now share the current selected-profile
balance from the existing authenticated History endpoint. Rewards retains the
accepted Redemption/History sections; Redemption reports unavailable. The phone
validates pages, preserves server order and opaque cursors, and displays changes,
reasons, resulting balances and times without calculating a balance. It clears
state on profile/session changes, logout or expiry and ignores stale responses.
Refresh, outage and pagination retry states are scoped to the active profile.
No server, route, root dependency/config, CI or script changes follow the root
freeze. No reward purchase, vote, reset or journey behavior is claimed.

Thirteen focused account/History state cases pass. The new phone adapter proof
runs against real HTTP/PostgreSQL with unique controlled identities and legitimate
assigned-admin adjustments. Five nested cases pass: zero-state/ownership,
31 entries over 25+6 pages and maximum balance, server/pool/controller restart,
outage recovery/offline logout, and expiry with unchanged History. In-memory
storage stands in for SecureStore in this proof; native restart is not established.
Full checks pass, including 45 native Jest cases. Frozen install, security checks
and both native production exports pass. Security scanning reports no source
findings; audit retains one moderate transitive uuid advisory and no high/critical
findings. No dependency upgrade was attempted under the released root lease.

One local first-page sample used one request, 25 entries, 7,993 decoded JSON bytes
and 4.9 ms. This is not a device or production latency benchmark. Hermes artifacts
grew from 6,014,003 to 6,471,787 bytes on iOS and 6,016,723 to 6,475,259 on Android
against the root integration export. Rendering, memory and device latency remain
unmeasured. API55436 was closed and passed a fresh bind/close check; no Metro or
device session was started. Only the owned disposable test namespace received
migrations and synthetic fixtures; shared database lifecycle was untouched.

Mandatory UI HOLD: new balance/History interaction and normal/largest-text Android
proof are unverified because supported app-session ownership is unresolved.
Historical Pixel account/tab evidence remains only for unchanged lineage; the
four-label wrapping/height/normal geometry implementation is preserved. Small
iPhone largest Dynamic Type, actual VoiceOver and live OIDC remain pending.
PR28 is partial #4/#5 delivery, with exact-head independent review and CI/bot
monitoring handed to the manager. No merge or whole-issue completion is claimed.
Commands and raw evidence remain under ignored `.evidence/account-4/continuation-*`
and `history-*`; reproducible commands are in `docs/operations/points.md`.

Edited by gpt-6-astra through Codex (T3 Code).

### PR28 phone foundation refresh, 2026-09-26

Related to #3, #4 and #5. Replayed only the six owned mobile commits after
8e346aff onto manager-selected f51a25ca. Preserved original 0b24ce7 and local
TODO/evidence. No server, scripts or CI changes. Frozen install, full check,
security check and Android/iOS static exports pass. Root reconciliation keeps
only the six prepared native dependencies, auth scheme/plugins and public
configuration; all main scripts and PDF dependency remain intact. Root is frozen
and released at this commit. Native interaction remains held.

Edited by gpt-6-astra through Codex (T3 Code).

### Selected walkthrough and floating dock, 2026-09-26

Implemented the selected short introduction, account/name setup and top completion
line, with reduced-motion support. Keeps completed navigation mounted during
session refresh; guest sign-in still requests a name. Applied the accepted
#081310 background, #004A4D controls/cards and dark inset four-tab dock.
Four component regressions and the full pnpm check pass. Native animation,
large-text layout and installed-build interaction remain unverified for this
new slice. Earlier native receipts describe earlier code only.

Edited by gpt-6-astra through Codex (T3 Code).

### Confirmation resend cooldown, 2026-09-26

Added a per-flow send reservation before signup/resend I/O and a disabled
countdown control. Immediate repeated requests stop locally; requests after
60 seconds reach the provider. Failing-first regression and 39 focused
auth/session tests pass, plus typecheck, lint and format. No SMTP setting,
account or provider rate limit changed. Native display and inbox delivery
remain separate acceptance checks.

Edited by gpt-6-astra through Codex (T3 Code).

### Onboarding draft review correction, 2026-09-26

Independent standards and specification reviews found the same defect: a
foreground session refresh cleared an unfinished name. Reproduced with a
failing component test, then retained the draft for its account while clearing
it on an actual account change. Five onboarding component cases and typecheck
pass. Native proof remains pending.

Corrected by gpt-6-astra through Codex (T3 Code).

### Password-only account flow, 2026-09-26

PR28 now removes confirmation-code/resend controls, exports and session state.
Signup requires an immediate validated provider session before the AMR exchange;
a provider still requiring confirmation returns an error without local authority.
Existing password sign-in, cancellation, stale completion revocation, private
session persistence and account/profile ownership remain unchanged. No hosted
configuration or existing account was modified by this implementation.

The inherited failing-first signup test reproduced the old confirmation result.
Focused auth/session checks and an integrated signup-to-name component case pass.
The latter runs the email flow and session controller, stubs provider I/O and
secure storage, and observes name setup before app entry. It does not establish
hosted signup. Full checks and exact installed-native proof follow separately.

Edited by gpt-6-astra through Codex (T3 Code).

Full serial `pnpm check` and `pnpm security:check` passed for this slice. Secret
and source scans reported no findings; dependency audit retained one moderate
advisory and no high/critical findings. Hosted CI remains paused and was not
queried. Installed-native acceptance follows this source checkpoint.

Verified by gpt-6-astra through Codex (T3 Code).

### Automatic signup handoff correction, 2026-09-26

The independent requirements review found that successful signup kept the
Account sheet open and delayed name setup. A failing test with the actual panel
reproduced its missing close notification. The panel now closes after its current
password authentication succeeds; cancellation, mode changes and unmount invalidate
the local attempt. A late cancelled result cannot close a reopened sheet.
Seven focused panel/onboarding tests and typecheck pass. Standards review found
no actionable issues in the preceding password-only slice. This correction will
receive follow-up review and native proof before delivery.

Corrected by gpt-6-astra through Codex (T3 Code).

### Native dock background correction, 2026-09-26

Pixel installation of internal APK b119106 exposed a white root background around
the accepted floating dock. Applied the existing screen background to the root
provider without changing dock geometry. Direct native development observation
shows the dark margins, all four tabs and successful synthetic password signup,
automatic name setup, saved name and zero server balance. Hosted guest catalogue
still returns 401; the installed release correctly reports offers unavailable.
The exact backend change remains 405739286063f77fdd50def2e02ddfb9da914239.
This is a bounded visual correction. Final user APK waits for the separately
owned, frozen photo-entry integration and remaining acceptance.

Corrected by gpt-6-astra through Codex (T3 Code).

## PR28 main refresh, 2026-09-26

Resolved current `origin/main` against PR #28's published head in this thread checkout.
The three conflicts were `.env.example`, `bug.md` and `work.md`. The environment
example retains native public OIDC identifiers and the server-only Supabase and
report storage settings. Both branches' records remain. No product source needed
a manual conflict resolution. The separate account worktree and its unpublished
commits and edits were not changed.

While local verification ran, another writer published merge `955b9a1` with the
same two parents. GitHub then reported PR #28 mergeable. Its product tree matches
the locally verified resolution; only record text and spacing differ. This checkout
was aligned to the published merge without replacing its history.

Frozen install, full `pnpm check`, `pnpm security:check` and production Expo
export for iOS and Android passed. Security scanning found no source issues;
the dependency audit retains one moderate advisory and no high or critical
findings. No device or browser was used, so native interaction remains unverified
in this refresh. Existing PR28 acceptance holds remain open.

Verified by gpt-6-sol through Codex (T3 Code).

### PR28 password-only native proof, 2026-09-26

Source f3acfab passed sequential Pixel Android 16 and iPhone 17 Pro iOS 26.5
observation. Synthetic signup immediately exchanged provider and app sessions,
closed Account, requested a name, and entered Home at zero server points. Both
platforms passed sheet close/reopen, all four destinations and largest supported
text. iPhone draft text survived live Dynamic Type changes. Pixel cold restart
restored the synthetic session. Logout removed both synthetic accounts' access;
guest catalogue displayed existing stored test offers through the actual local
API. These fixtures are not live email, Maps, AI, fulfilment or real journey proof.

The b119106 internal ARM64 APK was signed, installed without data reset, and shown
in the Pixel panel with walkthrough and hosted unavailable states. Its observed
white dock margin prompted f3acfab, proved on both native development platforms.
A separate f3acfab internal APK was built with embedded hosted configuration,
verified signature and 16 KiB alignment. Final user APK remains held for the
separately reviewed photo integration. No photo source, package or lock changes
were copied from its unfrozen candidate.

Two independent review axes cleared b119106 and the one-line f3acfab correction.
Full repository and security checks passed on the corrected authentication slice;
62 focused state/auth/catalogue cases passed afterward. Local evidence under
`.evidence/password-only/` includes real MP4s, screenshots, build receipts and
cleanup. The synthetic service reports two signups, two exchanges, two logouts,
all owned sessions revoked, pool closed and all four ports released. Android
scale 1.0 and iPhone large restored; no iPad or real-account credentials used.
Small-iPhone/VoiceOver and live signup remain unverified.

Before push, remote PR28 had advanced to 25a79f7 with main integration and records.
Merged it without rewriting history; conflicts were only the two append-only
records, both preserved. Product tree remains identical to reviewed f3acfab.
Hosted CI remains paused, with no Actions query, rerun or merge.

Verified by gpt-6-astra through Codex (T3 Code).

The f3acfab internal APK was subsequently installed on Pixel without uninstall
or data reset. Its embedded release bundle opens Home and all four tabs with the
corrected dark dock margins; new screenshots and a recording confirm this exact
artifact. It remains an internal checkpoint, not the final photo-enabled APK.
Both device sessions are now closed and available for coordinated photo proof.

Verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: PR28 reviewed photo client integration

- Imported only the reviewed photo client and tests from `ca71166bce7d576f943af36e67a5cc2551c848ae`, plus Expo SDK 57 image-picker/file-system dependencies. No server award hook, migration, sharp dependency or API registration is included.
- Home now opens the system camera and review flow. Its captured identity survives ordinary session refresh; session-controller intent notifications close private drafts before logout, replacement sign-in, profile switch or confirmed expiry. Actual Home blur closes the flow. Availability 401 uses the existing matching-token expiry guard.
- Camera/library/audio configuration is camera-only. Checks can only GET availability with current authority; no photo or description is transmitted, and no live AI or credit is enabled.
- Focused proof: six failing-first identity cases now pass, 50 session/camera unit tests and 14 photo component tests pass. These use controlled adapters and do not establish native camera behavior. Full local checks, security checks, frozen install and iOS/Android exports passed. The first full run hit the existing 40 ms AI transport fixture deadline under simultaneous native compilation; the complete rerun after compilation passed without source changes. Native evidence pending. Node 24.20.0 is available and used.

Implemented by gpt-6-astra through Codex (T3 Code).

PR28 delivery correction, 2026-09-26: the user requires branches to integrate only through file-pr and squash merge to main. Finish the already-imported photo client only; do not copy more branch work. Rebase current main before final review, preserve TODO, report exact reviewed head to the coordinator, then wait for its serialized merge turn. Squash merge is now authorized when applicable gates and branch protection pass, without admin bypass. CI remains paused by the user, so Actions/checks queries, reruns and re-enabling remain prohibited. Live AI and unrelated final APK acceptance do not block this safe disabled-client slice. Classification: project delivery correction; shared guidance unchanged.

Recorded by gpt-6-astra through Codex (T3 Code).

### Photo integration delivery proof and main refresh

PR28 rebased onto merged main `3d48287b25d2ac058d0408f973b133c8041e2d37` after
PR44 and PR45. Historical environment/import/document conflicts preserve both
intents; mobile source/configuration/dependencies remain byte-identical to
`46de016`. Inherited TODO was restored byte-for-byte. No further feature branch
work was copied. Both independent source reviews cleared `4634c574`; exact final
records review follows.

Full serial checks and security passed on the PR44-integrated tree. After PR45's
server-only AI additions, typecheck passed and the mobile-tree equality check
requires no new native rebuild. Previous iOS/Android exports, frozen install,
50 focused session/camera unit tests and 14 component tests remain applicable.
Native evidence and explicit iPhone capture limits are recorded in
`docs/operations/native-acceptance.md`. Exact internal APK was installed/shown on
Pixel; camera proof used synthetic scenery/accounts in Expo Go. No photo upload,
AI inference or award occurred. All owned device/settings/services are cleaned.

Guest rewards still needs deployment of PR28's public catalogue change, originally
`405739286063f77fdd50def2e02ddfb9da914239` (rebased equivalent in this PR).
Photo backend registration, live AI and final user APK acceptance remain separate.
No Actions/checks API query, cloud mutation or merge has occurred in this proof
stage. Delivery awaits final-head review and the coordinator's serialized squash
turn; branch protection must pass without bypass.

Verified by gpt-6-astra through Codex (T3 Code).

### Photo activity original candidate, 2026-09-26

Historical source: `ca71166`. Client delivery subsequently moved to PR 28.
Current server-only scope and deployment gates are recorded below.

Implemented selected photo-first camera/review/description module with camera-only
permissions, denial/retake/cancel states, transient capture cleanup and a disabled
availability check that sends no photo/description. App/auth/dock and production
API registration remain owned by mobile/infra; exact proposed integration is in
[photo handoff](docs/internals/photo-activity-integration.md).

Added bounded in-memory image decoding and canonical pixel hashing, immutable
minimal claim migration 0010, disposable-only synthetic accounting proof and
same-journey preliminary credit integration. Production activity credit and AI
remain unavailable. Changed-photo same-action identity and unlinked-photo journey
matching remain unresolved. A receipt/hash does not establish fraud prevention.

Observed proof: 8 activity PostgreSQL/HTTP tests and 13 existing award PostgreSQL
tests pass against an owned disposable PostgreSQL 18 container. Test counts are
not assertion counts. Focused camera/lifecycle tests, full pnpm check and security
check pass. Native camera/permissions/accessibility remain unverified pending
PR28's device release. A 16 MP decode peaked at 196.55 MiB RSS on macOS/Node24;
Render Linux 512 MB whole-process fit remains unverified. No provider calls,
cloud/shared database changes, CI queries or device use occurred.

Edited by gpt-6-astra through Codex (T3 Code).

### Photo SPEC review correction, 2026-09-26

Fixed the proposed signedIn/token mount guard that disposed photos during account
foreground refresh, and the first-render check callback that retained stale
session authority. New owned PhotoActivitySession retains the captured account
identity through loading, blocks requests during loading, checks current session
authority at dispatch, aborts a pending request on authority/token change, and
unmounts on logout/expiry/account or profile change. The handoff now requires the
mobile owner to close immediately before explicit logout/switch/known expiry;
the current controller's loading state cannot distinguish those from resume.
No App/auth/dock registration changed.

Ten photo component regressions pass, including same-account refresh, current
callback/token, late camera return, identity loss and in-flight cancellation.
Full pnpm check and security check pass. The previous 8 activity database/HTTP
and 13 award database proofs remain applicable to unchanged accounting; no new
DB/service/device run occurred. Native system-camera foreground behavior remains
unverified and assigned to the mobile owner. Added a matching 5-second timeout to
the second Sharp pipeline; 5 server policy/media tests pass. Per-pipeline timeouts
are not a hard whole-operation deadline, and HTTP abort does not terminate Sharp.

Failed criterion: refresh continuity without stale authority. Guidance class:
project. Proposed reusable rule: retain workflow identity through refresh while
revalidating request authority at dispatch; explicit logout invalidates immediately.
No shared instruction file changed. Evidence: `.evidence/photo-activity/` files
session-regression.log, session-full-check.log, review-media.log, review-security.log.

Fixed by gpt-6-astra through Codex (T3 Code).

### Photo server-only delivery, 2026-09-26

Rebased onto PR28 squash `1dd01419ef689cf6e316ef27005f3c4fbf765e5d`.
The diff contains no client, App/auth/dock, native configuration or identical AI
assessment changes. Only sharp 0.35.4 is added as a dependency. The real API now
registers owner/session-checked activity availability (200 unavailable) and photo
submission (503 unavailable), without reading media or calling a claim writer.
The new receipt table and existing award hooks support atomic synthetic bus
top-ups. [Integration contract](docs/internals/photo-activity-integration.md)
records exact grants and the mandatory migration-before-award-reader deployment
order. Infrastructure owns the hosted upgrader. Live assessment/credit stays off.

Changed-photo same-action identity and future linkage of unlinked bus photos remain
activation gates. Receipt IDs and canonical hashes do not solve those problems.
The original macOS memory sample does not prove Linux 512 MB fit. All original
ca71166 local evidence and TODO history are retained; native proof belongs to PR28.

Prepared by gpt-6-astra through Codex (T3 Code).

Final server proof: frozen install/full check pass on the PR28 base; nine activity
DB tests and thirteen unchanged award regressions pass without skips. Security
source scans have zero findings; one existing moderate dependency advisory remains.
Standard pre-PR28 passive DAST has three informational admin alerts, no blocking
findings. The rebased real registered activity API passive scan passes with zero
alerts and observed 401/200/503/405/409/403 responses. Original and post-rebase
reports remain separate. The first local ZAP hook mismatch and a post-rebase
work.md formatting failure were corrected; reruns pass. All owned disposable
DB/scanner resources are removed. No shared services, devices, providers, cloud
resources or CI APIs were used. Review and merge remain coordinator-owned.

Verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: OneMap routing completion candidate

Related [#6](https://github.com/NachikethReddyY/AMR-Fan-App/issues/6) and #7;
OneMap-specific steering unlinked. Rebased the inherited provider commit onto
current main `09b61e9` and preserved the prior dirty TODO exactly before adding
this task's local checklist. The corrected task ownership has one implementation
writer in this checkout. No phone, infra, package, lockfile or CI files changed.

The OneMap adapter uses registered-account token exchange, bounded address
resolution and two concurrent mode requests. Credentials remain in an assigned
external private file; there is no cross-provider fallback. Normalized road and
transit data retain source, metrics and geometry evidence in the existing query
and prepared-journey contracts.

A new failing regression proved walking instructions were relabelled as cycling.
The fix requires returned road instruction modes to agree with the request;
missing, unknown or mixed instruction modes are unavailable. Synthetic HTTP
proof checks actual `cycle` requests and confirms disconnected transit cannot
be selected for journey verification. Continuous transit remains supported.

| Proof                            | Observed result                                                                                          | Limits                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Route boundary                   | 37/37 node tests pass, including maximum-shape heartbeat, mode honesty and transit-to-journey projection | Loopback fixtures only; at most two temporary listeners                                          |
| Journey evidence/planning        | 15/15 pass                                                                                               | No database integration or phone proof                                                           |
| Time/emissions arithmetic        | 32/32 in four Jest suites pass                                                                           | Existing indicative factors, not live emissions measurements                                     |
| Typecheck/lint/format/agent docs | Pass; 15 skills and 37 maintained docs                                                                   | Static/structure proof only                                                                      |
| Secret/SAST checks               | No leaks; zero findings across 171 source targets under four rules                                       | Focused scanner coverage, not a full security audit                                              |
| Dependency/scanner checks        | Gate passes; one unchanged moderate advisory; positive/negative fixtures pass                            | Existing advisory retained                                                                       |
| Current official transit excerpt | One fully printed itinerary, three legs, 1027 seconds, continuous geometry unavailable                   | Page abbreviates other itineraries; only the printed itinerary was parsed, without invented legs |

Private evidence: `.evidence/onemap/completion-*`. The first documentation parse
failed on its explicit ellipsis. The corrected probe parsed only the fully printed
itinerary after removing the omission marker; no omitted data was reconstructed.
Earlier evidence for three expanded itineraries remains historical.

The complete `pnpm check` aggregate, database tests, DAST, native/browser tests
and hosted Actions were excluded by this task's explicit scope. Camera evidence
is separately owned. Review and PR delivery follow this verified candidate; no
merge, deployment, live auth/search/route call, Google billing or shared database
operation occurred.

Path to live: the manager/infra owner assigns a registered and email-confirmed
OneMap account's email/password through `AMR_ONEMAP_CREDENTIALS_FILE`, authorizes
a bounded live mode/address/geometry check, and owns deployment. Phone ownership
includes visible source/licence attribution. Disconnected transit support beyond
this contract requires coordinated multipart geometry work; no fake connecting
path is supplied. This server PR does not close #6 or claim live product completion.

Implemented by gpt-6-astra through Codex (T3 Code).

## Routing responsiveness diagnostic, 2026-09-26

Existing PR43 owns this focused correction. No live provider, device, shared
PostgreSQL, cloud or Actions work was used. Exact main `726efbb` was extracted into
an OS temporary directory and instrumented only with aggregate timers/counters.
The reported full-gate timeout did not reproduce in the isolated run.

| Metric                                                   | Before         | After         | Evidence and limit                                        |
| -------------------------------------------------------- | -------------- | ------------- | --------------------------------------------------------- |
| Polygon containment calls, twelve maximum repeated paths | 49,164         | 48            | One instrumented run each; exact same provider bodies     |
| Per-mode normalization elapsed                           | 1,181–1,585 ms | 49–61 ms      | Single cold process each; concurrent mode timings overlap |
| Complete test elapsed                                    | 2,874 ms       | 220 ms        | Includes heartbeat and separate cancellation request      |
| Returned routes / points per route                       | 12 / 2,048     | 12 / 2,048    | Every coordinate compared against fixture                 |
| Provider deadline / maximum heartbeat delay requirement  | 5,000 / 50 ms  | 5,000 / 50 ms | Unchanged, both checks pass                               |

The correction caches successful exact point and directed-segment checks within
one bounded geometry evaluation, at most 2,050 points and 2,049 segments. It does
not simplify a route, persist coordinate caches, add provider retries or increase
a deadline. Focused geography/normalization/responsiveness checks passed ten tests,
including sea crossing, boundary, loops, duplicates and CPU cancellation. The
separate cancellation fixture now uses distinct points to preserve expensive work.
These synthetic, single-sample measurements establish removed repeated work,
not a production latency claim. Full local verification follows on the isolated
candidate. Phone capture/leg-attribution work is preserved separately and is not
part of this performance commit.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: durable shared AI USD store

Implemented the PR45 store seam for parent #3. One PostgreSQL budget-row lock
serializes reservations, claims, cancellation and accounting. Exact replays do
not dispatch; changed fingerprints/quotes fail. Unknown spend stays held across
process exit, and bound violations persistently suspend admission. Configuration
requires an explicit shared database URL with no per-worktree fallback. No
provider, price, cloud database, API route or paid request was enabled.

Eleven isolated PostgreSQL 17 cases pass, including separate processes, cap
races, lock-wait expiry, partial two-stage recovery, rollback and exact runtime
column grants. Six initial behavioral tests failed against the stub before the
implementation. Each fixture owned one disposable container/internal network,
with no host ports/mounts or shared credentials, and removed its resources.
The initial chain was 0001–0009 plus independent 0011. After rebase onto photo
main `726efbb`, all eleven cases passed on the complete 0001–0011 chain in
3.78 seconds. Owned container and network IDs were confirmed absent after cleanup.
Typecheck passed.
Independent read-only source review found no actionable issues.

The first full gate stopped on bug-record formatting, repaired locally. The next
reached the unchanged route responsiveness fixture, where the 5-second deadline
returned six routes instead of twelve. The isolated rerun passed
unchanged in 4.6 seconds. The integrated full run again reached this test and
returned `unavailable` at its deadline. All preceding gates and the seven
remaining suite commands pass; no route source or threshold was changed.
Security passed before and after the rebase, with zero source findings and
zero high/critical dependency advisories. Scanner negative fixtures failed as
expected. The DB/heavy slot was released after cleanup. Raw proof remains
local under `.evidence/ai-cost-store/`. CI is paused and was not queried. The
Full `pnpm check` is RED; the cause of the repeated route failure is unproven.
The coordinator authorized one real PR for review with that limit explicit and
assigned separate diagnosis. No merge turn is granted.

A bare stash pop during rebase recovery selected a peer's concurrently newer
stash. It remained intact. The accidental untracked copy was verified against
that retained stash before removal, deploy tooling was restored to this task's
HEAD, and this task's TODO was restored byte-for-byte from its captured stash
object. Private recovery assertions confirm no deploy diff and retained stash;
no peer worktree or reset was touched. Failed criterion: preserve task-owned
changes across shared stash ordering. Proposed project guidance: use captured
stash object IDs only. No global guidance was edited.

Implemented by gpt-6-astra through Codex (T3 Code).

### PR48 P2: conflicting receipts, 2026-09-26

Independent final-head review found that an in-bound contradictory receipt
threw within the transaction, retaining an earlier lower charge without
suspending admission. The prior test checked rejection but then permitted the
next stage; it did not prove conservative exposure. This failed the accounting
criterion. Classification: project correction; no shared guidance was edited.

Three new PostgreSQL cases failed against exact original `4f83e244` adapter and
SQL while the eleven earlier cases passed. With the fix, all fourteen pass in
2.09 seconds on migrations 0001–0011. A contradiction preserves the original
receipt, marks the call disputed, restores its full reservation and suspends the
budget atomically. Conflict is returned only after commit. Reconnect, repeated,
different and original-receipt replays cannot shed the hold; admission and claims
remain blocked. Late correction after released funds are reused records all
conservative exposure even above $10. There is no new grant or column; migration
0011 adds the disputed state to its constraints. Its old checksum is obsolete.

The granted serial proof used disposable PostgreSQL 17 with generated credentials,
an owned internal network and no host ports/mounts. Red and green fixtures each
cleaned their container/network/image. Prior evidence remains untouched; new
proof is `p2-red.log` and `p2-green.log` under the existing local evidence path.
Activation explicitly requires no prior provider spend/in-flight calls or a
separately reviewed import of liabilities. Main refresh after the route fix,
integrated gates and exact-head re-review remain pending. No merge is granted.

Corrected by gpt-6-astra through Codex (T3 Code).

PR48 integrated refresh: PR43 merged as
`026b4d70f9ab1eb4ef2b1731db88e1162feda1fb`; the corrected budget was rebased onto
that actual main commit without copying peer source. Append-only record conflicts
preserve both owners; TODO was restored byte-for-byte from a private file copy,
without the shared stash stack. Adapter, SQL and tests match the fourteen-case
PG-proven version byte-for-byte. Full `pnpm check` and `pnpm security:check` pass.
The earlier route responsiveness case passes in 190 ms; earlier red evidence
remains unchanged. Proof is in `p2-main-check.log`, `p2-main-security.log` and
`p2-cleanup.txt` under the existing evidence path. Exact owned red/green container
and network IDs were confirmed absent. The heavy slot is released. Migration
0011 SHA256 is `be6baf0dd4ccb209c266a3646a9f8494bbb2c6ca74b79f3cbef3dc0956c8013b`;
runtime grants are unchanged. Final-head P2 re-review and any root merge turn
remain pending; no provider, cloud, shared database or CI action occurred.

Verified by gpt-6-astra through Codex (T3 Code).

## Admin Vercel delivery candidate, 2026-09-26

Reuse the five existing admin pages with consistent navigation and the selected
admin palette. A public-only build copies 14 browser assets plus fixed Vercel
routing/security configuration. The verified Hobby team has a new `amr-admin`
project with assigned `https://amr-admin.vercel.app`; no deployment, paid addon,
function, Render setting or native app change has been made.

The existing `ADMIN_ORIGIN` remains supported, and optional
`ADMIN_ADDITIONAL_ORIGIN` permits one more exact origin. Both reject wildcards,
credentials and non-origin configuration. Ordinary session and assigned-role
checks remain authoritative. Login forms use POST and omit native email/password
control names, so failed JavaScript cannot serialize credentials. The original
shared helper still uses the fixed Supabase endpoint and memory-only sessions.

Observed proof: seven focused build/auth/origin tests; nine disposable-database
HTTP tests, followed by the updated two-case registration suite with both-origin
fan/admin/revoked-role checks; full `pnpm check` passed on final source. A concurrent
route heartbeat check failed at56.95ms while scanners ran; the unchanged23-case
route suite and subsequent full check passed serially. Browser proof reached all
five real local API screens, denied a synthetic fan, allowed a synthetic assigned
admin, and cleared the workspace on logout. Desktop880px main, narrow390/640px
layouts and CSS200% zoom had no horizontal overflow. Keyboard Enter works;
listener-free native POST has zero successful credential controls and is rejected.
This is synthetic identity and CSS zoom proof, not hosted admin or browser zoom.

Final isolated DAST has59 rule passes and blocks on10202, missing anti-CSRF token
heuristics on three login forms. These forms have no native credential controls,
no native login endpoint and no cookie authority; independent disposition is
pending. Informational10031 matches a static points-input attribute. No scanner
rule was suppressed, and DAST is not reported green. Earlier sensitive-URL alert
is absent after the form correction. Final security checks passed: no detected secrets, zero source SAST findings
and no high/critical dependency advisories; the previously triaged moderate
dependency advisory remains.

Private proof: `.evidence/admin-vercel/` and `.evidence/security/application/`.
The final CLI dry run lists exactly15 public files,77,977 bytes, with no secret,
`.env`, `.vercel`, evidence or test file. Source hashes are frozen for independent
review. Live assigned-admin reads require legitimate supplied access; the Render
candidate/additional origin must be deployed by the infrastructure owner. PR and
production publication remain pending independent review and delivery gates.

Edited by gpt-6-astra through Codex (T3 Code).

## PR46 route-main refresh and accepted DAST exception

Rebased the admin candidate onto main `026b4d70f9ab1eb4ef2b1731db88e1162feda1fb` as
`8a0b54fe99556fe066c8124218db1e5514d2511b`. Only bug/work append conflicts required resolution;
both histories are retained. The admin patch, all14 browser assets and build
script are unchanged. Original e71 evidence and local TODO edits are preserved.

The user accepted only the independently reviewed10202 false positives on the
three unchanged login forms. [Exact exception record](docs/operations/admin-dast-exception.md)
retains the failed scan, source hashes and scope without changing scanner rules
or global policy. No refreshed execution is claimed. Impact owns the heavy slot;
full/security/DAST/browser gates and affected independent review remain scheduled
by root. No push, merge, deployment or Render settings change occurred.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: photo and AI migration-tool preflight

- Tracking: DEPLOY-010-011, unlinked. Clean starting branch `fix/deploy-photo-ai-migrations` at `1dd01419`; read the old infrastructure handoff without touching its resources.
- Six lightweight tests pass for invalid ordered history, checksum drift, unknown suffix, lock-before-read and rollback before any mutation. Draft PostgreSQL cases now cover retained eight/nine histories through eleven and late budget-migration rollback, but are unexecuted pending finalized SQL on main and the root's database-test lease.
- AI owner supplied table/column-only grant design; frozen SQL/checksum remain pending. Photo requires SELECT/INSERT only. Runner, SQL, AI and photo implementation files remain unchanged.
- Offline frozen install from cached packages, focused ESLint, syntax and diff checks pass. No heavy database test, shared database access, Actions, provider, device, cloud, production migration, commit, push or PR occurred. Root received the lease request and dependency report; it retains serialized squash authority.

Prepared by gpt-6-astra through Codex (T3 Code).

Migration-tool light preparation now uses merged photo main `726efbb47d7ad394325b2487a0f7a067e23dd21b`.
The 0010 checksum matches `122ca4c3833b831febdec2eff8839e67625407cdccf4ae43e0e3a1bddbde03b1`.
The runner draft supports exact eight/nine/ten prefixes, validates retained grants
before pending DDL, and applies photo SELECT/INSERT-only grants. A ten-entry
history regression failed before this change and passes now. Syntax, focused
lint and history tests pass; PostgreSQL proof is still unverified and held.
AI 0011 is frozen at `43d6cd70a58de0bc9fcc88ea27529120a7e62a989715396c43363d66c3b40e3f`,
but will enter the runner only after it lands on main. No heavy checks or scanners
were run. Photo and AI source files were not edited.

A concurrent worktree selected this task's stash with bare `stash pop`; that
owner reported recovery without changing this worktree. The shared stash
`ae7b052dc0303410f44502ab35eff692241313b6` remains intact. Failed criterion:
worktree-safe stash selection. Project lesson proposed, not guidance edited:
use exact stash object hashes during concurrent work, never indices or bare pop.

Prepared by gpt-6-astra through Codex (T3 Code).

Further light preparation aligns the database-test draft with actual main's ten
migrations. Added real-runtime photo insert/select and denied update/delete/truncate
cases; concurrent lock wait, late photo-DDL rollback, exact retained column/function
ACL preservation, and replay refusal for photo column/PUBLIC/grant-option drift.
These PostgreSQL cases are authored but unexecuted. Ten light history tests and
focused lint/syntax/diff checks still pass. The operating procedure distinguishes
this unverified ten-migration draft from the historical nine-migration release and
records the frozen AI contract without importing its unmerged SQL. No heavy gate,
scanner, database connection or external delivery occurred.

Prepared by gpt-6-astra through Codex (T3 Code).

0011 dependency correction: independent PR48 review found that a contradictory
charge within its bound released uncertain exposure. The AI owner is adding a
persistent disputed state with the full hold retained and admission suspended.
The SQL CHECK enum changes, so the previously recorded `43d6` checksum is obsolete
and must not be implemented or treated as frozen. Final review, checksum and
merge remain pending; no new columns or grants are expected. Updated the active
operating contract only; 0010 runner preparation remains unchanged. Root's queue
is route gate, budget PG rerun, then migration-tool full-chain proof. No database,
heavy gate, scanner, SQL edit or unmerged-file copy occurred. This is a one-off
upstream contract correction, not a shared guidance change.

Recorded by gpt-6-astra through Codex (T3 Code).

Migration-tool main refresh: PR48 is merged at
`188baa44acf870db4aeb72258a0de01f093aea22`; SQL 0011 bytes match final SHA256
`be6baf0dd4ccb209c266a3646a9f8494bbb2c6ca74b79f3cbef3dc0956c8013b`.
Restored only this task's exact stash object, preserving both append-only record
histories. The runner draft now supports the full chain with exact AI table/column
grants. First-time 0011 initialization requires the explicit protected-config
assertion `aiBudgetInitialization=verified-no-prior-spend-or-inflight`; absence
refuses before pending DDL or fresh roles. Existing liabilities require a separate
reviewed import; this tool cannot import, reset or enable paid calls.

Fifteen lightweight tests cover malformed histories, retained-prefix acceptance,
pre-DDL participation drift and missing/invalid initialization assertions. The
PostgreSQL draft covers retained 8/9/10 upgrades, a late 0011 rollback, exact
runtime AI writes/denials and preservation of suspended exposure above $10 on
replay. It remains unexecuted pending root's heavy lease after Impact. No SQL,
AI implementation or photo implementation file was edited; no DB/full/scanner,
provider/cloud/Actions or publication action occurred.

Prepared by gpt-6-astra through Codex (T3 Code).

## Migration-tool isolated verification, 2026-09-26

Under the root's sole heavy lease, the pinned PG17/Node24 fixture passed all
23 tests without skips. Three retained histories (8, 9 and 10) reached the exact
11-file checksum ledger. Two real non-superuser deployers waited on the same
advisory lock, then returned one upgrade and one unchanged replay. Late 0011 DDL
failure rolled back pending objects/history. Prior role identities/passwords,
table/column/function ACLs, rows and ledger timestamps remained unchanged.
Actual runtime photo and AI operations passed their narrow grants; forbidden
writes, ownership escalation, PUBLIC grants and grant options were refused.
Replay preserved disputed-call receipts and suspended exposure above $10.
First initialization without the explicit assertion left retained state unchanged.

Full `pnpm check` and serial `pnpm security:check` passed. Source secret/SAST scans
reported zero findings across the snapshot (262 SAST targets, four rules); audit
retains one moderate advisory, no high/critical findings. This proves local
fixture behavior, not production spend history or deployment. The assertion must
come from actual account history/in-flight evidence, never presumed zero spend.
The all-or-nothing runner has no 0010-only option or liability import/reset.

Initial fixture failures were a missing imported source directory and an incomplete
grant/revoke test pair. Both were repaired; red evidence remains. All owned
container/network/image IDs were confirmed absent after cleanup; no shared DB,
host mounts/ports, provider, cloud or CI call occurred. Heavy lease was released.
Evidence: `.evidence/photo-ai-migration-tool/pg-first.txt`, `pg-proof.txt`,
`full-check.txt`, `security.txt` and exact cleanup receipts.

Final inspection found one missing forbidden privilege: PostgreSQL MAINTAIN.
Added exact runtime ACL rejection and a GRANT MAINTAIN replay regression. Focused
syntax/lint/format/diff checks pass; SQL checksums are unchanged. Root queued the
failing-first/corrected retained-history PG rerun after admin's lease. No fixture
has restarted, and no final-head DB proof or PR completion is claimed yet.

Verified by gpt-6-astra through Codex (T3 Code).

Retained-participation review finding confirmed: column REFERENCES and runtime
grant options on tables, columns, functions and the sequence were not validated.
The narrow fix reuses exact table/column checks and validates sequence/function
ACLs. Five failing-first PostgreSQL subcases are prepared to prove rejection
before pending DDL, preserving ACLs and ledger. MAINTAIN refusal remains included.

The user then authorized explicit targetMigration 0010 to migrate independent
features without assuming zero provider liabilities. Strict targets are 0010 and
0011; omission preserves 0011. The 0010 path loads/applies/validates only its exact
prefix, grants no AI access, requires no initialization assertion and refuses an
existing eleven-entry ledger. Seven light target tests failed before the change;
all 22 lightweight tests now pass with syntax/lint/format/diff checks. PostgreSQL
cases are authored for 8/9→10, 8/9/10→11 and actual API/award reads with AI tables
absent. No production zero-spend assertion was supplied or inferred.

Released a newly granted slot immediately because target10 database tests were
still being authored; no fixture started. Root was notified once source/proof
preparation was ready, queued after awards. Earlier test evidence remains intact.

Prepared by gpt-6-astra through Codex (T3 Code).

## Migration-tool final target and ACL proof, 2026-09-26

Rebased only through actual main `e2f95534814b7e6289ba24f01aa20a919ed1514a`.
Both owners' record conflicts are preserved; SQL and application source are
unchanged. PR46's origin allowlist introduces no AI-startup dependency.

| Acceptance                   | Observed evidence                                                                                                                               | Limit                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Retained migration targets   | Five PG17 cases: 8/9→10 and 8/9/10→11, exact ordered checksums and replay                                                                       | Disposable fixtures only                                    |
| Retained authority and state | Role/password identities, old table/column/function ACLs, ledger timestamps and rows preserved; concurrent lock wait and late-DDL rollback pass | No live database inspected                                  |
| ACL regressions              | Fifteen retained table/column/sequence/function drift subcases and MAINTAIN cases fail against preceding validators; all corrected tests pass   | Existing unrelated ACL contracts remain unchanged           |
| Inactive AI compatibility    | Real current API photo GET200 unavailable/POST503, actual journey award read at target10, no AI tables                                          | No provider dispatch or deployment                          |
| Accounting protection        | Invalid/missing first-init assertion refuses; target below ledger refuses; replay preserves disputed receipts and suspended exposure above $10  | Historical account liabilities remain unresolved            |
| Final checks                 | 47/47 fixture tests, focused lint/format/syntax, agent validation, diff checks and security pass                                                | Earlier full app check retained, no duplicate full app gate |

The first refreshed run found a REFERENCES test using nonexistent `id`; corrected
to `points_operation_id`. Prior red/green receipts remain. Final red uses the
same new tests with only the preceding validators restored inside the owned
container; corrected source then passes all 47. No migration SQL was changed.
Security has no source findings and retains one existing moderate dependency
advisory. All owned container/network/image IDs were confirmed absent and the
heavy slot was explicitly released to root. No shared DB, host mounts/ports,
provider, cloud, CI, production migration or deployment occurred.

Proof: `.evidence/photo-ai-migration-tool/acl-target-red-corrected-fixture.txt`,
`acl-target-green.txt`, `final-security.txt` and `final-cleanup.json`.
Verified source is ready for one PR and root's independent exact-head review.

Verified by gpt-6-astra through Codex (T3 Code).

### Production journey award readiness, 2026-09-26

Local candidate rebased onto main `026b4d7`, including merged PR47 hooks and the
route deadline correction, replaces the literal disabled
production gate with a retained server-only release and per-receipt readiness.
The release binds exact policy/factor content, normalized source units, single-driver
baseline review, supported modes/distance methods and physical iOS/Android report
references. No approved release or real-trip proof is supplied. Missing releases
preserve legacy unavailable results; existing journeys cannot gain readiness from
a later deployment. The public transaction retains PR47 preliminary photo credit,
upward-only difference, receipt immutability and idempotency. No provisional
planned-distance shortcut or new earning rule is introduced.

Primary SBF SEFR source research found candidate Singapore passenger-km factors;
registry access returned HTTP 403. Single-driver occupancy conversion and common
CO2e boundary remain unproved. The [release procedure](docs/operations/journey-award-release.md)
records that precise gap and a physical field protocol. Hashes bind evidence;
reviewed actual observations establish calibration. GPS never verifies mode,
measures carbon or creates offsets.

Observed local proof: 28 focused policy, readiness, assessment, planning and photo
arithmetic tests pass; TypeScript and changed-file lint checks pass. A single
1,000-iteration synthetic two-factor ready calculation averaged 0.0233 ms with
zero network requests; this is not API latency or field calibration. Database/public HTTP production
path tests are written but unexecuted, queued with serialized full/security checks.
No shared database, cloud, provider, CI or device actions occurred. PR and independent
final-head reviews remain pending. This is not production activation or delivery.

Edited by gpt-6-astra through Codex (T3 Code).

Impact's user-approved labelled full-journey estimates are independent of points
readiness and may precede physical calibration when factors are approved. This
change does not authorize provisional points. Google Routes strict $0 selection
belongs to the route owner; no provider calls were made here. Award heavy tests
remain queued behind Impact. Rebase preserved both route and award records using
captured stash `5e5e1bd449fe9a0bfb78db8a0815b3a1ab212817`; no peer stash was applied.

Recorded by gpt-6-astra through Codex (T3 Code).

### Approved provisional journey policy, 2026-09-26

The later user decision supersedes the earlier provisional-points hold above.
Implement `planned-endpoints-v1` with retained planned estimate, recorded start
and arrival, separately reviewed compatible factors and explicit provisional
receipts. Physical release remains a separate variant. `decision.full` retains
actual assessed-distance meaning; provisional receipts expose a separate nullable
`assessedCalculation` for Impact. Planned estimates and points never contribute
to verified impact. Start request stays `requestId`/`captureSessionId`.
Native owns geometry and assessed-leg attribution only. Factor release/config,
policy and Start binding remain award-owned. Tracker: #9. DB/full/security proof
remains queued; no numerical factor or physical approval is fabricated.

Recorded by gpt-6-astra through Codex (T3 Code).

### Independent award policy proof, 2026-09-26

The physical and provisional policy paths pass local `pnpm check` and
`pnpm security:check`. The full gate includes 136 native/state and 23 web Jest
cases plus repository tooling/domain checks; 34 focused award/readiness/evidence/
planning/photo arithmetic cases pass across the focused runs. In isolated
PostgreSQL 18, 49 award/journey/registered HTTP cases passed, including public
physical/provisional receipt replay after API restart, concurrent top-ups,
config removal after Start, no clawback and preliminary photo deductions.
The initial photo suite refused its hardcoded database name before connection;
its guard now requires the same exact worktree test namespace as other suites.
All nine photo PostgreSQL/HTTP cases then passed. Both owned tmpfs containers
were removed and absence checked. No shared database/config was used.

Security proof: source secret/SAST scans report zero findings; dependency audit
retains the known moderate advisory, with no high/critical advisory; scanner
positive/negative controls pass. Scope is the trusted deployer configuration,
retained basis and existing authenticated settlement transaction. Actual HTTP
tests cover ownership, authority, invalid inputs and replay. New unauthenticated
DAST was not run; physical/device proof remains unverified. No cloud/provider/CI
or device action occurred. Heavy lease released after cleanup.

CAG FY2023/24 source review found .1901 car vehicle-km, .0441 bus passenger-km
and .0578 MRT passenger-km. These match cited EPA CO2-only columns after unit
conversion, with separately omitted CH4/N2O. User choice on explicitly labelled
estimated CO2 avoided and neutral car baseline remains pending. No dataset is
activated or bundled, no old kgCO2e receipt is relabelled, and independent factor
review does not invent approval. Exact schema sent to Native/Impact; physical
public outcome creditContext is `production`, provisional is `provisional`.
PR/review and any accepted unit-specific implementation remain outstanding.

Verified by gpt-6-astra through Codex (T3 Code).

Review candidate rebased onto main `e2f95534`; main's additional admin origin and
API registrations are preserved. Rebased TypeScript, API lint, 34 focused tests,
agent structure and diff checks pass. Full/security and 58 PostgreSQL/API passes
above precede this composition-only rebase. No repeated heavy work or factor
activation occurred. Local TODO stays unstaged.

Verified by gpt-6-astra through Codex (T3 Code).

### Accepted CAG CO2 factor variant, 26 September 2026

The final user decision supersedes the pending factor-unit question above.
PR50 now adds the versioned neutral single-occupant-car / published_surface_access
CO2 dataset (.1901/.0441/.0578), retained source-label discrepancy and operational
walk/cycle exclusions. Route estimates and recommendations use distinct CO2
variants; receipt calculations add explicit measurement gas/unit/version without
rewriting legacy CO2e data. Planned provisional and actual assessed values remain
separate. Native owns parser/UI adaptation and Impact owns aggregate adaptation.
No physical calibration is claimed. Source/focused proof precedes root's queued
heavy checks and new exact-head review; the earlier b9d370f clearance covers only
the prior synthetic-factor slice. One PR50 remains open, with no squash yet.

Edited by gpt-6-astra through Codex (T3 Code).

CO2 candidate focused proof: 38 server policy/readiness/evidence/planning tests,
14 route estimate/recommendation Jest tests, TypeScript, affected ESLint and
format checks pass. Agent/document links pass. New registered HTTP CO2 credit and
restart replay test is authored but awaits the leased PostgreSQL run. No new
DB, fullcheck, security scan, provider call, CI or device claim at this freeze.

Verified by gpt-6-astra through Codex (T3 Code).

### PR50 activation compatibility correction, 26 September 2026

Independent exact-e2a553f reviews found that the automatic CAG fallback made
unconfigured API responses use `approved` and CO2 variants before the current
native decoder supported them, including unavailable-provider responses. The
failed criterion was coordinated server/client compatibility. Both createApi
and createJourneyService now omit that fallback; the accepted dataset and
explicit JOURNEY_FACTOR_RELEASE_FILE path remain. Default responses retain
legacy indicative contracts. Deployment activation waits for the compatible
native client on main. No new flag or peer implementation was copied.

The registered route HTTP regression feeds both available and unavailable default
responses through the actual current parseComparison decoder. It also checks
explicit CAG configuration emits the retained CO2 server display contract.
Project-level lesson proposed: verify default server responses against the client
on the merge base before enabling a new wire variant. Shared guidance unchanged.

Edited by gpt-6-astra through Codex (T3 Code).

Final compatibility-fix proof: isolated PostgreSQL ran 60 tests with 59 initial
passes. The new CO2 test expected a 1 km bus route, but the retained fixture is
1.112 km. Corrected exact assertions are baseline .1901 kg, journey .0490392 kg,
savings .1410608 kg and 7 points. All 7 registered API tests then passed, including
CO2 immutable restart replay. The initial run passed default available and
unavailable HTTP responses through the current client decoder, explicit CO2
configuration and all 9 photo regressions. All 60 distinct scenarios passed
across those runs. Both owned PG18 tmpfs containers were removed; pre-existing
shared containers were untouched.

`pnpm check` passed after formatting the appended bug/work entries. It includes
136 native/state tests, 23 web tests and all domain/tooling checks.
`pnpm security:check` passed: source secret and SAST scans reported no findings,
the audit retained one existing moderate advisory with no high/critical, and
scanner positive/negative controls passed. No provider/cloud/CI/device or native
compilation was used. Heavy lease released before final commit/review refresh.
Default factors are not activated. Root must review the new exact head before
serialized squash; native-compatible main precedes explicit deployment config.

Verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: hosted report text-retention preparation

User scope: one focused reports candidate from main `1dd01419`, local preparation
before root review/cloud work. Owning report ingestion #19 and approval #20.
New PDFs remain in bounded request memory. Saved page text, hash, byte count and
parser provenance remain in PostgreSQL; original storage is legacy cleanup only.
Completed retries skip parsing. Source download is a page-labelled UTF-8 text
attachment. Approval, immutable revisions and official ESG read policy remain
unchanged; no points, auth, photo, budget SQL, mobile or Impact implementation edits.

| Boundary                         | Status and sample                                           | Method/evidence                                                                  | Confidence and limits                                                                 |
| -------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Retention/adapters/protocol      | 40 tests passed in the report command                       | Synthetic local temp files, controlled provider responses and real loopback HTTP | Good local contract evidence; no remote storage/provider used                         |
| Static checks                    | Typecheck, focused lint/format, agent/document check passed | Local Node 24.20.0; cached frozen install downloaded nothing                     | Does not establish parser or transaction behavior                                     |
| Durable commit/deletion/approval | Unverified in this candidate                                | Focused PostgreSQL tests authored, shared heavy slot queued                      | Must run before candidate freeze                                                      |
| Linux isolation                  | Unverified for this new launcher                            | Prior ARM64 experiment read; owned artifact now prepared                         | Prior prototype is not evidence for changed launcher or Render AMD64                  |
| Hosted readiness/cost/memory     | Unverified                                                  | Exact trial proposal in `server/reports/hosted/README.md`                        | Root review, zero-spend proof, actual-host isolation and memory measurements required |
| UI/DAST/full security            | Unverified for this candidate                               | Download copy/type/extension updated; no browser consent used                    | Relevant checks remain queued, no product-security pass claimed                       |

The default-disabled synthetic trial has a separate signed audience and exact
fixture hashes/sizes, with production parse/readiness closed until host approval.
The dedicated service has no application credentials, storage or inference calls.
The accepted hard resource boundary is 512 MiB service-wide. Swap/PID observations
remain review evidence, not claims inherited from the old Docker job profile.

Legacy-only expiry duration and idle cleanup scheduling are pending. No duration
was invented, and new uploads do not depend on one. Existing historical PDF
retention claims in report operations were replaced with the accepted contract.
Local evidence stays ignored and synthetic. No commit, push, PR, cloud creation,
remote provider call, secret access or evidence publication in this preparation.

Implemented and locally checked by gpt-6-astra through Codex (T3 Code).

Reports light rebase, 2026-09-26: moved this preparation branch onto actual main
`e2f95534814b7e6289ba24f01aa20a919ed1514a`. The only restore conflicts were
append-only bug/work records; complete main records and this report entry remain.
TODO is byte-identical to its private pre-rebase copy and stays unstaged. Report
source is byte-identical to the preparation manifest except the admin HTML,
which preserves main's navigation and changes only the download label. Package
scripts retain main's additions and the focused report test expansion.

Cached offline frozen install added main's Sharp dependency without downloads.
Post-rebase typecheck passed. Lightweight fixture inspection found no missing
local import or file outside the test Dockerfile's explicit source-copy list.
Docker binary exists, but daemon/image/package availability and Linux compiler,
parser/PG execution remain unverified until the queued lease. No container or
parser started. New in-memory upload behavior has no pending product decision;
legacy expiry stays separate. The exact hosted candidate is not frozen and has
no actual-host readiness claim.

Rebased and inspected by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: report Linux and PostgreSQL proof

On main `e2f95534814b7e6289ba24f01aa20a919ed1514a`, the owned Linux ARM64
fixture compiled the actual launcher with compiler warnings treated as errors.
Twenty tests passed with no skips, using real Landlock ABI 8, seccomp, PDF.js,
HTTP, PostgreSQL transactions and synthetic PDFs. They cover denied file/proc/
network access, invalid/encrypted/image-only/page-limit/deadline failure and
recovery, signed trial parsing with production readiness closed, memory-only
upload, durable page commit before legacy deletion, deletion retry, rollback,
role/session revocation, approval concurrency and official ESG reads. They do
not establish hosted AMD64 behavior or worst-case service memory.

The accepted legacy-only default is now 24 hours, configurable with
`REPORT_FAILED_UPLOAD_TTL_SECONDS`. The real PostgreSQL test confirms cleanup
skips an active upload's advisory lock and expires the object after release.
New uploads write no original object. Idle cleanup scheduling remains a deployment
prerequisite; no production object was inspected or deleted.

Actual execution found and fixed two launcher prerequisites: Node needs read
access to `/etc/ssl/openssl.cnf`, and RLIMIT_NPROC counted the shared UID's threads
across containers and blocked Node startup. The final launcher retains thread-only
seccomp creation controls and observes service cgroup limits. The accepted
512 MiB service-wide contract does not introduce an unproved zero-swap/64-PID
promise. The parser Docker build includes CA certificates and retains strict TLS.

Full `pnpm check` and `pnpm security:check` passed serially on this source. Security
fixtures rejected their deliberate unsafe inputs; those expected findings are
not product findings. Local proof is private under
`.evidence/hosted-report-text-retention/`. Supported-host isolation, peak service
memory, zero-spend review and independent sandbox review remain prerequisites
for actual hosted readiness. No cloud, CI or production action occurred.

Verified by gpt-6-astra through Codex (T3 Code).

Reports passive DAST and cleanup: the actual reports admin page returned 200;
the spider followed all five admin forms. The scan remains failed with five
10202 instances and informational 10031. Root accepted only the two additional
points/rewards instances after independent review; the original three-form
exception remains separate. [Exact source-bound disposition](docs/operations/admin-dast-exception.md)
records the nine original-image/source hashes. The initial parser scanner could
not write its startup log. A retry with the owned writable working directory
returned exit 0, 60 rule passes and zero alerts; `/health` returned 200 and ZAP
observed `/ready` false. Retained ZAP errors are denied external update/telemetry
DNS lookups on the internal network, not target failures. No remote scan occurred.

The original image index, manifest and source COPY blobs remained in Docker's
build record after cleanup. Digest-verified reads reconciled all nine relevant
files with the current candidate, without building or starting another container.
All owned containers, three images, internal network and temporary source context
were removed; the heavy slot was released to root. Shared caches were not pruned.
No rendered admin, actual Render AMD64, service memory-peak or production claim
follows from this local proof. One real PR and root's exact review remain next.

Verified and recorded by gpt-6-astra through Codex (T3 Code).

PR53 focused review correction: Supabase inventory now advances offsets in
1,000-object pages under one 15-second deadline, with a 512 KiB response limit
per page and strict name progress. The inventory finishes before this sweep
removes anything, so its deletions cannot shift later offsets. Incomplete or
nonprogressing inventory fails before any cleanup deletion. Sweep policy,
commit-before-delete and active-upload locks are unchanged.

The 2,005-object regression failed against `1e60d442` and passed with the fix;
it includes expired/saved objects beyond page one and a deletable first object.
Provider failure and repeated-page tests verify no partial cleanup. All 44
focused report tests, typecheck and focused lint pass. Root's standards/security
CLEAR receipt at `1e60d442` remains the prior candidate's receipt; pagination
needs focused rereview. No heavy checks or scan were repeated without a lease.

Fixed and verified by gpt-6-astra through Codex (T3 Code).

PR53 pagination rebase: actual main `458cae125437692c03d036139063c4a99bae2c5d`
is now the base. Both owners' append-only records and main's expanded Awards
script are preserved. Report source is byte-identical to the corrected source
before rebase; API/Awards source is byte-identical to main. Forty-four focused
report tests, typecheck and agent/docs validation pass after rebase. The original
full/security/Linux/DAST receipts remain prior-source evidence, with no heavy
rerun. The inherited Awards API hash change is separately recorded in the DAST
exception document for root's focused review. Merge remains held.

Rebased and verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: Impact contribution read and phone binding

Personal and community lifetime estimates have a scoped read API and Home/Impact
bindings on main `026b4d70`. A repeatable database snapshot follows the latest
assessment per journey. Exact decimal savings do not depend on points, replay
count or top-up amounts. Full assessed records and approved factors qualify for
labelled estimates before physical calibration, as accepted by the user. Fixture,
demo, fallback and insufficient-evidence records cannot inflate those estimates.
No numerical dataset, physical evidence or production award release was invented.

Home changes are imports, one hook and its two text bindings. Impact retains
its geometry and separate official figures, with source/method/period disclosure
and explicit empty, unavailable, loading and error states. No award transaction,
journey schema, photo, account, Travel or dock code was changed.

| Security dimension            | Status and evidence                                                                                           | Confidence and limit                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Ownership and admin isolation | Pass: isolated real HTTP/PG tests reject anonymous, revoked and cross-account reads, including admin          | High for tested actors; no production accounts used              |
| Community disclosure          | Pass: strict aggregate/source schema and real response omit profile and journey IDs                           | High for tested response; no privacy claim about other endpoints |
| Accounting preservation       | Pass: replay and later evidence use one journey; 5 kg personal and 9 kg community fixtures leave balance zero | High for synthetic stored data; no actual travel claim           |

Three isolated PostgreSQL18/Node24 cases passed, including cursor traversal over
100 records and a qualifying zero. Eight pure backend, fifteen client and two
component cases pass. Full `pnpm check` passed; the subsequent assessment guard
passed focused tests, isolated DB, typecheck, lint and formatting. Security checks
passed with no source findings; the existing dependency audit retains one moderate
advisory. Owned database containers, internal network and private context were
removed. Evidence is local under `.evidence/impact/`.

Native rendering and endpoint-specific DAST remain unverified. The existing DAST
target uses a PostgreSQL version outside the granted PG17/18 fixture scope and
starts at the unrelated participation admin path. CI is paused by the user.
No provider/device/cloud/shared-DB/CI action occurred. Approved live numerical
factors and actual populated journey proof remain upstream activation work.

Implemented by gpt-6-astra through Codex (T3 Code).

PR review corrections: independent specification review found evidence-related
`no_award` receipts were displayed as empty; they now remain unavailable and are
counted beside partial totals. Independent standards review required a bound on
the full community scan. The read now caps work at 10,000 records and five seconds,
with a shrinking per-fetch database timeout, and never returns a truncated total.
Failing-first focused regressions pass. The final budget SQL has not rerun in
PostgreSQL because the heavy slot was released to the migration owner; prior
isolated proof predates that correction. Native and impact-specific DAST remain
unverified. Review scope is the impact diff, not a repository-wide audit.

Corrected by gpt-6-astra through Codex (T3 Code).

Impact rebased onto merged admin main `e2f95534814b7e6289ba24f01aa20a919ed1514a`.
The pre-correction Impact/Home code is byte-equivalent to reviewed `0b14a8b`;
admin origin/helper registrations and both record histories are preserved.
Root specification review then identified an assessment-freshness gap. The read
now selects the current assessment identity with the receipt in its existing
read-only snapshot and excludes mismatches as `assessment_pending`. The regression
reads after new evidence but before settlement, checks repeated reads remain
pending, then expects exactly one replacement contribution after settlement.
Typecheck, all eleven focused backend tests, changed-file lint, formatting and
diff checks pass after the rebase and correction. The new database regression has
not run. Database red/green execution, corrected timeout SQL and scoped endpoint
DAST remain queued. No heavy services started; the offered slot was released because
the source correction was still in progress. Native rendering remains unverified.

Corrected by gpt-6-astra through Codex (T3 Code).

Impact integrated actual merged awards main `458cae1`. The aggregate now selects
full assessed or provisional nonnull assessed calculations, requires explicit CO2
measurement and retained approved factor provenance, and excludes unchanged legacy
CO2e records. The API and accepted Home/Impact text use CO2 with source values,
interpreted/published units and release version. No layout or point-credit changes.
Four new failing-first unit tests cover legacy exclusion, assessed-only provisional
values, factor provenance and the accepted CAG calculation. All fifteen backend,
fifteen client and two component cases pass, along with typecheck and affected lint.
Leased PostgreSQL freshness red/green, registered mixed-unit/timeout HTTP proof and
scoped passive DAST are in progress; their result is not yet claimed.

Integrated by gpt-6-astra through Codex (T3 Code).

Impact integrated execution: the disposable freshness negative control failed at
exactly the pending interval, retaining the obsolete 2 kg without the guard.
Corrected PostgreSQL18/Node24 passed all three cases. Registered HTTP proved
CO2-only 5/9 kg with a legacy receipt excluded and unchanged, actual lock-induced
57014 returning503 without totals, and successful recovery. Initial HTTP fixture
auth configuration failure is retained separately; only the corrected run passes.

Pinned passive ZAP against actual createApi observed11 Impact URLs, passed60
rules with zero alerts, and verified all seven actor/origin cases. Responses
passed the strict contribution schema and no-store/nosniff checks with no account
IDs, coordinates or tokens in aggregates. The initial missing scanner report
directory failure is retained; correction created it inside the container without
host mounts. All owned PG/Node/ZAP containers, private networks and copied contexts
were removed. Full/security checks remain in progress. CI stays paused; native
rendering, deployment activation and real populated travel remain unverified.

Verified by gpt-6-astra through Codex (T3 Code).

The final integrated `pnpm check` and `pnpm security:check` pass. Source secret/SAST
scans found no findings; one existing moderate dependency advisory remains, with
no high/critical blocker. Scanner positive/negative controls pass. Docker inventory
confirms no owned Impact containers/networks remain, and the heavy slot is released.
Evidence is retained privately under `.evidence/impact/`; previous review receipts
remain intact. Final CO2 source review and root squash remain pending. No full-app,
native, provider or deployed proof is claimed.

Verified by gpt-6-astra through Codex (T3 Code).

## Native participation client, 2026-09-26

The fan participation client now validates the registered ranking, owner History
projection and contribution response. Decimal ranking totals and opaque cursors
remain exact. Contribution confirmation accepts whole points from 10 through the
server integer limit and rejects selected/fulfilled entries. The existing private
paid-intent queue retains original request IDs and amounts across lost responses,
remounts and matching-profile reauthentication. Server roles, prices, eligibility
and atomic debits remain authoritative; no backend code changed.

Local proof: 38 focused participation/submission/resource tests pass, plus two
additional History moderation/pagination cases; TypeScript
check passes. New tests were authored before their implementation. They cover
malformed/mismatched responses, literal fan text, duplicate confirmation,
refusals, storage failure and late profile-switch results. These adapter tests
do not establish actual database charging, deployment or native rendering.
The frozen offline install used only cached packages. Static alternatives are
private local evidence pending user selection through the coordinator. UI,
full/security checks, allocated device proof and real PR delivery remain pending.

Implemented by gpt-6-astra through Codex (T3 Code).

### Selected B native contribution review

User selected B. Rewards now mounts fan voting after the existing paid submission
form in Redemption, and current participation status after submission moderation
in History. The existing sections, main navigation and palette are unchanged.
Selecting an eligible entry replaces only the ranking with its text, exact total,
amount and explicit non-refundable confirmation. Cancel sends no request. A
successful receipt returns to ranking and refreshes balance; a failed refresh
cannot erase that receipt. Unknown outcomes retain the original intent, block a
new contribution and recover after remount. Refusal reloads current server status.
History deduplicates operation-linked projections by submission while original
ledger entries and moderation receipts remain unchanged. Selected/fulfilled
entries show closed contributions; fulfilment remains labelled demonstration.

Ten focused component tests pass after failing first on absent components;
focused lint and TypeScript pass. These use controlled adapters and DOM renderers,
not native proof. Real backend charging, full checks, security and native proof
await the allocated slot. No cloud, provider, CI or device action ran. The old
"Voting is not available here yet" copy now states approval is required.

Implemented by gpt-6-astra through Codex (T3 Code).

Native B candidate refreshed onto actual main `188baa44`. Append-only record
conflicts retained both task histories; no app source conflicted or peer source
was copied. The task's TODO was restored from its captured stash object and stays
unstaged. On the refreshed tree, 40 focused API/controller/resource tests, all ten
component tests, TypeScript and focused lint pass. A registered-HTTP/PostgreSQL
proof is prepared under the feature testing directory but has not run. Full and
security checks, services/builds and native proof remain explicitly queued behind
the migration owner. The local evidence plan describes the synthetic fixture and
cleanup; no provider, cloud or CI action occurred. Candidate is not yet pushed.

Verified by gpt-6-astra through Codex (T3 Code).

### Registered HTTP and complete source gates, 26 September 2026

Rebased onto main `575787768868946dbc34a1bbe0d00298936ecfe9`; append-only record
conflicts preserved both owners. The prepared actual HTTP/native-adapter fixture
passed on disposable PostgreSQL 18 and Node 24.20.0, sharing an internal Docker
network with generated credentials and no host mounts or ports. It proved three
500-point fees including rejection, exact 10-point replay, a lost 20-point result
recovered with its original key after selection, refusal of fresh frozen votes,
selected/fulfilled History, and anonymous/foreign/real-demo isolation. The initial
container dependency copy missed transitive `xtend` before executing the fixture;
the complete dependency closure fixed that prerequisite and a fresh run passed.
Both containers and their network were removed and confirmed absent.

Full `pnpm check` and `pnpm security:check` passed serially. SAST scanned 273 targets
with zero findings; dependency audit passed the high-severity gate with one
moderate advisory. Scanner negative fixtures failed as intended. No CI, provider,
cloud or shared-database operation occurred. The heavy-check lease is released.
Root separately authorized an exclusive Pixel then iPhone window with existing
compatible binaries and current JavaScript; native proof remains in progress.

Verified by gpt-6-astra through Codex (T3 Code).

### Native participation proof and final refresh, 27 September 2026

PR52 source `04956709` received two independent CLEAR reviews through root.
Existing Expo Go clients loaded that frozen worktree through current-source Metro
on Pixel 10 Android 16 and iPhone 17 Pro iOS 26.5. Both showed B review/cancel/confirm,
selected/fulfilled and rejected History, four tabs and separate empty sample
profiles. Pixel deliberately lost a committed 10-point response; app restart
restored the original intent and same-key retry returned its receipt without a
second debit. iPhone numeric keyboard entry/dismissal and post-confirm restart
were observed. No native build or provider call occurred.

Android largest 3.2 text kept contribution controls reachable. Existing dock
labels wrapped without missing letters; iPhone largest labels also wrapped.
Android keyboard visibility and iPhone largest contribution controls remain
unverified. The latter's History remained scrollable with direct swipes after the
standard automation scroll stalled. Screenshots, videos, exact layout measurements,
logs and fixture entry are retained in `.evidence/native-participation/`.
Both original text settings were restored, synthetic sessions signed out and
recordings stopped. Pixel remained booted; iPhone returned to shutdown. Owned
Metro/API ports 58079/58242 have no listeners; disposable PG/Node/network were
removed and verified absent. All device/Metro/fixture leases are released.

Rebased onto main `a92b9d28b8b7298e0a4e569081084878909fe06c`. Participation source,
Rewards wiring and its component tests remain byte-identical to native-tested
`04956709`; App/Impact and API/Reports match current main. Forty focused client
and ten component tests, typecheck and affected lint pass. An initial wrong Node
runner failed module resolution before execution; the repository Jest runner
passed. Prior full/security/HTTP receipts remain valid prior-base evidence, with
no broad rerun under root's resource limit. Combined native integration and root
squash remain separate gates; CI remains paused.

Verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-26: native journey successor restored

Related to #8, #7 and #10. Created the authorized native branch from main
026b4d70 after confirming the clean old OneMap branch and T3 binding. Applied
only preserved stash a56c0089, including its ten untracked files. The stash and
old branch remain intact. This successor prepares one new PR; PR43 is complete.

Local source now connects prepared route selection to native recording and the
selected Travel UI B. Recording replaces comparison; arrival/stop remain usable
during sync; an explicit action restores planning. GPS samples and retry intents
use AES-encrypted SQLite with a device-only SecureStore key. Account invalidation
stops capture and clears the queue. Google step shapes and continuous OneMap leg
shapes retain their provider ordering; the new assessor uses observed lower-bound
distances and rejects incomplete or ambiguous multimodal attribution.

Focused controlled checks cover Stop/late Start races, denied permission,
offline mutation identity, restart, profile isolation, planning request identity
and recording controls. These checks are not device or physical-travel proof.
The final provisional receipt awaits the awards owner's merged schema. Full
gates, native compilation and T3 device verification remain queued under the
root lease. No CI query, provider request, cloud change or publication occurred.

Implemented locally by gpt-6-astra through Codex (T3 Code).

### Native explicit CO2 adapter, pending awards integration

Prepared the native route parser, Travel labels and provisional receipt copy for
the awards owner's distinct CO2 transport variants. Receipt measurement absence
preserves legacy CO2e. Focused tests reject mixed units and unknown measurement
versions, preserve the retained savings amount, and keep CO2/CO2e labels separate.
Shared emissions/recommendation files are unchanged. Typecheck and focused lint
pass. These local adapter checks do not establish integration with unmerged PR50;
main squash, full gates and leased native proof remain pending.

Edited by gpt-6-astra through Codex (T3 Code).

### Native integration with Awards main 458cae12

Integrated the actual merged main after preserving native WIP and both stashes.
Retained merged factor/release/Start behavior and restored only owned native and
leg-attribution changes. Native34 and provider/planning/legs24 focused tests pass.
Root authorized one readiness caller adjustment for the expanded assessed-method
union. Exact membership comparison preserves the physical release's original
single-mode coverage; a regression rejects leg geometry as unvalidated while
legacy single-mode remains ready. Typecheck, readiness12, changed-file lint and
diff checks pass. Full/security/database/build/device gates remain root-leased;
no provider, CI or production activation occurred. The bounded execution sequence
is retained in local native evidence.

Edited by gpt-6-astra through Codex (T3 Code).

### Native source freeze and internal build checkpoint

Integrated Reports main d079833d and Impact main a92b9d28 through actual main,
with owned WIP and TODO preserved. Full check passed on d079 plus native source
(native/unit Jest170, DOM25, repository Node suites), security check passed with
one existing moderate advisory, and 51 isolated PostgreSQL/HTTP tests passed.
The owned database was removed. Impact integration passed typecheck, 49 focused
state/client cases and four affected DOM cases. App remains a two-line observer
addition against integrated main.

The native assessment decoder now accepts the merged server's unvalidated and
physical_validated statuses; a failure-first focused case protects reading both
without granting client authority. Android ARM64 debug compilation and both
platform exports passed. Root authorized matching iOS bundle ID
xyz.theynr.amrfanapp solely for internal simulator proof; CocoaPods was installed
locally. iOS compilation and device acceptance remain pending at this source
freeze. No final user APK, live provider or factor activation is claimed.

DAST remains failed: scanner exit2, 59 passes, five 10202 admin-form warnings and
informational10031. Independent review matched the exact scanned d079 image and
nine source hashes; root accepted the existing narrow five-form disposition for
this delivery. Impact's additive route was separately reviewed and not scanned;
admin forms/auth/origin behavior is unchanged. No scanner suppression or green
claim. Raw evidence and generated native projects remain local and unstaged.

Implemented and verified locally by gpt-6-astra through Codex (T3 Code).

### Independent native review corrections

Rebased the frozen source onto Participation main e3577631 at the completed iOS
build boundary; native config and dependencies are byte-identical. Both native
compiles passed. Three independent findings were reproduced with failing tests:
late identity cleanup erased successor capture; native settlement decoded the
outer HTTP envelope as an award; and clearing a finished pending settlement lost
its retry identity. Recorder cleanup now blocks successor restore/Start, native
settlement validates entry/outcome and ownership, and clear/replacement waits for
an acknowledged terminal receipt. Legitimate no-award receipts still allow clear.

Deferred-stop tests cover both profile changes and same-profile restoration.
Actual registered HTTP fallback, physical, provisional and CO2 outcomes decode
through the native client, including 401 mapping and unchanged replay keys.
Client38, DOM3, registered HTTP7, typecheck and changed-file lint pass. Native
module builds predate these JS-only corrections; device bundles use corrected
source. Pixel installation found an existing signature mismatch and stopped
without deleting the installed app or its data. Root owns the internal install
identity decision; no device journey success is claimed at this checkpoint.

Fixed by gpt-6-astra through Codex (T3 Code).

### Native journey device corrections

Actual internal Pixel proof found Android AESSealedData.fromCombined rejects
stored base64 strings at its ByteArray bridge. Decode ciphertext to bytes before
native decryption; encryption/key storage and Start ordering are unchanged. The
adapter regression fails before the correction and passes afterward, together
with 21 recorder cases. Device retry recovered the original encrypted intent
and sent one exact two-field Start without another provider request. Its first
location callback exposed TaskManager's missing RECEIVE_BOOT_COMPLETED manifest
permission. Added that required Android permission; rebuilt callback/finish and
iOS proof remain pending. The .nativeproof suffix is generated-only and protects
the existing installed app/data. All temporary diagnostics were removed.

Edited by gpt-6-astra through Codex (T3 Code).

### Native iOS transient errors and offline Finish

Scoped iOS code0/kCLErrorDomain to its documented transient locationUnknown
behavior, awaiting valid callbacks without generating samples or Finish. Native
account refresh now suspends recorder dispatch while preserving local Stop and
Finish intent; authenticated restore resumes the original request. Explicit
identity invalidation continues to hide/delete old capture synchronously. Root
authorized this journey-only adaptation; account modules are unchanged. Current
29focused recorder/storage/runtime and4Recording DOM checks, typecheck and
changed-file lint pass. Actual affected iPhone recovery proof remains pending.

Edited by gpt-6-astra through Codex (T3 Code).

### Native recorder asynchronous authority correction

Corrected the reviewed d162 Finish/queued-restore races and audited only existing
recorder context adoption and dispatch boundaries. Evidence upload and Resume
read now recheck authority after durable writes. Restore checks its requested
epoch within the local queue and after storage/native waits before adopting
context. Invalidated writes cannot republish capture. Known 401 uses the existing
synchronous invalidation/serial cleanup barrier; stale rejected requests cannot
expire a later context. Local Finish intent and retry keys remain intact.

Retained failing-first proof has 7 failures and 25 passes. The corrected focused
recorder/runtime/storage set has 39 passing cases, including deferred stop/write,
restore read/status invalidation, and stale 401 recovery. No native module,
authentication module, provider activation, or signing changes. Exact-head review
and continued isolated iPhone recovery evidence remain required.

Fixed by gpt-6-astra through Codex (T3 Code).

### Native journey final local handoff

Application source 6f18ab54738433d2a3a4c1fe7d4753b0b3e69c71 passes full
pnpm check (227 native/unit Jest, 39 web cases and all repository Node stages),
security checks, and final Android/iOS JS exports. Root relayed both independent
spec and safety CLEAR receipts for that exact source. This final documentation
update changes no application, test, dependency or native configuration source.
Main remains e357763181fb594fc643dfa32a3467f80e1f514d, already integrated.

Actual internal Pixel and iPhone builds proved native module linkage. Pixel
exercised denied permission, encrypted recovery, callbacks and Finish. iPhone
proved SecureStore onboarding, background callbacks, offline Stop with two queued
samples, cold restart and same-account reconnect with one Finish, then profile
switch/logout/successor isolation. Largest-text contribution controls were
reachable. The video and sanitized screenshots stay local. Original app/data and
signing identity are preserved; proof APK uses a generated-only suffix.

Raw DAST remains failed exit 2 with 59 passes, alert 10202 on five forms and informational 10031.
Root accepted the existing narrowly matched disposition for the exact
scanned d079 source/image; subsequent reviewed additive main code was not scanned.
Physical calibration, locked callbacks, Android visible numeric keyboard,
native provisional receipt and populated Impact rendering remain unverified.
No provider calls, live factor activation, CI query, production release or final
user APK. Owned fixture/Metro resources are removed, iPhone large text/shutdown
restored and Pixel remains booted/large. Root owns final reconciliation and merge.

Verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-27: Google budget runner with AI accounting unavailable

Tracking: DEPLOY-GOOGLE-001, unlinked. Added explicit schema-only AI installation
for retained 10→11/12, disabled 11→12 and exact disabled replay. Unchanged 0011
is immediately suspended in the locked transaction, with no AI runtime grants.
Reviewed 0012 receives only SELECT and UPDATE(used_attempts). Replay preserves
nonzero exposure, calls, receipts, Google attempts, roles and prior history.
Ordinary initialization/default target 0011 remains unchanged; schema-only mode
cannot convert initialized AI state or later activate through a zero assertion.
The numeric seed is an uninitialized placeholder, not verified historical spend.
Separate liability reconciliation and activation remain outside this change.

Integrated actual main through `3beaf76f0d92d4651b0e2a85ccdd963eabafe415` by rebase;
TODO was byte-preserved and remains unstaged. No peer source was copied. Both SQL
checksums and the runner hash match the frozen independently reviewed candidate.
Two independent reviewers found one fixture defect: the new target 0012 API test
still replayed target 0010. The correction replays the installed target/mode and
asserts target 0010/0011 downgrade rejection, including the omitted default.
Classification: one-off test defect; no runtime or guidance change was needed.
The original patch and corrective delta remain in ignored local evidence.

| Boundary/check                      | Observed evidence                                                                                                                                                    | Limits                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Failing-first options/history       | 9 failures/22 passes before schema mode; separate target 0012 test failed before implementation; all 32 now pass                                                     | Lightweight boundary mocks                                            |
| Transaction and runtime permissions | 83 isolated PG17/Node24 deployment tests plus corrected target 0012 HTTP/award test pass; 0 failures/skips                                                           | Generated local fixture, no production accounting claim               |
| AI disabled state                   | Real runtime read/write/unsuspend/reserve/claim denied; nonzero exposure, calls and receipts preserved; partial/PUBLIC/MAINTAIN/non-owner grants refused             | Current legacy scope only; future 0013 excluded                       |
| Google allowance                    | Committed complete-mode reservation observed before controlled dispatch; concurrent reservations stop at 200; no dispatch after exhaustion; replay preserves counter | Controlled transport, not paid-provider billing evidence              |
| Full check                          | `pnpm check` exit 0: 404 Node and 273 Jest tests pass                                                                                                                | No native/browser observation                                         |
| Security                            | `pnpm security:check` exit 0; zero source leaks/findings over 335 SAST targets; safe/unsafe controls pass                                                            | Four project rules; existing one moderate dependency advisory remains |

Confidence is high for these executed fixture paths. Evidence is in
`.evidence/google-budget-migration/`: separate red logs, `pg-first.txt`,
`full-check.txt`, `security-check.txt`, frozen source patch and review delta.
The first database run passed after the review correction. All exact owned
container/network/image resources were removed, their absence verified and the
lease released. No production migration, provider request, key activation,
cloud change, CI Actions operation, push or PR occurred. Local commit is authorized;
external delivery awaits root's gate. Only runner/tests and operating records
changed; SQL, provider, AI and mobile source remain unchanged.

Verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-27: fixed future AMR AI allowance, locally verified

Related to parent #3. User approved USD10 for new AMR calls through TokenRouter
only on a future dedicated key; prior account USD23.37 is excluded, not asserted
zero. The new quote/schema/store identity is `amr-new-calls-20260927-v1`.
Optional `AI_COST_SCOPE` can assert only that identity. `AI_COST_DATABASE_URL`
remains explicit with no worktree/database fallback. Missing or invalid budget
rows fail closed, including a changed cap. Existing transaction, replay, unknown
and disputed accounting behavior is preserved.

Forward migration 0013 permits only legacy and new scope, suspends legacy
admission and inserts nothing. Legacy amounts, operations, call states and holds
are preserved. Migrations 0011/0012 and deployment-runner source are unchanged. Frozen
0013 SHA256: `1e12732b898e5b022748fa2613114399b163412f60311be4bca4164cf67eb70f`.
Grant contract is unchanged and was sent with the guarded future initializer
contract to the Google migration owner. Their 0012 PR stays separate;
consume runner/SQL changes through main only.

| Boundary                           | Status and evidence                                                                                                       | Limits                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Fixed scope/config                 | Four expectations failed first; all 25 focused tests pass                                                                 | Synthetic data; no production database uniqueness claim                     |
| Offline AI regressions             | All 192 AI tests pass                                                                                                     | No provider calls or activation                                             |
| PostgreSQL preservation/accounting | All 19 cases pass, 2.072 seconds, complete 0001 through 0013 chain                                                        | Isolated PostgreSQL 17.11 fixture only                                      |
| Full repository gate               | `pnpm check` passes on main c528ff54 plus reviewed source                                                                 | Local checks; no CI query                                                   |
| Security gate                      | `pnpm security:check` passes; no source leaks, zero findings from four SAST rules over 336 files; scanner self-tests pass | One existing moderate dependency advisory; not comprehensive security proof |

Integrated actual main `c528ff5453e003f5afc523b107e3d8335e4e3a69` through main
before execution. All owned source, SQL, tests, docs and TODO matched the frozen
reviewed patch byte-for-byte; own bug/work entries were appended unchanged after
main's additions. Both independent source reviews reported zero findings. Only
proof documentation changed after the green gates.

The dependency-install image layer was cached; no package downloads were logged.
Docker checked image metadata. Build CPU/memory were uncapped, with the existing
10-minute command timeout below the authorized 25-minute maximum. Runtime used
one CPU, 512 MiB, tmpfs and an internal network, with generated fixture credentials,
no host ports or mounts. Runner finally cleanup removed its exact container,
network and image, and exact-name inventory confirmed their absence. The heavy
slot was released immediately after serial DB/full/security success. The original
draft stash and local TODO were preserved.

Source-ref inspection found no prior new-scope literal in HEAD/main/origin/main
before changes. Real scope absence, key custody/no dispatch and single database
binding remain a later reviewed operator action. No production initializer,
key access/creation, provider request, cloud mutation or activation occurred.
Evidence: `.evidence/ai-new-amr-allowance/`.

Implemented locally by gpt-6-astra through Codex (T3 Code).

### App feedback presentation preflight, 27 September 2026

Clean starting branch fix/app-feedback-experience at 7754117. Read selected C
DESIGN, onboarding, Account, Home/navigation, accepted account behavior, and
verification/security guidance. The intro labels three screens but its bar
counts five setup steps. Signup currently requires first opening Sign in.
Account settings still switches real/demo profiles and refreshes the session.
Home exposes Photo activity separately from Plan a journey. Its balance renderer
and refresh retry belong to the points owner and remain untouched.

First slice: failure-first numbered progress, direct Log in/Sign up entry and
shorter onboarding copy. Material Home/dock changes stay in local alternatives.
Auth seam proposed to root: Supabase adapter, email flow, native composition,
session lifecycle and stored-session parsing. No provider/backend changes yet.
Dependencies are absent; asked root for a local install/check slot. Requested
better-interface and animate-expo skills were not found in supplied skill roots;
animation work is held. No browser, device, Metro, build, scanner or CI use.

Recorded by gpt-6-astra through Codex (T3 Code).

### App feedback first local slice and selection previews

Implemented consistent Step 1 through Step 5 onboarding labels and separate
Log in/Sign up entry actions. Both open the intended form; email drafts remain
through close/reopen and existing password clearing remains intact. Two new
acceptance tests failed before implementation; all 9 focused DOM tests now pass,
including completion, retained name draft, cancellation and stale auth completion.
The 43 onboarding/session/storage regressions pass. Changed source/tests pass
ESLint, formatting and whitespace checks. Typecheck/full gates and native UI
acceptance remain pending under root's allocation; no push or product completion.

Prepared two local static Home/test-data/Account alternatives. A keeps balance
first with the rounded dock; B puts activity first with a compact balance and
flatter dock. Both retain four tabs, green palette, real unloaded data and a
labelled test-data entry outside Account. Rendered through the owned T3 preview
at desktop and 390 px width with no horizontal overflow; captured screenshots
remain in ignored .evidence/app-feedback. Root's copy correction uses CO₂ and
moves explanatory Account annotations outside the specimen. Broad app UI is held
for selection. Supabase update/reauthentication documentation and current source
were checked; the identity-preserving implementation contract is prepared locally.
No live auth mutation, email, provider settings, server or data change.

The prior Pixel screenshot shows a white OS gesture handle on dark canvas, not
a broad white footer. Actual white-bar diagnosis, compact retry, animation and
real email/password editing remain unfinished. Root has the exact preview paths,
current-state map and auth seam. Loopback preview server remains for selection.

Verified by gpt-6-astra through Codex (T3 Code).

### App feedback A selection

Root relayed user selection of A, balance first with the rounded dock. Retained
corrected local HTML and screenshots as private selection evidence. Stopped the
owned loopback server and closed owned T3 preview tab. Pure illustrative test-data
integration waits for the peer module to reach main; no source copying. Pixel is
left untouched. Auth source and focused tests are in progress independently.

Recorded by gpt-6-astra through Codex (T3 Code).

### Account credential editor, local controlled verification

Prepared real-profile Account name/email/password presentation. Email reads and
updates use fixed-origin Supabase user endpoints, parse only account details and
reject changed subjects. Pending email stays separate from the current email.
Password changes pass current_password and, when requested, a reauthentication
nonce. Send verification code is explicit; no automatic email request or PUT retry.
The credential queue checks account generation across storage, refresh and I/O;
logout cannot dispatch a waiting edit or publish its response to another account.
Real-profile name edits preserve a selected demo preference and every balance.

Official current password guide and server implementation support current_password;
deployed-version support is not proven. Supabase OpenAPI lists POST reauthenticate,
but its actual router and official client use GET. The adapter follows GET with
a failing-first request-method regression. Account UI keeps current email visible
while confirmation is pending, preserves the email draft through editor back/forward,
clears passwords on submission/close, and gives bounded recovery messages.

Sources read 27 September 2026: Supabase updateUser and password guides,
auth/internal/api/user.go, auth/internal/api/api.go and auth-js/GoTrueClient.ts.
No live provider request, email, credential mutation, server change or security
setting change. Provider and native proof remain pending. The old sample switch
remains temporarily until the accepted Home test-data entry and explicit exit
land; real-only identity already renders independently of selected demo.

Edited by gpt-6-astra through Codex (T3 Code).

Controlled auth verification: 71 account adapter/session/storage/email-flow unit
cases and 11 Account/onboarding DOM cases pass, plus typecheck and scoped ESLint/
formatting. Includes provider errors, ambiguous PUT outcome without retry,
subject mismatch, failed refresh storage, logout races, pending email, nonce flow
and secret clearing. A reported baseline onboarding timer flake is corrected by
holding fake timers for the transient completion assertion, then advancing them;
reduced-motion production timing is unchanged. Full/security/native/live-provider
checks remain unverified under the scheduled resource and test-account gates.

Verified by gpt-6-astra through Codex (T3 Code).

### Onboarding completion and compact retry, separate light slice

Added a one-shot 180 ms illustration fade with Reanimated's typed cubicBezier;
reduced motion disables the animation. Completion remains statically visible for
220 ms under either motion setting. Failing-first timer tests retain progress 5,
Setup complete and final app-entry assertions. The balance error retry now uses
a 48 pt circular icon button with its existing accessible name and callback.
The focused retry test failed against the former wide button, then passed.

All 9 focused onboarding/retry DOM cases, typecheck and scoped ESLint pass.
Frozen auth 73e35f4 is unchanged. Native rendering/motion/touch proof and broader
gates remain pending; no full gate, provider request or device interaction ran.
Selected Home A integration waits for the fixture module to merge through main.

Edited by gpt-6-astra through Codex (T3 Code).

### Frozen auth review corrections

Reproduced and corrected all three independent findings from 73e35f4 in a separate
slice: nonce-step loss on foreground resume, stale dispatch after configuration
await, and ambiguous PUT body failure. Preserved the frozen commit for review.
Hoisted only non-secret editor navigation/email draft, bound to account/session;
password and nonce still clear on editor unmount. Tests drive the real controller
resume used by the AppState active handler, including the intermediate loading
state, and prove explicit code requests, blank secrets, retained email draft,
logout/same-account re-entry and account-switch clearing. This is controlled DOM
proof, not an actual native email-app round trip.

Cold-config tests drive the real adapter/controller with synthetic transport for
GET user, PUT user and GET reauthenticate. Logout blocks each before dispatch.
Response-body rejection, malformed JSON, malformed account and oversized body
all produce bounded PUT uncertainty with exactly one request. Existing subject,
provider error, session race and storage protections remain covered. No live
provider call, email or credential mutation occurred.

Focused proof: 76 cases across Supabase/session/email-flow, 12 Account/onboarding
DOM cases, typecheck and scoped ESLint pass. Full/security and native gates remain
pending with root; the fixture's earlier baseline timer failure remains recorded
separately from its subsequent clean serial pass. Main fixture consumption waits
until this auth fix is committed and frozen for rereview.

Corrected by gpt-6-astra through Codex (T3 Code).

### Selected A Home and separate test-data presentation

Consumed fixture PR57 only through fetched origin/main at
3beaf76f0d92d4651b0e2a85ccdd963eabafe415. Main merged cleanly after auth correction
40801d3; both independent correction reviews reported zero findings. Native and
live-provider proof remain unverified despite those controlled review passes.

Moved Home presentation into its own owned component. Balance remains first;
View rewards opens Redemption and History opens History. Photo and Plan use equal
rows with the selected concise copy and existing callbacks. The dock's four tabs,
geometry, canvas and OS gesture affordance are preserved. No white-bar fix claimed.

Home now opens the readonly illustrative fixture in a separate labelled view.
Opening/closing it never changes account context. A visible explicit action opens
existing saved test data, preserving the old capability outside Account. Every
normal tab shows the saved-test-data label and Return to real data when selected;
failed return keeps the selection and explains recovery. Account/greeting use real
identity. Account delta after auth rereview only removes the relocated sample
switch; credential logic is unchanged. Example rows have no redemption/journey
callbacks and cannot fulfil rewards or award points.

Four new acceptance failures preceded implementation: two Home navigation/data
cases and two label/switch-relocation cases. All 30 focused Home, Account,
onboarding, retry and existing photo-flow DOM cases now pass; typecheck, scoped
ESLint/formatting and whitespace checks pass. Full/security/native/actual rendered
A proof await root allocation after the parser slot. No push, build, Metro,
provider request, email or device interaction ran for this slice.

Edited by gpt-6-astra through Codex (T3 Code).

### App feedback: frozen gates and partial native video proof

Exact 04dc403561010e3c27b6167f5096c787a8b2d7dd passed pnpm check then security:check
serially: 257 unit and 48 DOM tests plus subsequent chains; source scan zero findings, configured
audit threshold passed with one moderate advisory. Both independent source reviews
reported zero actionable findings. Earlier base 775 onboarding timing failure is
retained; this candidate's successful run does not erase it.

User selected A is now observed in reused Pixel nativeproof and iPhone native apps
with 04dc Metro JS. Local videos show balance-first Home, Photo/Plan entry, labelled
illustrative and saved data, explicit saved 875 to real 55 return, real Account identity,
native keyboards, and all four tabs at largest text. iPhone compact retry measured
48 × 48 pt in the native tree and recovered the fixture balance. Pixel synthetic nonce
step survived foreground, then password update succeeded once; iPhone email draft
survived foreground. Secrets were entered off-camera. No real email/provider/DB.

Evidence remains local in `.evidence/app-feedback/native-video-receipt.md`, with
exact clip paths, approximate anchors, runtime lineage and export warnings. Some
Android clips encode shorter than the requested window. Videos are mostly 480 px
high; screenshots retain clearer text. Earlier unrecorded steps are not claimed
as filmed. These reused debug binaries do not establish final release behavior.

No broad white footer was reproduced or fixed. Largest text wraps dock labels.
First three intro steps, reduced-motion native behavior, exact completion timing, same-device
account switching, final release and live provider confirmation remain unverified.
All saved records/storage remain intact. Pixel large text/boot state and iPhone
large text/shutdown state restored; own CLI sessions and panels closed; fixture
and Metro processes stopped with ports 54872/8087 verified closed. Root lease released.

Recorded by gpt-6-astra through Codex (T3 Code).

### Signup error guidance: independent correction, 2026-09-27

Started from clean 03a836315eaf671a958748470ed8745226740fc0, verified as origin/main
with read-only ls-remote. Supabase signup now maps unambiguous modern string code
and legacy error_code (including matching numeric HTTP code) to fixed safe copy.
Conflicting or malformed envelopes and unknown/duplicate errors stay neutral.
Weak-password reasons are restricted to length, characters and pwned, without
inventing a minimum or character classes. HTTP 429/5xx retain their own guidance
with malformed bodies. No raw response strings, new requests or automatic retries.

Confirmation-only signup and unconfirmed sign-in now say to check email and open
a confirmation link if received, then return to sign in. This proves neither
account creation nor delivery. Real email-flow/controller tests keep the caller
signed out with no app exchange or storage; the Account DOM case retains the
email draft, clears the password and leaves the sheet open without code/resend.
Automatic-confirmation session exchange and existing cancellation remain covered.
AccountPanel.tsx, session.ts, native-auth.ts, server/config and layout are unchanged.

| Boundary / criterion   | Observed evidence                                                                                                                                                | Limits / confidence                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Provider error output  | Both envelopes, numeric legacy status, conflicts, malformed fields, unknown/duplicate, weak-reason allowlist, raw-body rejection and one-request assertions pass | High for synthetic cases; no live provider test           |
| Confirmation authority | New/sanitized user responses stay signed out; no app exchange/storage/resend; auto-confirm success passes                                                        | High for tested flow/controller paths                     |
| UI/state preservation  | 13 Account/onboarding DOM tests pass, including email retention, password clearing and late cancellation                                                         | Controlled DOM only; native appearance unverified         |
| Focused regression     | 125 account unit cases pass; initial failure-first run had 42 failures and 30 passes                                                                             | Full/security/DB/native/CI checks deferred to root's slot |

Node 24.20.0 and pnpm 12.6.0 frozen install, typecheck, scoped ESLint/Prettier and
whitespace proof passed serially. Receipts are private under
`.evidence/signup-error-guidance/`. No live signup/email/provider mutation,
browser/device, database, CI, push, PR, merge or deployment was performed.

Primary sources read 27 September 2026: [Auth error envelopes](https://raw.githubusercontent.com/supabase/auth/master/internal/api/errors.go),
[legacy HTTPError](https://raw.githubusercontent.com/supabase/auth/master/internal/api/apierrors/apierrors.go),
[auth-js version precedence](https://raw.githubusercontent.com/supabase/auth-js/master/src/lib/fetch.ts),
[sanitized signup response](https://raw.githubusercontent.com/supabase/auth/master/internal/api/signup.go),
[weak-password reasons](https://raw.githubusercontent.com/supabase/auth/master/internal/api/password.go),
and [password security](https://supabase.com/docs/guides/auth/password-security).
Unlike auth-js's header-based selection, this guidance parser accepts unambiguous
machine codes in either envelope and refuses conflicting codes under any version
header. It never grants authority from an error envelope.

Policy helper remains blocked: the cloud owner's 04:31:21 UTC receipt verifies
minimum six, signup/email enabled and confirmation disabled, but classes and
leaked-password enforcement remain unknown. Root reviewed an optional public
policy-field proposal and held all metadata/server/schema changes until policy
proof and the delivery decision. No hardcoded six, default-false unknowns or
freshness claim was added. This completes only the independent correction slice;
root owns independent review and subsequent gate/publication allocation.

Edited by gpt-6-astra through Codex (T3 Code).

### Signup correction: frozen review and delivery gates

The independent correction at 03fb8a4762d0de427dbdccb75061de81a9d36430 passed
root-allocated serial pnpm check and security:check, both exit 0. Full check:
304 Jest, 49 DOM and 410 tooling/server cases, 763 total passed. Source secret
scan found no leaks; SAST found zero issues across 339 targets. Audit passed the
configured high threshold with one moderate advisory. Scanner safe/unsafe
self-tests passed. No database service/integration, DAST, native or live-auth
verification ran. Root relayed two independent exact-range reviews, both clear
with zero findings; reviewers read focused evidence without rerunning it.

Delivery authorized after these gates. Fetched origin/main remains 03a8363, so
no rebase is needed. This proof-record update changes no implementation or tests.
The existing branch has no PR. The repository has no size labels, and the
current author is also its owner, so size labelling and human review assignment
remain unassigned. No new label or self-review request. Password helper and
public policy delivery remain held, and no complete signup-rule claim is made.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-09-27: explicit OneMap access-token file, local candidate

Thread `mcp:7520bee2-5ba4-4381-846e-3e62b97fd610`, branch
`fix/onemap-live-routing-setup`, base `0d27a7bb9620ffca2d529a6a4c02c1f755d7df7c`.
Related route work #6/#7; token-specific steering remains unlinked. Root authorized
only configuration, adapter, directly affected tests/setup docs and local records.

Added explicit access-token-file mode with a required offset-bearing operator
cutoff. Account credential exchange remains supported. The bounded private reader
is shared; no provider URL override or fixture credential escape was added.
Every token-file dispatch checks the 60-second cutoff margin. Invalid files,
observed expiry and HTTP 401/403 latch unavailable status until restart; tokens
are read lazily and cached per instance. There is no refresh, fallback or public
schema addition. Existing mode outcomes explain partial failures. Already
in-flight requests can finish after expiry/rejection; no subsequent dispatch is
allowed. Replacement requires privately updating token and cutoff, then restart.

The reported 2026-09-30 expiry has no verified time/timezone. The separately
approved initial operator cutoff is 2026-09-29T00:00:00+08:00. Neither the real token
nor this cutoff is embedded in implementation, fixtures or environment defaults.
The saved token had passed named-only private-file/syntax validation earlier;
implementation tests did not reread it. Provider validity remains unverified.

| Proof                     | Observed                                                                                 | Limits                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Failure-first token tests | 9 failures, 1 preservation case passed before implementation                             | Synthetic files and intercepted fetch; no live provider                         |
| Final route suite         | 57/57 pass, including 11 token-file cases, account renewal and Google budget regressions | Existing loopback fixtures plus synthetic fetch interception; no DB integration |
| Static checks             | Typecheck, focused ESLint, affected-file formatting, diff whitespace pass                | No full aggregate or security scan slot authorized                              |
| Documentation structure   | 15 skills and 44 maintained documents pass                                               | Structure/content review only                                                   |
| Installation              | Frozen lockfile, scripts disabled, all packages reused                                   | No package/lockfile change or build                                             |

Evidence: `.evidence/onemap-token-file/`, including red/final logs and review diff.
The minimum hosted prerequisite is proving the assigned file's server UID, mode
0600, regular-file status, single link and external resolved parent; an incompatible
mount needs a private server-owned copy, not weaker validation. Root coordinates
cloud085 provisioning. No live routing, hosted file, database, native, CI, full
security, commit, push or PR proof is claimed. No Google/auth/journey/UI source
changed. Independent review and later activation remain with root.

Implemented and verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-27: opt-in hosted OneMap private copy, local candidate

Separate slice in thread `mcp:7520bee2-5ba4-4381-846e-3e62b97fd610` after the
reader candidate completed its gates and released the heavy slot. Reader gate
receipt: final full check exit 0 (774 tests), security exit 0, no remaining owned
processes/containers/temp files. Initial full check and one redundant unchanged
rerun exited 1 on the new work-entry table formatting. Only seven table-alignment
lines changed; security-source equivalence is recorded in the frozen evidence.
Initial Docker preflight failed on its missing socket; root restored OrbStack and
verified Docker 29.4.0 before security. Those gates do not cover this later helper.

Added `server/api/onemap-secret.ts`, `start-onemap.ts` and focused startup tests.
The opt-in `pnpm api:start:onemap` uses the fixed mounted path, bounded regular-file
descriptor read, fresh external current-UID-owned 0700 directory and exclusive
0600 single-link copy. It assigns the private path before importing existing
`start.ts` in the same process. Preparation/import errors are fixed messages.
Cleanup removes only its exact file/directory, never recursively or from the
managed mount. SIGTERM/SIGINT before handoff terminate after cleanup so pending
imports cannot resume; existing API handlers retain ownership after handoff.
SIGKILL/host loss or shutdown that never exits can retain the ephemeral copy.

Routing-disabled staging validates a future cutoff and single-token syntax while
leaving the provider disabled. A sanitized event reports path, UID, numeric modes,
link count and selected provider. It is metadata proof only. Existing default
`api:start`, `start.ts`, strict token reader, token tests, Google/auth/journey source
and dependency lockfile are unchanged from the frozen reader candidate.
The example and procedure document the explicit command; no real configuration,
cutoff default or token is embedded. Root owns staged release order and activation.

Proof: 11/11 behavioral cases failed against the initial helper stub. Final focused
route/startup suite passes 71/71, including 14 helper cases. Synthetic copy is
accepted by the unchanged reader; disabled staging makes zero provider calls.
Signal tests use real `start.ts` and API listener with a substituted synthetic DB
module, not a real DB connection. Both SIGTERM/SIGINT cover preparation (synthetic
signal emission), before import, during the pending DB readiness query and after
handoff; exits, listener closure and cleanup are asserted. Import and copy failures
are sanitized. Focused typecheck/lint/format and document structure checks pass.

Evidence and separate helper delta: `.evidence/onemap-startup-copy/`. Full/security
checks for this new slice require a new root slot. Hosted mount compatibility,
real DB startup and live routes remain unverified. No real token read, provider
call, cloud/device/CI/Git delivery, or default start behavior change occurred.

Implemented and verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-27: preserve API availability after OneMap token expiry

Root corrected the protected criterion after accepting the combined 788-test and
security-green candidate: an expired route token must not prevent unrelated API
startup. This one-off design correction supersedes only the wrapper's future-cutoff
requirement. The earlier green receipts remain unchanged in evidence.

Removed only two wall-clock rejections from `server/api/onemap-secret.ts`.
The cutoff remains mandatory and syntactically validated, and all private-copy
checks remain intact. Expired/within-margin cutoffs now permit startup/health with
either `disabled` or `onemap` selected. The unchanged route adapter still checks
expiry before token use and each dispatch, returns unavailable and makes no fetch.
No provider switch, fallback or environment rewrite was introduced.

Failure-first proof: 14 existing cases passed and four new expired/within-margin
startup cases failed before implementation. Final focused route/startup suite passes
77/77, including actual `start.ts`/API listener health requests with a synthetic DB.
All four cases return health HTTP 200, refuse route use and report zero provider
fetches through orderly exit. Missing/malformed cutoffs still fail wrapper startup.
The new HTTP assertion exposed an existing double-fetch-mock restoration problem;
the test now uses one updated mock plus a bounded loopback health request. A test
callback type mismatch was corrected before final typecheck. No production reader,
configuration, default startup, signal handler or private-file guard changed.

Focused typecheck, lint, formatting and docs checks passed. Evidence and minimal
correction patch: `.evidence/onemap-expiry-availability/`. Earlier full/security
passes do not cover this correction; no heavyweight rerun was authorized. Real
hosted files, DB startup and provider routes remain unverified. No real token was
read and no provider/cloud/device/CI/Git delivery action occurred.

Implemented and verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-27: diagnose OneMap startup failures without exposing secrets

The inactive exact-source deployment failed with only a generic startup message.
Missing staging stdout did not identify a failed file check or exclude API import.
This one-off implementation correction adds bounded diagnostics, not a hosted
cause determination. Previous full/security green receipts remain unchanged.

The opt-in entrypoint now emits one `onemap_startup_failed` stderr JSON object
with a fixed stage, allowlisted errno and optional `cleanupFailed: true`. Source
and copy close failures cannot replace an earlier failed operation. Preparation
or import cleanup failures are folded into that same object. No raw exception,
message, stack, cause, path, token, hash or environment is serialized. The
`api_import` stage identifies failure after staging. Signal/exit cleanup reports
at most once. All file/config/cutoff guards, default API startup, provider modes
and existing lifecycle ownership remain intact; no fallback or retry was added.

Failure-first proof: all 12 new diagnostics fail against the unchanged helper
with corrected synthetic fixtures. Final route/helper suite passes 89/89, including
missing mount, symlink, nonregular source, malformed token/config, copy-write
failure, original-stage preservation through close/cleanup failure, sensitive
code/message redaction, throwing code accessor, and import failure. Existing
lifecycle tests use actual API startup/listener with a synthetic database module;
there is no real DB or provider access. Typecheck and scoped lint pass.

Intermediate failures are retained: Node strip-only syntax rejected constructor
parameter properties; test setup needed NODE_ENV; fixture directory redirection
violated the canonical-parent check; unbounded filesystem mocks interfered with
the module loader. Corrections use ordinary fields, an isolated TMPDIR and only
the synthetic token descriptor. No production guard was relaxed.

Evidence and frozen correction: `.evidence/onemap-startup-diagnostic/`. Full and
security reruns await review and a coordinated slot. The mounted source, private
copy and runtime path still need hosted proof before activation. No real token
read, provider/DB/cloud/device call, deployment or Git delivery occurred.

Implemented and verified by gpt-6-astra through Codex (T3 Code).

Independent spec review found primary cleanup lost its filesystem errno at two
error boundaries. A synthetic orderly-exit cleanup case failed with OTHER instead
of EPERM, then passed after both boundaries retained the sanitized failure.
The focused startup suite passes 33/33; typecheck and scoped lint pass. Secondary
cleanup tests still preserve copy_write/EACCES and api_import/OTHER with only
cleanupFailed added. The first frozen patch and red evidence remain preserved.
This one-off implementation correction changes no guards or default lifecycle.
Hosted logs still execute the earlier merged source without these diagnostics;
no hosted cause or deployed fix is claimed.

Corrected and verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-27: load the fixed managed OneMap secret through indirection

The coordinator observed source_open/ELOOP on the diagnostic release. A synthetic
symlink at the fixed production source reproduced that failure. This supports
no-follow rejection as the failing boundary; it does not prove the full hosted
mount layout or provider credential validity. The coordinator approved trust in
provider control of the fixed mount and resolved target ancestry.

Only source equal to `/etc/secrets/amr-onemap-access-token.txt` is now resolved
once. The target is still opened O_RDONLY|O_NOFOLLOW|O_NONBLOCK. Added fixed
source_resolution diagnostics without logging resolved paths or raw errors.
Arbitrary injected paths retain symlink rejection. All descriptor regular-file,
size/read/syntax checks, buffer clearing, exclusive private-copy metadata checks,
strict destination reader and lifecycle behavior are unchanged. No new setting,
fallback or retry was introduced. Final-target symlink swaps are rejected;
ancestor replacement is not atomic and no provider target layout is assumed.

Failure-first proof: six of seven policy cases failed before implementation;
arbitrary-path rejection already passed. Startup tests then passed 38/38 and the
route/startup regression suite passed 95/95. The real-entrypoint symlink fixture
now reaches staging before its intentional synthetic import failure. Missing,
broken and looping paths report source_resolution; a final-target symlink swap
still reports source_open/ELOOP. The private-copy acceptance fixture verifies
regular/current-UID/0600/single-link metadata, 0700 directory, unchanged source
symlink and disabled provider. Existing lifecycle cases use a synthetic DB module,
not a database connection. Initial typecheck found untyped mock parameters;
explicit filesystem types correct this without production/runtime changes.
Final typecheck, scoped lint, formatting and documentation checks pass; the seven
policy cases pass again after that test-only type correction.

Evidence and separate correction: `.evidence/onemap-managed-source/`. Full/security
await independent review and a slot. Hosted fixed mount to private copy to runtime
path, API health on this change, and live routes remain unverified. No real token
read, provider/DB/cloud/device/CI/deployment or Git delivery occurred.

Implemented and verified by gpt-6-astra through Codex (T3 Code).

## 2026-09-28: provisional Expo News tab for standalone RSS feed

The user selected the Expo phone app for a fifth News tab while the separate
Swift design is in progress. Added `src/features/news/` with bounded RSS 2.0
parsing, official `www.astonmartinf1.com/en-GB/news/` article URL validation,
deduplication, a 50-item display cap, and a 512,000-character feed cap. The tab
shows title, summary, publication date and an external article action. It has
loading, empty, invalid-override, refresh, retained-list refresh failure
and article-open failure states. News now defaults to the verified public Azure
feed (`https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml`) and accepts
an optional public HTTPS `EXPO_PUBLIC_NEWS_FEED_URL` override. The Azure feed is
a manually deployed snapshot; there is no scheduled publication yet. News remains
separate from admin-entered point offers and account/profile state.

Focused parser tests failed first when the module was absent, then passed 6/6.
The live Azure feed returned HTTP 200, `application/rss+xml`, 11,464 bytes and
parsed into 20 stories. All 32 phone Jest suites passed (310 tests). A frozen
pnpm install, affected-file ESLint
and Prettier, and Expo iOS/Android exports passed. The exported Hermes bundles
were about 7.1 MB each; this Windows build has no comparable before measurement.
Full typecheck remains red on four existing server errors in journey and report
files, with no News file error. `agents:check` remains red on existing Windows
skill frontmatter/link checks. `security:check` did not run to completion because
its nested `pnpm` resolves v11 under this shell and the direct scanner requires
unavailable Docker; direct audit passed the high threshold with one moderate
advisory. On the Android emulator the fifth tab loaded real Azure stories with
dates and summaries, and tapping a story launched Chrome. Chrome's first-run
setup prevented verification of the article page; iOS device behavior and
device accessibility remain unverified. The Android screenshot is retained in
ignored `.evidence/rss-news/android-news.png`.

Implemented and verified by gpt-6 through Codex (local Windows).

## 2026-09-28: standalone RSS handoff and Azure snapshot

Created private `ashura-oss/AMR-F1-RSS-Feed` on GitHub and pushed two commits
(`98003da`, `c217779`) with the Python generator, fixtures, 20-item sample XML,
README, scheduler example and Azure static configuration. Local `.dev-team`,
Python caches and deployment output are ignored. The repository remains private;
the published XML itself is public at
`https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml` on an Azure Static
Web App Free plan. The checked-in and hosted XML SHA-256 match exactly
(`928682D59F8CF52AAA63CDC27CF1E446A959597778175C1E8137108964644389`).
The host returned HTTP 200, `application/rss+xml` and 20 distinct ordered
official article links. The generator passed 18 offline tests, and one fresh
live generation matched the checked-in XML byte for byte. No automatic refresh
schedule or deployment pipeline is active; the teammate's hosting handoff still
needs that decision. The deployment token was shown in a tool response during
setup; the user was asked to reset it in Azure Portal. No app repository commit,
push, PR or publication was made.

Implemented and verified by gpt-6 through Codex (local Windows).

## 2026-09-28: News review corrections

The independent reviewer found three failed criteria in the provisional Expo
News integration: midnight UTC publication dates shifted to the prior day for
fans west of UTC, `response.text()` could allocate an unbounded body despite a
small or absent Content-Length, and failed refresh after a previously empty
feed falsely claimed to show old stories. These are one-off implementation
corrections; project guidance is to preserve the source calendar day for
date-only feeds and bound public content while reading it.

Visible and accessibility dates now share a UTC formatter. `expo/fetch` supplies
the native-backed response stream; the client counts at most 512,000 bytes while
decoding UTF-8 and cancels an oversized stream. Missing streams fail closed, and
Content-Length over the cap is rejected early. A refresh failure after an empty
feed now presents the retry state; a nonempty prior feed remains visible with an
accurate last-loaded-stories message. No feed generator, host or points behavior
changed.

The new cases failed before implementation. Focused News suites pass 11/11,
including a western timezone comparison, split multibyte UTF-8, absent and
dishonest Content-Length, missing stream, and both refresh histories. The live
Azure XML parsed as 20 items through the bounded reader. All 33 app Jest suites
pass (315 tests); affected-file lint/format and iOS/Android Expo exports pass.
Full typecheck still reports only the four existing journey/report server errors.
Android Expo Go loaded the public Azure feed through the native streaming path,
showed the September 22 source date, and refreshed without error. The updated
screenshot is retained in ignored `.evidence/rss-news/android-news.png`.
Accessibility output and iOS device behavior remain unverified. No app repo
commit, push or publication occurred.

Corrected and verified by gpt-6 through Codex (local Windows).

## 2026-09-28: final independent RSS and News review

A fresh gpt-6-sol high-effort read-only reviewer found no actionable defect in
the corrected date, bounded stream, refresh state or adjacent parsing paths.
It independently passed 18 RSS Python tests and 315 Expo Jest tests, and read
the live Azure XML as HTTP 200, `application/rss+xml`, 20 items and 11,464 bytes,
byte-identical to the checked-in feed. It inspected Expo 57's installed native
stream and cancellation implementation. Direct TypeScript checking still has
the four previously reported server-only errors. The reviewer did not rerun
device automation or platform exports; the primary agent verified Android Expo
Go live load and refresh after the corrections. The hosted snapshot still needs
manual generation and redeployment for new stories. No extra files, Git state or
external service settings were changed by the review.

Reviewed by gpt-6-sol through Codex (local Windows).

## 2026-09-28: hosted RSS UTF-8 response correction

The user's Chrome screenshot showed mojibake in the public raw XML view. The
hosted response lacked a charset, while the checked-in and hosted XML bytes
matched and parsed accented names correctly as UTF-8. The failed criterion was
readable accented text in the browser view. This is a project-level hosting
lesson: on this Azure Static Web App, a route-specific `Content-Type` header was
ignored when `.xml` had a MIME mapping. Setting the mapping itself to
`application/rss+xml; charset=utf-8` produced the required live header.

The first deployment with a route header still returned `application/rss+xml`;
the second deployment with the MIME mapping returned HTTP 200,
`application/rss+xml; charset=utf-8`, and the same five-minute cache policy.
The published XML remained byte-identical to `feed.xml` (SHA-256
`928682D59F8CF52AAA63CDC27CF1E446A959597778175C1E8137108964644389`),
and a UTF-8 XML parse yielded `Ella Lähdemaa`. All 18 standalone Python tests
passed. Committed and pushed `9c1687e` to the private RSS repository. The
browser automation service returned `ERR_BLOCKED_BY_CLIENT` for raw RSS
navigation after deployment, so the user's refreshed Chrome rendering remains
the final visual check. The user was asked to report that result. No Expo code
or feed content changed; the Azure deployment token reset remains pending.

Corrected and verified by gpt-6 through Codex (local Windows).

The fresh gpt-6-sol high-effort read-only reviewer found no actionable issue in
commit `9c1687e` or the deployed response. It independently passed 18 tests,
verified 20 items, strict UTF-8 decoding, the expected cache and MIME headers,
and byte identity with the committed XML. Chrome rendering remains the only
unverified acceptance check because raw RSS navigation is blocked by the
browser tool and the user has not yet reported the refreshed view.

Reviewed by gpt-6-sol through Codex (local Windows).

## 2026-09-28: official images in hosted RSS and Expo News

The user requested article images in the public RSS feed and Expo News, selected direct links to official Aston Martin CDN images, and authorized Azure deployment. The standalone generator now extracts bounded `og:image` URLs from official article pages and emits Media RSS `media:content` fields. Current `feed.xml` has 20 stories and 20 official images at `w=480`; image files remain on the source CDN. The Expo News screen validates the same host, path, format and 480-pixel transform, renders images with text-card fallback on failure, and initially mounts five stories with a Show more control. Article links, dates and summaries remain as before.

The first independent review found the failed criterion: the generator allowed AVIF while Expo did not, and Expo accepted image widths above the generator's 480-pixel policy. These were corrected before release. This is a project-level lesson about matching media contracts across the RSS and phone repositories; no reusable guidance file was changed. The 20 RSS Python tests and 317 Expo Jest tests pass. Affected ESLint and Prettier checks pass. Full typecheck still reports four existing errors in journey/report server files, with no News error.

Committed and pushed RSS changes `b637b1a` and `8baff27` to the private repository. Azure Static Web Apps production now returns HTTP 200, `application/rss+xml; charset=utf-8`, `Cache-Control: public, max-age=300`, and 15,201 bytes byte-identical to local `feed.xml` (SHA-256 `D96F7A49B01D2EE08605C2E6B2AC34CF7712E831EC5AAB4A6EB94503F55A9C77`). The hosted XML parses as 20 items with 20 official CDN images. Android Expo Go fetched the updated feed and visibly rendered article photos; ignored screenshot: `.evidence/rss-news/android-news-images.png`. The main Expo repository remains uncommitted and unpushed. The previously exposed Azure deployment token still needs owner rotation.

Implemented and verified by gpt-6 through Codex (local Windows).

## 2026-09-28: independent post-deployment RSS image review

A fresh gpt-6-sol high-effort read-only reviewer found no remaining source defect after the image URL contract correction. It independently checked the live Azure response against the checked-in XML hash and byte count, verified 20 items and 20 `media:content` URLs on `assets.astonmartinf1.com` at `w=480`, and inspected the Android screenshot at original resolution to confirm visible article images. It did not edit files or deploy.

Reviewed by gpt-6-sol through Codex (local Windows).

## 2026-09-28: six-hour RSS refresh draft awaiting authority

The user asked whether new stories would update automatically and selected a six-hour cadence. The Azure feed is currently a static snapshot; the Expo Refresh control only reloads what Azure already serves. A private-repository GitHub Actions workflow is drafted locally at `.github/workflows/refresh-feed.yml`, with pinned checkout and Azure deploy actions, read-only repository permissions, a six-hour UTC schedule, manual dispatch, a ten-minute job limit, source tests, production byte comparison, staging of only three public files, and post-deployment byte verification. README handoff text describes the workflow and that activation requires an Actions secret. No workflow has been committed, pushed, or run.

Local proof: the workflow parses as YAML, all four embedded Bash scripts pass `bash -n`, the comparison emits `deploy=false` for the current byte-identical Azure feed and `deploy=true` for a changed local fixture, and all 20 RSS Python tests pass. GitHub Actions is enabled on the private repository and currently has no repository secrets. The project contract requires explicit authority for CI/shared settings; approval to rotate the previously exposed Azure deployment token, store the replacement as `AMR_RSS_SWA_DEPLOYMENT_TOKEN`, push the workflow, and trigger a run is pending. Until then, new stories do not publish automatically.

Drafted and verified by gpt-6 through Codex (local Windows).

## 2026-09-28: public RSS repository

The user authorized publication of `ashura-oss/AMR-F1-RSS-Feed`. Audited all five then-existing commits and tracked paths: no credential-pattern matches, `.dev-team` ignored, and no private evidence or environment files in Git history. Committed and pushed README wording correction as `bc16fc7`, with only that change staged; the drafted six-hour workflow and its separate README edits remain local and unpushed. Changed GitHub visibility from PRIVATE to PUBLIC. An unauthenticated GitHub API read confirms `private=false` and the published README says automatic refresh is not active. The public Azure feed still returns HTTP 200 with 20 Media RSS images. The pending deployment-token rotation and scheduler activation were not performed by this publication action.

Published and verified by gpt-6 through Codex (local Windows).

## 2026-09-28: activate automatic RSS publication

The user authorized automatic publication after choosing a six-hour cadence. The
public RSS repository now has a default-branch GitHub Actions workflow at
`.github/workflows/refresh-feed.yml`: 00:17, 06:17, 12:17 and 18:17 UTC, plus
manual dispatch. It tests and generates from the official source, compares the
validated feed with Azure, deploys changed snapshots, and verifies published
bytes. Manual dispatch always deploys. The job has read-only repository
permissions, pinned checkout and Azure actions, a ten-minute limit, and no PR
trigger. Only the three public static files enter the deployment directory.

The previously exposed Azure Static Web Apps deployment token was reset through
Azure CLI; only the replacement was stored in the GitHub Actions repository
secret `AMR_RSS_SWA_DEPLOYMENT_TOKEN`. Neither token was committed or printed.
The workflow and README were committed as `2884c31` and pushed to public
`ashura-oss/AMR-F1-RSS-Feed` main. The first manual Actions run
`36416358122` succeeded, including tests, generation, deployment, and its own
byte check. An independent public request then returned HTTP 200,
`application/rss+xml; charset=utf-8`, five-minute cache, 20 items, 20 official
image URLs, and 15,059 bytes identical to local generation (SHA-256
`6bff39c84f98b30a2ddf373d3c6488ef98a53a8154c84976df32ae61cd403a28`).
RSS Python tests pass 20/20; YAML schedule validation and all four embedded
Bash syntax checks pass. The main Expo repository's `pnpm security:check` was
attempted but stopped before scanning because local Corepack supplies pnpm
11.19.0 while the app requires 12.x; Docker is also unavailable. The workflow
is active, but a scheduled tick has not yet occurred; its future timing is
subject to GitHub Actions scheduling. The Expo app was not changed, committed,
or pushed for this task. The main repository `agents:check` exits 1 on existing
skill frontmatter and Claude-link issues; its changed-file whitespace check
passes. These main-repository checks do not test the separate RSS workflow.

Implemented and verified by gpt-6 through Codex (local Windows).

## 2026-09-28: independent review of automatic RSS publication

A fresh gpt-6-sol high-effort read-only reviewer independently confirmed that
the default-branch workflow is active, the manual Actions run `36416358122`
completed successfully with deploy and byte-verification steps, and the public
feed returns 20 valid stories with 20 official images and the expected headers.
Its own local RSS test run passed 20/20. The reviewer found no immediate source
defect. The first scheduled tick has not happened yet. GitHub documents that
public-repository schedules may be delayed or dropped and can be disabled after
60 days without repository activity; the public handoff README now records this
monitoring and re-enable condition in follow-up commit `6a11e33`. The workflow
still does not commit snapshots to Git, so the checked-in XML can lag behind
the live Azure feed.

Reviewed by gpt-6-sol through Codex (local Windows).

## Overnight vertical slice progress — 2026-09-29

Gate 1 evidence validation and Gate 2 deterministic activity rewards/missions are implemented locally in the React Native repository. Provider defaults remain disabled. Fixed 50-point rewards are capped at three per real profile per UTC day; canonical duplicate images, durable request replay, mission eligibility and atomic rollback are server-owned. Synthetic image identity is isolated from production, and synthetic mission events are excluded from community totals. New capability and request-recovery contracts are shared data-only schemas for React.

Root verification: 29 isolated PostgreSQL cases passed across assessment, mission, accounting, reward and HTTP suites, including concurrent replay, cap enforcement, duplicate races, UTC historical fixtures and rollback after mission work. Evidence/media/provider-fixture unit tests passed 13/13; impact unit tests 15/15 and award factor/policy tests 22/22 passed. Changed-source ESLint/Prettier passed. Typecheck still reports four baseline journey/report errors. An Astra-medium combined security/quality re-review passed with follow-up for the local provider-disabled slice; it does not clear live-provider or Azure activation. Additional lock-wait/deadline fault proof remains an enablement gate.

Gate 3 impact composition and React wiring are next. No Azure resource creation, deployment, live Luna call or new Blender asset occurred. Android emulator is reachable but the new flow has no rendered proof yet. Existing teammate News changes are preserved.

Coordinated and verified by GPT-6 through Codex (local Windows).

## 2026-09-29: overnight vertical slice final evidence

The approved React Native/backend slice is implemented locally. Fans can submit
one to five canonical photos with a bounded description; the server validates
media, keeps Luna disabled without configured secrets, assesses through a strict
provider contract, issues deterministic 50-point receipts with a three-per-UTC-day
cap, and advances eligible missions atomically. Mission listing/enrollment is
real-profile-only and identity-scoped; demo and signed-out states cannot load or
enroll real missions. The Impact overview keeps approved Aston Martin figures,
personal fan participation and community participation separate, preserves
method/unit/provenance, and excludes demo, pending, rejected, superseded and
synthetic rows from the relevant totals.

Final proof executed after the review corrections:

- Web Jest: 10 suites, 61 tests passed.
- Legacy activity assessor: 9/9; multi-photo activity unit/contract suite: 13/13.
- Impact unit/composition: 18/18; account/auth: 11/11.
- Owned disposable PostgreSQL wrapper: 34/34 across assessment replay, HTTP
  ownership/provider states, mission enrollment/concurrency, exact-once rewards,
  rollback and impact provenance/isolation.
- Changed-source ESLint has zero errors (two pre-existing warnings elsewhere),
  changed-source Prettier and `git diff --check` pass.

The full typecheck still reports four unrelated baseline errors in journey/report
files. Docker is unavailable, so repository secret/SAST self-tests were not run.
Azure files are preparation only: no resource creation, deployment, provider call,
commit or push occurred. Native exports were previously produced for Android, iOS
and web. Android evidence is limited to signed-out Expo Go shell screenshots in
`.evidence/overnight/android/final-browse.png` and `final-impact.png`; authenticated
camera, mission enrollment, reward submission, TalkBack and accessibility behavior
remain unverified. The stale `ui.xml` compile-error capture is excluded from proof.
Blender was audited; no asset or MCP integration was added.

Implemented and verified by GPT-6 through Codex (local Windows).

## 2026-10-07: main-branch Azure staging promotion

The user approved the `main` GitHub OIDC credential for the existing Azure app
registration. Azure now has two federated credentials: the existing
`feat/azure-staging` subject and the new repository- and branch-scoped `main`
subject. GitHub Actions run `37507939282` built the remote `main` commit
`9e6275d373ff1eb27b6f163b8033dbe319edbb5a` successfully. ACR digest
`sha256:a670e5e575e5f7bd869bad9628ea9942c58d95f16bd189e09170134710082e63`
was promoted to Container Apps revision
`amr-fan-api-x324zttj6p6tg--main-9e6275d`; it is running with one replica and
uses the immutable digest. The database migration succeeded, the temporary
migration job was deleted, and the runtime database secret was updated without a
query string. Public `/health` and `/ready` returned HTTP 200 with the database
ready, while an unauthenticated protected session request returned HTTP 401.

This is a staging deployment. Activity assessment remains disabled and route
provider access remains disabled. The local worktree was not reset or pushed;
existing local changes remain intact. The Azure portal showed $197.17 of free
credit remaining with an eight-day expiry at the time of verification, and the
current single-replica staging footprint was forecast below that remaining
credit for the requested week.

Implemented and verified by gpt-6 through Codex (local Windows).

## 2026-10-07: hosted Android emulator validation

Reused the existing `AMR_Pixel_Emulator` (Android 16/API 36, x86_64) and ran
an Expo SDK 57 guest smoke using the Azure API URL as a process-only variable.
Home signed-out gating, News with hosted official images, Impact gating and
Travel gating all rendered; a cleared bounded log capture found no app-level
ReactNativeJS or AndroidRuntime errors. The News snapshot displayed October 1,
so the hosted RSS source is a static snapshot rather than a current-date feed.

The origin/main Kotlin port was extracted into a temporary checkout, built with
an official checksum-verified Temurin JDK 17, and passed `:app:assembleDebug
:app:test` (72 Gradle tasks). Its debug APK installed and launched on the same
emulator. Onboarding, driver selection and the login gate rendered. Pressing
sign-in emitted the expected Entra authorization URL and opened Chrome, but the
emulator was at Chrome's first-run Terms of Service screen. No agreement was
accepted and no credentials were entered. Authenticated account, profile,
journey, camera, points and reward flows therefore remain unverified. Swift
iOS simulator/device validation requires macOS.

Evidence is under `.evidence/hosted-emulator-20261007/` and remains local.
No repository source was changed or pushed for this validation.

Implemented and verified by gpt-6 through Codex (local Windows).

## 2026-10-07: Android Entra handoff completed

The user explicitly approved the Chrome first-run Terms of Service action on the
disposable Android emulator. The Kotlin port's PKCE flow reached the live Entra
custom tab titled AMR FAN APP CUSTOMERS, using the configured HTTPS authority,
client and API scope. I did not enter an email, password, OTP or other account
credential. Closing the custom tab returned to the login gate cleanly. Hosted
API checks remained healthy: `/health` and `/ready` returned 200 with database
ready, while unauthenticated `/v1/me` returned 401.

The authenticated journey, camera/photo submission, profile updates, points,
rewards and route flows still need a test account or user-driven sign-in. A
macOS/Xcode environment is required for Swift iOS simulator/device proof.
Evidence is retained in `.evidence/hosted-emulator-20261007/`. No source code
was changed or pushed.

Implemented and verified by gpt-6 through Codex (local Windows).

## 2026-10-07: Android login failure triage opened

A friend reports login failure on a newly downloaded APK. Read-only comparison
found the origin/main Kotlin port opens the live Entra page and declares the
matching `msauth.com.amr.fanapp://auth` callback. The Azure API currently uses
issuer `https://9dcdff78-04a7-49fc-90bd-e9c7b76e4774/v2.0`, audience
`f278be1f-21a5-455b-bb14-b2fc60373939`, and required scope `account.access`.
The current portal session cannot inspect the separate CIAM app registration.
Exact APK hash/version, Android version, and visible error after submitting
credentials are required before selecting a fix.

Implemented and verified by gpt-6 through Codex (local Windows).
