# Tasks

## TRAVEL-SEARCH-001: selected location search, 2026-10-04

- [ ] Decide the live provider and credential placement. OneMap is the
  recommended Singapore MVP provider; Google remains an adapter option.
- [ ] Add a bounded place-suggestion endpoint with normalized Singapore places.
- [ ] Bind native origin/destination fields to debounced suggestions and keep
  the selected place id and coordinates.
- [ ] Send selected coordinates to route planning and draw exact geometry.
- [ ] Replace the large route CTA with a compact send/arrow action and add map
  controls/icons that preserve access to the suggestion list.
- [ ] Resolve the deployed 401/configuration mismatch before mobile proof.
- [ ] Launch and verify the native builds as separate Mac device apps.

Acceptance: typing a location name shows a bounded list, choosing an item
stores its exact coordinates, selecting both places produces a route between
those coordinates, and no provider credential ships in either mobile build.

## TRAVEL-UI-001: map hierarchy and copy cleanup, 2026-10-04

- [x] Inspect supplied screenshots and Mobbin map references.
- [x] Prepare three local map directions and record the recommended hierarchy.
- [x] Contain the Android map view and remove the redundant Travel Back action.
- [x] Remove internal demo/comparison/backend wording from native Travel UI.
- [x] Format route arrivals for people instead of exposing raw timestamps.
- [x] Run native builds, agent checks and diff validation.
- [ ] Re-run the rebuilt Travel screen on both devices after the Android
  account-gate action is repaired or a connected device state is restored.

Acceptance: the map stays inside its card, route controls remain reachable
above the persistent tab bar, no user-facing Travel copy mentions demo data or
implementation layers, and mixed-mode navigation remains available.

## AUTH-001: iOS account session fix, 2026-10-04

- [x] Reproduce the failed provider callback and identify the first failing boundary.
- [x] Add the iOS Keychain entitlement and safe session upsert.
- [x] Keep raw Keychain status codes out of user-facing errors.
- [x] Run focused Swift auth checks and a signed iOS simulator build.
- [x] Verify sign-in and saved-session persistence on the authorized iPhone 18 Pro.
- [ ] Run the container-backed security check when Docker is available.

Acceptance: a real provider sign-in returns to the connected Account state and
the same installed build remains connected after relaunch; failed storage
does not expose raw OS status to the user.

## TRANSPORT-MVP-001: separate transport API, 2026-10-04

- [x] Pull main safely, inspect existing travel callers and check BB-1 access.
- [x] Write focused acceptance tests for departures, trip timing, disruptions, coverage, HTTP limits and mixed transit.
- [x] Implement a separately runnable Singapore demo transport API with an optional OSRM road adapter.
- [x] Integrate both native apps without changing rewards or account behavior; keep GPS guidance in AMR.
- [ ] Prepare BB-1 hosting; deploy and verify if SSH access is resolved.
- [x] Run focused tests, native builds and authorized iOS/Android device checks; record limitations.

Acceptance: a 10:07 request finds 10:10/10:15 departures on a five-minute
demo service; service hours and downstream stop offsets hold; route timing
includes walking, waits and transfers; deadline/disruption scenarios change
results; mixed public transport can combine train and bus; unsupported journeys and failed road routing stay unavailable;
simulation and map-data provenance are explicit; no paid provider calls or
journey awards. BB-1 deployment remains pending local SSH key unlock.


## PR #71 security audit correction, 2026-10-03

- [x] Reproduce the failing `source-and-dependencies` audit gate.
- [x] Add narrow exceptions only for the two unfixable build-tool advisories.
- [ ] Run the focused audit and security checks, then push and monitor the rerun.

## PR #67 merge-readiness correction, 2026-09-29

- [x] Fix database namespace guards and runner wiring.
- [x] Remove the activity daily cap and prove four awards.
- [x] Preserve the photo/journey accounting boundary and regressions.
- [x] Repair Docker context, CI placement, docs, and PR verification record.
- [x] Run focused and requested checks; inspect final diff and blockers.

## SPEC-011: Final specification on Postplan

- [x] Read the accepted 12-feature specification and check Postplan access.
- [x] Create a standalone HTML with all accepted rules and 82 acceptance cases.
- [x] Verify source coverage, publish to Postplan and read back the delivered page.

