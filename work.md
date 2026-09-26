# Work record

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