## SPEC-001: Reconcile the new technical draft

- [x] Compare the attachment with product decisions and current code.
- [x] Adopt compatible calculation, provenance and fallback requirements in the product plan.
- [x] Record conflicting POC choices and protect existing work.
- [x] Complete focused document checks and platform research.
- [x] Record the confirmed phone app, real journeys checked using location and rewards; the later unified submission model supersedes the original separate question/challenge count.
- [x] Record report upload/extraction, a small missing-GPS fallback (about 50 points tentative), highest-voted driver questions and no extra daily points cap.
- [x] Record acceptance of the capped 50-point GPS fallback with start/arrival evidence and paid voting for driver questions.
- [x] Confirm that driver questions and challenges use the same 500-point submission, contributions from 10 and up-to-three selection process.
- [x] Correct questions and proposed activities to one fan-submission feature, with optional tags and up to three selections total from one ranking.
- [x] Confirm the single-driver comparison, fastest-route time reference, later-evidence top-up and personal/community lifetime totals.
- [x] Confirm enough shared product understanding to split the specification; keep technical and design prerequisites explicit.
- [x] Move accepted rules and acceptance cases into linked feature documents without losing requirements or changing historical sections.
- [x] Update the plan, glossary and documentation links; verify coverage and record remaining implementation tasks.
- [x] Draft vertical implementation tickets with acceptance criteria and blocking edges; verify feature coverage and dependency order.
- [x] Follow the user's subsequent explicit instruction to create linked tracker issues for separate worktrees, superseding the planned pre-publication quiz.
- [x] Create tracker #3 and 19 implementation sub-issues with native blocking links; read back bodies, labels, parent links and dependencies.

Implementation is outside this documentation/interview step. Location thresholds, factor selection, rounding, route ties, provider contracts and detailed UI remain implementation prerequisites.

## Skill cleanup and local workflow commit, 25 September 2026

- [x] Read the requested file-pr skill and classify existing skills by project relevance and duplication.
- [x] Add file-pr, remove redundant or unrelated skills, and repair Claude links and references.
- [x] Verify the focused staged snapshot without unrelated design work or local plans.
- [x] Commit the authorized setup and report the remaining worktree changes; do not push.

## Portable agent workflow and security setup, 25 September 2026

- [x] Inspect repository state, implemented behavior, existing guidance, local tools and GitHub settings.
- [x] Confirm local checks plus GitHub Actions; preserve the user's browser-consent requirement.
- [x] Write canonical project instructions and shared portable SDLC skills, preserving existing design guidance.
- [x] Add documentation navigation, architecture/status, workflow glossary, security/privacy/performance procedures and contributor workflows.
- [x] Add bug and work ledgers, contribution templates, roadmap and requested Ideas discussion setup.
- [x] Implement local and CI dependency, secret, source and DAST checks with explicit applicability and failure behavior.
- [x] Test the tooling against safe positive and negative fixtures; run available repository checks.
- [x] Verify fresh-checkout portability, inspect the final diff, reconcile requirements and record remaining limits.

Scope: local repository setup and the explicitly requested private Ideas discussion configuration. No branch changes, commits, pushes, PRs, deployment, browser/device automation or live-provider requests. Licensing is excluded by the user's latest correction. Existing design artifacts and historical work records are preserved.

## Specification clarity and architecture review, 25 September 2026

- [x] Review the active spec, plan and glossary against confirmed interview answers; score clarity before recommendations.
- [x] Inspect the existing code for actual architectural friction and distinguish future design from refactoring.
- [x] Research Singapore emissions-method inputs and Convex transaction/authorization constraints using primary sources.
- [x] Write a local Markdown clarity review and a temporary visual HTML architecture report; open it and verify file content. Rendered layout/CDN diagrams remain unverified.
- [x] Present the independent scope decisions and architecture candidates.
- [x] Record the six clarity-review answers and add acceptance cases; repair the acceptance table.
- [x] Record deferred calculation policy, price reconfirmation, frozen selected challenges and points/rewards selection.
- [x] Write the selected points/rewards module discussion and recheck latest clarity decisions.
- [x] Record History, repeated purchases, shared demo/real rankings, unavailable offers and append-only corrections in the module discussion.
- [x] Record shared-contribution reset; later zero-start answer supersedes starter-point restoration.
- [x] Recheck reset using mixed sources, non-voting purchases and returning-user examples; correct glossary references to available points.
- [x] Replace mixed-source starter accounting with zero-start accounts; record retained rewards/History and one persistent signed-in demo profile.
- [x] Read the reset concurrency research and refresh the temporary selected-module report; content verified, rendered layout unverified.
- [x] Obtain consolidated confirmation of zero-balance reset, unfinished-operation policy and module responsibility; preserve deferred topics.

Review only: no implementation, staging, commits or `.evidence/` output. Parent owns the review and checklist; delegated research owns only its named note.

## Meeting 3 specification correction, 25 September 2026

- [x] Read every page of `meet 3.pdf` and compare it with the current specification and plan.
- [x] Record a source-backed feature inventory, mark the old spec/plan as under correction, and identify the first interview decisions.
- [x] Complete the points/rewards interview using grill-with-docs; defer calculation/ESG decisions as requested.
- [x] Record first-round answers in the specification, plan, feature inventory and glossary; separate earlier requirements as historical records.
- [x] Record interactive demo and real accounts, Singapore first, retained points rate/cap, question review and the user-deferred dashboard metrics.
- [x] Record demo-only simulated awards, full admin controls, countrywide eligibility and question/content reward rules.
- [x] Record no daily trip-count limit while preserving per-journey caps and duplicate-credit protection.
- [x] Resolve start-version rules, demo ownership, real-account rewards, tree scope and challenge selection/resubmission.
- [ ] Revisit user-deferred AI calculations/baseline later; resolve current points/rewards policies independently.
- [ ] Capture dashboard total-savings definitions when the user supplies them; continue unrelated documentation meanwhile.
- [x] Update the idea, feature inventory, specification, plan, and resolved glossary terms in Markdown.
- [x] Verify current document agreement and actionable remaining work; preserve source reconciliation and explicit deferred topics.
- [x] Obtain consolidated points/rewards and reset confirmation; calculation policy and ESG totals remain deferred.

Scope: local Markdown only. Preserve unrelated work; no implementation, tracker changes, commits, or publication.

## Apple HIG review of fan app design, 25 September 2026

- [x] Record current Apple guidance with direct source links and iOS-specific limits.
- [x] Audit the existing route mockups against the guidance with an honest scorecard.
- [x] Correct confirmed design issues while preserving the route task, user palette, and Geist.
- [x] Link durable project guidance from `AGENTS.md` and align `DESIGN.md` with it.
- [x] Verify the revised document, tokens, and rendered mockup; report checks that remain unavailable.

## Issue #1 — Expo setup (t3code/implement-issue-one)

Full issue #1 setup verification completed locally at the user's request.

- [x] Add a neutral Expo TypeScript starter and pnpm lockfile; preserve existing planning material.
- [x] Configure and pass type checking, linting, formatting, and test tooling (no feature tests yet).
- [x] Document prerequisites and link the original specification restored unchanged from the main worktree; no backend provisioned.
- [x] Verify frozen-lockfile installation and all documented checks in a fresh source copy without existing dependencies or private environment files.
- [x] Verify production bundle exports for iOS and Android (`pnpm exec expo export --platform all`).
- [x] Launch the starter on iOS and Android through T3 devices and save screenshots and content-check evidence.
- [x] Verify the Jest Expo preset loads TypeScript and React Native imports with a temporary test in the isolated copy; remove that test after the check.
- [x] Review ignore rules, documentation links, and preservation of planning material.
- [x] Update setup verification evidence and README with observed results.

Evidence: [.evidence/issue-1/verification.md](.evidence/issue-1/verification.md).
Native binary compilation and physical-device behavior are outside this setup issue and remain unverified.
Setup verification is complete; delivery is recorded in the branch and PR history. No deployment or live backend provisioning was performed.

## Separate the specification from issue #1

- [x] Read the current issue and preserve its full product requirements in a standalone specification document.
- [x] Draft a replacement issue focused only on repository setup, with implementation still awaiting a separate instruction.
- [x] Update issue #1 and verify its title, setup-only scope and labels.
- [x] Verify that the 69 product stories, 32 acceptance scenarios and open decisions remain in the standalone specification.

Verified [issue #1 — Set up the repository for the Expo/React Native app](https://github.com/NachikethReddyY/AMR-Fan-App/issues/1). It contains setup scope and future acceptance criteria only, preserves the instruction not to start building, and no longer has the `ready-for-agent` label. The [full product specification](docs/fan-app-specification.md) is a local document; it has not been committed or pushed by this task.

Project correction: keep the overall product specification separate from scoped implementation tasks. This does not change agent guidance or authorize repository setup.

## to-spec — publish the core fan-app specification

- [x] Confirm repository, glossary, tracker conventions, authentication, and existing application/test state.
- [x] Synthesize the complete specification with extensive user stories, confirmed decisions, open decisions, and observable acceptance criteria.
- [x] Check the proposed testing boundary with the user as required by the invoked skill.
- [x] Validate the specification against the current brief and protect unresolved decisions from becoming assumed requirements.
- [x] Publish the specification to this repository's GitHub Issues with the `ready-for-agent` label, then read it back to verify the body and label.

Historical result: the full specification was initially published and read back as issue #1, including 69 user stories, 32 acceptance scenarios, seven required sections, approved test seams, and open-decision callouts. The user subsequently requested that issue #1 cover repository setup instead. The product specification is now preserved separately in [the specification document](docs/fan-app-specification.md); the correction above supersedes the original issue purpose. No app implementation or build was started.

The explicit `to-spec` invocation authorizes this specification issue and its required label in the private project tracker. The user confirmed the testing approach and explicitly said not to build anything yet. Do not scaffold or implement the app, run a build, commit, push, or deploy during this task.

## Team discussion HTML — 25 September 2026

- [x] Record the non-refundable 500-point submission fee and accepted daily outbound/return reward limit.
- [x] Create a local HTML brief separating confirmed rules, proposals, open team decisions, and disclosed demo fulfilment.
- [x] Verify local readability, agreement with the plan, internal links, and self-contained markup; report rendered layout separately.

Artifact: [team discussion brief](docs/fan-app-team-brief.html). Verification: [.evidence/team-discussion-html/verification.md](.evidence/team-discussion-html/verification.md). Local content and source checks passed; rendered appearance and interaction remain unverified. Nothing published by this task.

This deliverable is a team discussion document. It does not close unresolved interview questions or authorize app implementation or publication.

## Finish grill-with-docs — resumed interview

- [x] Reconcile the recorded plan with the latest answers and separate UI design from interview completion.
- [ ] Resolve carbon intent, journey evidence/eligibility, challenge lifecycle, coverage, and account/data policy.
- [x] Verify distance-times-mode-factor methodology and unit boundaries against primary sources; production factor selection remains an implementation prerequisite.
- [x] Verify Aston Martin's ESG tree/restoration work and record optional earned-points contributions with clearly disclosed demo fulfilment.
- [x] Record 50 points/kg and a 2,000-point journey cap; check worked examples.
- [x] Record admin-set store/tree prices, no challenge refunds, challenge backlog, and tree assignment to the purchasing account.
- [ ] Resolve rejected challenge handling and confirm final product defaults.
- [x] Record acceptance scenarios for the agreed rules; these are not executed tests.
- [ ] Check the final plan for unresolved implementation-blocking product assumptions.
- [ ] Obtain confirmation of the consolidated core-app plan.

## Fan app core — current build thread

- [x] Record the confirmed travel, admin, store, and points-balance rules.
- [x] Confirm 500 points to submit; contributions start at 10 points and may use the fan's available balance.
- [x] Create three local static UI directions covering travel, challenges, and the store.
- [x] Verify local readability, confirmed challenge rules, navigation anchors, and self-contained structure.
- [ ] Visually verify layouts: preview host became unavailable and computer-use browser inventory was empty. Rendered appearance remains unverified.
- [ ] Obtain design selection before real UI edits.
- [ ] Resolve carbon/points rules and the remaining product decisions needed by each implementation slice.
- [ ] Scaffold the selected Expo/React Native app for iOS and Android.
- [ ] Build and test race planning, route comparison, and outbound/return journey state.
- [ ] Integrate and verify Google routing and native background tracking on both platforms.
- [ ] Build and test provisional points, completion credit, and duplicate-credit prevention.
- [ ] Build and test challenge submission, admin approval, and points-based ranking.
- [ ] Build and test the 10%–60% discount store with clearly labelled sample fulfilment.
- [ ] Build and test individual tree redemptions at admin-set point prices, named dedications, and unfulfilled-request reassignment, with disclosed demo fulfilment.
- [ ] Review the completed core and report local state and remaining unverified checks.

Publishing, deployment, shared tracker writes, commits, and pushes are outside this local-build scope. The user does not want to provide a deadline; do not make it a prerequisite.
## Native bottom tabs: UI-003

- [x] Confirm Expo structure and preserve existing starter dependencies.
- [x] Replace the custom dock with standard bottom tabs and wire four destinations.
- [x] Finish local checks and verify tab interaction on a device.

## Manager delivery completion — 2026-09-26 thread 977b624e

- [x] Read live open PR/issue metadata without querying paused Actions; confirm main95e5be8.
- [x] Preserve existing work and establish `.evidence/delivery-completion/status.md` with feature acceptance and iOS video protocol.
- [x] Resume existing AI, backend and native owners with disjoint scopes and four-thread ceiling.
- [ ] Verify backend R-SETUP-1 correction independently, finish hosted readiness and free-tier deployment gates.
- [ ] Complete TokenRouter/Jev protocol, secure credentials, measured moderation/extraction evaluation and owner integration.
- [ ] Complete native email/password authentication and publish authentic iOS video/screenshots with fixture/live limits.
- [ ] Integrate voting, impact/earning rules and demo generation/reset contracts serially with protected accounting tests.
- [ ] Complete map/location/journey/awards/native acceptance and report physical/provider prerequisites honestly.
- [ ] Refresh/review/deliver coherent PRs, retain Travel lineage, and dispose of superseded PR24/26 only after verification.
- [ ] Reconcile every issue against acceptance; close only completed scopes and report remaining blockers.
- [ ] Deliver final completion reminder with exact deployed/native state, evidence and remaining limits.

Keep this task heading unstaged. GitHub Actions remains paused by user. Hosted resources stay Free; TokenRouter shares one US$10 ceiling across development and demo. Native fan app only. No implicit deletion of evidence, user data or peer work.

### Render startup correction — 2026-09-26

- [x] Read exact main API entry and failed Render log; change only start command and health check on existing Free service.
- [x] Verify saved command and /health; new build passes and invokes server/api/start.ts.
- [ ] Hosted startup blocked by missing DATABASE_URL; finish separately reviewed Supabase auth/storage deployment configuration.

Evidence: `.evidence/delivery-completion/render-start-correction.json`. Two automatic deployments resulted from the two setting saves; final failed for missing database configuration. No credential, billing, database, source or Actions changes. Shared bug/work proposals remain private under manager preservation boundary.

## APK completion coordination — 2026-09-26

- [x] Verify five open PRs and no competing active task owners.
- [x] Resume one owner each for PR28 native/APK, PR41 backend, and existing AI adapter.
- [x] Generate requested Aston Martin F1 FAN icon candidate.
- [ ] Verify generated icon crop/readability and pass asset to mobile owner.
- [x] Resolve photo award location/fallback and daily-limit rules: eligible bus photo50 now, verified same-journey difference later; eligible no-location50; no daily cap; preserve no-double-credit and immediate media deletion.
- [ ] Verify live maps credentials/billing prerequisites without exposing credentials.
- [ ] Complete hosted/native feature matrix and independent review of deliverable slices.
- [ ] Build/test standalone APK against hosted backend; record native video/screenshots.
- [ ] Resolve PRs serially, close superseded Travel PRs only after retained-code proof, close only accepted issues.

CI stays paused; cloud stays Free; AI shared budget ceiling US$10. No completion claim from screenshots or fixture-only checks.

### Delivery continuation, 26 September 2026

- [x] Verify PR41 terminal merge receipt at main4efa304; hosted service live, CI still paused.
- [x] Confirm TokenRouter key now present and hand off through a private0600 file without outputting its value.
- [x] Install signed03cf351 ARM64 APK and observe Home/four tabs/Account with no Metro or local API listeners.
- [x] Record user selection: Singapore first using OneMap; Google remains disabled.
- [ ] Complete OneMap provider integration in its isolated one-PR thread.
- [ ] Correct Account sign-in button curve to match Create account, rebuild and inspect.
- [ ] Await manual hosted sign-in; no credential screenshots or automation during entry.
- [ ] Resolve AI gateway protocol/rates/image passthrough and budget enforcement before live inference.
- [ ] Recheck route timing gate after native compiler is idle; retain both previous failures.

### Account email confirmation correction, 26 September 2026

- [x] Preserve user reproduction: confirmation browser lands on localhost:3000; current native adapter has no code verification.
- [x] Route native code-entry correction to existing PR28 owner and hosted confirmation-template correction to infra owner.
- [ ] Verify invalid/expired/valid code and session-generation controls; preserve password sign-in.
- [ ] Read back hosted template and rebuild/install APK; observe user-controlled confirmation/sign-in without credential capture.

User selected email code confirmation. Account creation is not proof of sign-in. No CI or paid resources. Protected central bug/work records remain unchanged; private evidence carries triage.

### Final APK order and onboarding, 26 September 2026

- [x] Relay explicit user correction: build APK at the end only; stop intermediate builds.
- [ ] Finish verification-code source and focused checks; notify user when changed, distinguishing uninstalled native proof.
- [ ] Inspect and complete accepted onboarding: first launch, separate signup/signin, email code confirmation, entry into app, and subsequent launches. Resolve missing product choices before inventing screens.
- [ ] Build final APK only after the accepted implementation work is complete, then verify installed native behavior.

Project delivery correction: interim APK packaging is not completion. Onboarding remains required. Earlier rebuild-now instructions are superseded.

### PR disposition, 26 September 2026

- [x] Verify four exact open PRs and current main without Actions queries.
- [x] Independently verify Travel source retention; close superseded PR26 and PR24, preserving branches and open issues.
- [x] Verify GitHub now has two open PRs and T3 links reflect closures.
- [ ] Complete PR39 refresh, independent review and normal merge if eligible.
- [ ] Finish PR28 auth/onboarding, refresh and review before merge; APK only at end.

## Delivery continuation 2026-09-26 manager
- [x] Confirm one open PR28 and current local candidates; preserve CI pause.
- [ ] Verify email delivery/code sign-in on native app.
- [ ] Select and implement onboarding/dock; integrate latest mobile guest rewards.
- [ ] Recover hosted participation auth in focused follow-up PR and independently review.
- [ ] Resolve live route provider and AI activity runtime/award blockers.
- [ ] Deploy integrated backend, verify guest offers/admin, integrate PR28.
- [ ] Record native end-to-end screenshots/video and build final APK.

## Dinner continuation: 2026-09-26

- [x] Repeat existing account sign-in on Pixel twice; both succeeded. User confirmed intentional sign-out.
- [x] Show signup OTP screen for selected plus-address; actual email delivery remains blocked by rate-limit response.
- [x] Independent PR42 source review and local browser/200%/DAST proof completed.
- [ ] Verify PR42 merged tree and retain open parent issues until full acceptance.
- [ ] Finish onboarding state/retention tests, native walkthrough/dock proof and PR28 integration.
- [ ] Diagnose exact SMTP failure and verify delivery when unblocked.
- [ ] Integrate remaining routing/activity/AI slices only after their gates; final APK last.

## F1 onboarding animation

- [x] Add the cinematic welcome, car rise, expanding green trail and team message.
- [x] Route through onboarding and driver selection before the login gate.
- [x] Keep the main app unavailable without a backend session.
- [x] Leave the real sign-in/sign-up handoff for the separate auth thread.
- [x] Run the focused Swift simulator build and source checks.

- [x] Record the welcome/to/car on iPhone 18 Pro before launch; preserve local video proof.
- [x] Limit replay to Debug and preserve saved driver state.

### Firsthand intro replay and app name, 30 September

- [x] Add a debug preview start/replay control so the user starts the animation.
- [x] Build and install AMR Fan App using the existing preview bundle ID.
- [x] Verify the launch screen and leave it waiting for the user.
- [x] Confirm the device app list contains one AMR Fan App preview bundle.

### Intro choreography correction, 30 September

- [x] Record acceptance: car enters below screen, rear-wheel rectangle follows one continuous run, car exits above, team at 75%, clear black, then new message.
- [x] Replace independent car/trail timers with shared animated geometry and cancellation-safe phases.
- [x] Build, record and inspect the corrected run; leave Play intro ready.

### Car orientation correction, 30 September

- [x] Remove the explicit 180-degree transform identified in the user screenshot.
- [x] Rebuild and install the same AMR Fan App preview bundle.
- [x] Leave the iPhone 18 Pro preview at Play intro for direct inspection.

### Speed and fan-message correction, 30 September

- [x] Speed up the car and linked green motion.
- [x] Add wheel speed lines.
- [x] Replace drive copy with fan-experience copy and add a green wipe reveal.
- [x] Build, record and leave Play intro ready.

### Remove car wind lines, 30 September

- [x] Remove speed lines near the car.
- [x] Rebuild and reopen Play intro on iPhone 18 Pro.

### Account-gated automatic intro, 30 September

- [x] Remove Play and Replay preview controls.
- [x] Restart intro/onboarding on fresh launches before account setup.
- [x] Persist only the connected-account bypass and leave auth integration note.
- [x] Verify build, repository checks, security checks, and iPhone 18 Pro relaunch.
- [ ] Commit, file PR, monitor CI/review, and merge to main as authorized.

## Kotlin port replacement, 2026-10-02

### Map placeholder and Android walkthrough, 2026-10-03

- [x] Confirm the installed Android and Maps SDKs without displaying credentials.
- [x] Replace the missing-key message with a stable map placeholder and preserve Maps handoff.
- [x] Build debug/release APKs and run the Kotlin unit suite.
- [x] Exercise onboarding, all four tabs, detail navigation, RSS/article opening, quiz points, camera capture/cancel and gallery entry.
- [x] Record working flows, incomplete actions and external-service limits with screenshots under `.evidence/kotlin-walkthrough/`.

### Photo screen and news label correction, 2026-10-03

- [x] Remove the raw RSS timestamp from news cards.
- [x] Add a visible top back control to the sustainability photo screen.
- [x] Show the RSS publication date without the raw time or timezone.
- [x] Extend the Material bottom bar through the gesture area and verify all four tabs.
- [x] Add a visible top-left Back control to News and verify it returns to Home.

### Android functionality follow-up, 2026-10-02

- [x] Bundle Nunito Black for a heavier, rounded number and move it up; preserve accepted card geometry.
- [x] Replace the custom dock with standard Material navigation and shorten page/intro transitions.
- [x] Prove RSS parsing/loading with fixtures, then connect news, refresh, images and article links.
- [x] Open the native camera immediately; retain gallery, cancellation, preview and private file cleanup.
- [x] Wire the native map to configured credentials and provide a usable Maps handoff without a key.
- [x] Review the supplied Swift Android guides without changing the selected Kotlin architecture.
- [x] Build, run focused tests, verify each affected emulator flow and record limits/evidence.

- [x] Remove the confirmed Flutter worktree, folder and branch.
- [x] Create `feat/kotlin-port-swift-components` from `main`.
- [x] Add the standalone Kotlin/Jetpack Compose Android project and Swift assets.
- [x] Verify unit tests, debug APK build, and authorized Pixel 10 emulator flow.
- [ ] Configure Android Entra redirect and Maps key before live auth/map acceptance.
- [x] Rebuild the Kotlin screen shell and visible destinations from Swift after the UI parity correction.
- [x] Verify the rebuilt Home, dock, Rewards, Impact, Travel, news fallback, photo picker, Challenges and Quiz on Pixel 10.
- [x] Apply shared Android system-bar insets so Home, Rewards, Impact, Travel and detail pages start below the status bar.
- [x] Use Compose `NavHost` routes for tabs and detail destinations, with Swift left unchanged.
- [x] Verify Home greeting, overlapping metric cards, merchandise and Travel on Pixel 10 after the layout correction.
