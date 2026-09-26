# Steering and bug inbox

Record every actionable request, correction or reproducible finding here.
Read open entries at task start. Keep stable IDs and link the owning issue when
available. An entry does not authorize unrelated work. Sensitive findings follow
[SECURITY.md](SECURITY.md), with only a sanitized reference here.

| ID          | Kind and source                                     | Acceptance criterion                                                                                                                           | Owner / tracker                                                                            | Status                                                                                                                  |
| ----------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| AGENT-001   | Repository setup, 2026-09-25                        | Canonical instructions, portable skills, SDLC docs and local/CI security checks with accurate coverage                                         | gpt-6-astra through Codex (T3 Code); unlinked                                              | Verified locally; hosted CI pending delivery                                                                            |
| AGENT-002   | Verification constraint, 2026-09-25                 | Browser/computer/device use requires consent; security proportional to exposure                                                                | AGENT-001                                                                                  | Verified in guidance; no UI automation used                                                                             |
| AGENT-003   | Licensing correction, 2026-09-25                    | No licensing addition; remove any task-added MIT license                                                                                       | AGENT-001                                                                                  | Honored; no license was added                                                                                           |
| AGENT-004   | Skill-folder correction, 2026-09-25                 | Keep skills discoverable in `.agents`; remove its Git ignore rule; ignore optional `.agents.local/`                                            | AGENT-001                                                                                  | Verified; final skill set follows AGENT-006                                                                             |
| AGENT-005   | Local delivery, 2026-09-25                          | Commit the verified setup without unrelated design work, temporary plans or a push                                                             | gpt-6-astra through Codex (T3 Code); unlinked                                              | Verified for local commit; no push authorized                                                                           |
| AGENT-006   | Skill cleanup, 2026-09-25                           | Add `file-pr`; remove unrelated and redundant skills, repair references and Claude links                                                       | AGENT-005                                                                                  | Verified: 15 skills and matching Claude links                                                                           |
| AGENT-007   | GitHub delivery, 2026-09-25                         | Commit and push the verified setup to `origin/main`; preserve separate design work and local plans                                             | gpt-6-astra through Codex (T3 Code); unlinked                                              | Push authorized; supersedes AGENT-005's local-only scope                                                                |
| SEC-001     | Dependency audit, 2026-09-25                        | Reassess UUID advisory when Expo/xcode or affected callers change                                                                              | Unassigned; local tracking                                                                 | Triaged; moderate build-tool dependency                                                                                 |
| BACKEND-001 | Backend direction, 2026-09-25                       | Record Azure as the backend platform and retire the active Convex plan                                                                         | Nachiketh; unlinked                                                                        | Local documentation updated; Azure services undecided                                                                   |
| DEVICE-001  | Device state, 2026-09-25                            | Open the current app on a device and show its observed state                                                                                   | Nachiketh; unlinked                                                                        | Expo starter observed on iPhone 17 Pro                                                                                  |
| UI-001      | Library setup, 2026-09-25                           | Add gluestack UI with NativeWind v5 and Reanimated; document usage without selecting final UI                                                  | Nachiketh; unlinked                                                                        | Local setup and iPhone starter screen verified                                                                          |
| UI-002      | Home and tabs design, 2026-09-25                    | Show fan/race updates, points/rewards and team impact on Home; revise the dock style                                                           | Nachiketh; unlinked                                                                        | Three revised local options ready for selection                                                                         |
| UI-003      | Navigation correction, 2026-09-25                   | Use standard bottom tabs with four working destinations                                                                                        | Nachiketh; unlinked                                                                        | Verified locally on iPhone 17 Pro Max simulator                                                                         |
| UI-004      | Tab styling, 2026-09-25                             | Use AM green on the bar and a gray circle for the selected tab                                                                                 | Nachiketh; unlinked                                                                        | Verified locally on iPhone 17 Pro Max simulator                                                                         |
| SPEC-001    | New technical draft, 2026-09-25                     | Compare the attached draft with the current plan; adopt compatible rules and resolve conflicting POC choices                                   | Nachiketh; unlinked                                                                        | Core scope confirmed; 12 feature documents and tracker #3 with 19 linked implementation issues                          |
| SPEC-002    | POC scope clarification, 2026-09-25                 | Update the spec for a phone app, real journeys checked using location and all five reward types, then continue grill-with-docs                 | Nachiketh; SPEC-001; unlinked                                                              | Recorded locally; app behavior remains unimplemented                                                                    |
| SPEC-003    | Interview answers 2–5, 2026-09-25                   | Report upload/extraction, small missing-GPS fallback, highest-voted driver questions and no added daily points cap                             | Nachiketh; SPEC-001; unlinked                                                              | Resolved by SPEC-004 through SPEC-007; retained as interview history                                                    |
| SPEC-004    | Interview answers 6–8, 2026-09-25                   | Record capped 50-point GPS fallback with recorded start/arrival and paid question voting; clarify the earlier 500-point process reference      | Nachiketh; SPEC-001; unlinked                                                              | Resolved by SPEC-005 and SPEC-006; one submission feature                                                               |
| SPEC-005    | Shared voting process, 2026-09-25                   | Apply the same submission and voting rules to driver questions and fan challenges                                                              | Nachiketh; SPEC-001; unlinked                                                              | Recorded; pricing resolved; SPEC-006 resolves the feature and selection grouping                                        |
| SPEC-006    | Unified submissions correction, 2026-09-25          | Treat questions and activities as one feature with optional tags, one ranking and up to three selections total; continue the interview         | Nachiketh; SPEC-001; unlinked                                                              | Corrected; SPEC-007 records the final baseline, time, top-up and totals answers                                         |
| SPEC-007    | Final product answers and feature split, 2026-09-25 | Record the approved car baseline, fastest-route time limit, GPS top-up and lifetime totals; split the spec into features with acceptance cases | Nachiketh; SPEC-001; unlinked                                                              | Verified: 12 local feature documents; implementation tracked in #3                                                      |
| SPEC-008    | to-tickets invocation, 2026-09-25                   | Draft complete feature slices with genuine blocking dependencies; review the breakdown with the user before publishing GitHub issues           | Nachiketh; SPEC-001; unlinked                                                              | Completed under SPEC-009 authority: #4–#22 created with native dependencies under #3                                    |
| SPEC-009    | GitHub tracker authorization, 2026-09-25            | Create linked issues that can be assigned to separate worktrees                                                                                | Nachiketh; [tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3)           | Verified overview, 19 sub-issues and 24 native blocking links; no worktrees created                                     |
| SPEC-010    | Documentation push, 2026-09-25                      | Commit and push the verified feature/specification work; preserve unrelated local edits                                                        | Nachiketh; [tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3)           | Verified staged documentation; commit/push authorized; unrelated changes excluded                                       |
| SPEC-011    | Final spec HTML, 2026-09-25                         | Create a readable HTML of the accepted specification and publish it to Postplan                                                                | Nachiketh; SPEC-001; [tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3) | Published to Postplan; 12 features and 82 acceptance cases verified against the public HTML; visual behavior unverified |
| SPEC-012    | Final spec push, 2026-09-25                         | Commit and push the final-spec HTML and related documentation to main; preserve unrelated work                                                 | Nachiketh; [tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3)           | Preparing verified documentation for the authorized push                                                                |

## INFRA-001: local persistence and foundation checks

Tracker [#3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3), supporting #4/#6.
Owner: infrastructure task. Add real local PostgreSQL with isolated worktree
databases, migrations, synthetic fixtures and transactional proof. Preserve the
phone app and defer account/points/API behavior. Baseline Checks fails only on
this file formatting; Security finds raw inline theme HTML in the web provider.
Verified locally: real PostgreSQL persistence/isolation/transactions, repeatable
migration/seed and safe reset; theme browser/regression proof; repository and
security checks; native exports. Hosted CI and independent review are pending.
No security rule is disabled.

Independent review R1 found casing-alias CLI invocations silently returning no
status on candidate fd5b453. Both entry-guard paths now use native canonical
paths. A real PostgreSQL subprocess regression proves nonempty status JSON and
the expected database/role through both aliases; local checks and security pass.
Replacement hosted CI and exact-head review remain required.

Edited by gpt-6-astra through Codex (T3 Code).

## SEC-001: UUID in Xcode tooling

`pnpm audit` reports [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
for `uuid@7.0.3` through Expo's `xcode` dependency. Affected methods are
`v3`, `v5` and `v6` with caller-supplied buffers. The installed Xcode caller
uses `uuid.v4()` without a buffer. No app call to affected APIs exists in the
starter. The advisory remains visible, with no global suppression.
Recheck when dependencies or callers change. High/critical advisories fail the
automated gate; lower severities need exposure-based triage, not blind upgrades.

Edited by gpt-6-astra through Codex (T3 Code).

## ACCOUNT-004: persistent sign-in and authorized account API

Tracker [#4](https://github.com/NachikethReddyY/AMR-Fan-App/issues/4), under #3.
Implement server-derived identity, one real and one demo profile per signed-in
user, zero initial balances, resume/logout and assigned-admin authorization.
Preserve four tabs and route ownership. Use isolated PostgreSQL and a production
OIDC verification boundary, with explicitly separated synthetic local sign-in.
Live provider provisioning remains pending. No points business or admin web scope.
Status: acceptance tests and coordinated implementation in progress.

Edited by gpt-6-astra through Codex (T3 Code).

Provider contract accepted for ACCOUNT-004: configurable OIDC access-token
verification and native code/PKCE, with deployment values explicitly unselected.
Synthetic local identities must pass the same account authorization and may never
be enabled in production. The manager schedules independent Astra review; no
new helper threads or reviewer worktree reuse. Root changes are serialized after
the AI owner's released lease and preserve its patch on subsequent rebases.

ACCOUNT-004 local proof found `db:run` inherited a ten-minute subprocess timeout.
The API stopped during Android logout. Preserve bounded test/tool commands but
allow the explicitly started development server to run until its owner stops it.
Pending logout hid data and recovered after the owned API restarted.

## UI-ACCOUNT-004: large-text bottom tab labels truncate

Observed on leased Pixel_10_API_36 at
`accessibility-extra-extra-extra-large`: the four-tab bar displayed truncated
Rewards/Impact labels (`Rewa…`/`Impa…`). Screenshot remains private at
`.evidence/account-4/android-large-text.png`. Original `large` text setting
restored. User authorized a minimal App fix on the held mobile branch after
server freeze, preserving order and normal-size geometry. This is a failed
accessibility criterion, not an accepted limitation. Required iPhone/VoiceOver
proof remains separately pending. Tracker #4.

Edited by gpt-6-astra through Codex (T3 Code).

## ACCOUNT-004-R1: owned descendant survives launcher shutdown

Independent PR27 review reproduced a SIGTERM-ignoring grandchild remaining alive
after its wrapper exited. The launcher cleared its escalation timer when only
the wrapper closed. A regression reproduced the leak before the fix. Shutdown
now retains the five-second escalation and waits for the owned process group to
terminate, even after wrapper exit. The regression checks that the descendant
is gone, an unrelated process remains alive, and normal exit outcomes persist.
The actual API owner-shutdown check also passes. No shared process is signalled.
Tracker #4; reviewer evidence and repeated author proof remain private.

Edited by gpt-6-astra through Codex (T3 Code).

## PR39-REFRESH: resolve conflicts with current main

Tracker: [PR #39](https://github.com/NachikethReddyY/AMR-Fan-App/pull/39), related to #12 and #13.
Requested: integrate main using the existing rebase convention, preserve both
sides, verify the build before pushing, and preserve pre-existing local edits.
The prepared nine-commit rebase already includes main at `4efa304`. Eight patches
are unchanged; API registration moved around the new authentication routes.
Voting source and migration 0009 remain identical to the published candidate.
Frozen install, full serial checks and production exports passed. The initial
concurrent check hit the unchanged AI transport test's 40 ms deadline; it passed
with the export finished. Security checks passed, including zero source SAST
findings and no high/critical dependency advisories. Guarded push is next.

Verified by gpt-6-astra through Codex (T3 Code).

## DEPLOY-009: retained Supabase installation cannot apply participation migration

Unlinked local deployment-readiness follow-up, 26 September 2026. Merged main09b61e9 includes migration0009, but the hosted bootstrap is fixed at eight migrations and returns unchanged on the existing installation. Acceptance: checksum/ownership/privilege-guarded atomic eight-to-nine upgrade, scoped runtime grants, retained data/role/password/ACL proof and replay/collision/rollback tests. No production migration/deploy until the manager supplies the exact reviewed integrated candidate.

Recorded by gpt-6-astra through Codex (T3 Code).
UI-ACCOUNT-004 correction on the held mobile branch: large-text tab labels now
wrap inside their existing columns and the bar uses measured label height.
Explicit tab names preserve accessible labels when a custom visual label is
used; React Navigation retains selected state. Pixel proof at font scale 3.2
shows every full label and reachable destinations, with selected state in the
accessibility tree. Scale 1.0 restores the original geometry. Both settings and
private screenshots are recorded under `.evidence/account-4/tabfix-*`. Required
small-iPhone/VoiceOver acceptance is still pending, not replaced by Android.

Edited by gpt-6-astra through Codex (T3 Code).

## PHONE-004-005: activate held account UI and current balance/History

User authorized replaying only the three held mobile commits onto repaired main
`8e346af`, then connecting Home/account/Rewards to the existing owner-checked
History endpoint. Root/native integration is verified and frozen at `6eb5585`;
the root writer moved to submissions. The continuation adds no backend, route,
CI or dependency changes after that freeze. Real/demo state clears on changes,
logout and expiry; server order, cursor strings and immutable records are retained.

State and HTTP/PostgreSQL proof pass, including two-page History, maximum balance,
cross-account denial, restart, offline recovery and revocation. New native UI
proof remains held: Pixel/iPad reservations are inactive because supported
cross-thread app-session ownership cannot be confirmed. No further owner hunt,
device open or Metro startup is permitted. Prior Android proof covers only the
unchanged account/tab lineage. Small-iPhone largest Dynamic Type, actual VoiceOver
and live OIDC remain mandatory pending gates. This does not close #4 or #5.

Edited by gpt-6-astra through Codex (T3 Code).

## UI-DOCK-028: reconcile bottom navigation with selected design

Related to #4 and PR28. The user selected a dark rounded floating dock for the
four existing Home, Travel, Rewards and Impact destinations. Replace the green
full-width bar, preserve account/navigation state and allow large labels to wrap.
Native proof is pending.

Edited by gpt-6-astra through Codex (T3 Code).

### Email resend cooldown, 2026-09-26

The native confirmation screen allowed a resend six seconds after signup.
Supabase rejected it with 429 and 51 seconds remaining. Add a visible local
60-second countdown and prevent duplicate dispatch; provider limits remain
authoritative. Original email delivery is a separate unresolved check.

## PR28 password-only signup, 2026-09-26

Related to #4 and PR28. The user explicitly removed MFA and email confirmation
codes. New signup must exchange an immediate provider session, ask for a name,
and enter the app; password sign-in remains separate. No existing account,
password, points or session is reset. An unexpected confirmation-required
provider response fails closed. Hosted auto-confirmation is owned by the
infrastructure thread; this mobile change does not mutate cloud configuration.

Transport recording/progress and camera capture are absent from the current
phone build. Guest catalogue source exists but requires backend deployment of
405739286063f77fdd50def2e02ddfb9da914239. No future camera control is added.
Password-only synthetic signup/name and normal/largest navigation now pass on
Pixel and iPhone 17 Pro. Final user build still waits for reviewed photo integration.

Edited by gpt-6-astra through Codex (T3 Code).

## PR28-REFRESH: resolve conflicts with current main

Tracker: [PR #28](https://github.com/NachikethReddyY/AMR-Fan-App/pull/28).
Integrate current `main` into the published mobile branch without rewriting its
history. Preserve the phone's public native auth examples and current main's
server-only Supabase configuration. Keep both branches' steering and work records.
The separate account worktree has unpublished commits and local edits; leave it
untouched. Native interaction remains subject to its existing acceptance hold.

Edited by gpt-6-sol through Codex (T3 Code).

## PR28 photo client integration, 2026-09-26

- User steering: integrate reviewed client candidate `ca71166bce7d576f943af36e67a5cc2551c848ae` into [PR28](https://github.com/NachikethReddyY/AMR-Fan-App/pull/28). Keep server hooks/migrations and live AI outside this slice.
- Acceptance: reachable Home camera entry, camera-only permissions, same-account refresh preserves capture/draft, explicit logout/switch/known expiry and Home blur clear it, loading cannot authorize checks. Sequential Pixel/iPhone proof uses synthetic scenery only.
- Status: local integration and focused tests pass; complete checks and native proof pending. No live photo upload or points claim exists.

Recorded by gpt-6-astra through Codex (T3 Code).

PR28 delivery correction, 2026-09-26: the user requires branches to integrate only through file-pr and squash merge to main. Finish the already-imported photo client only; do not copy more branch work. Rebase current main before final review, preserve TODO, report exact reviewed head to the coordinator, then wait for its serialized merge turn. Squash merge is now authorized when applicable gates and branch protection pass, without admin bypass. CI remains paused by the user, so Actions/checks queries, reruns and re-enabling remain prohibited. Live AI and unrelated final APK acceptance do not block this safe disabled-client slice. Classification: project delivery correction; shared guidance unchanged.

Recorded by gpt-6-astra through Codex (T3 Code).

PR28 photo integration status: focused/full/security checks and bounded native
proof complete. Pixel capture/draft/current-identity transitions passed with
synthetic scenery. iPhone permission/launch/cancel/return/expiry and large text
passed; its simulator shutter produced no photo, so iOS capture/draft proof remains
unverified. See `docs/operations/native-acceptance.md`. Live photo backend/AI and
final user APK remain separate; no media transmission or points were enabled.
Current main refresh completed; final-head review and serialized squash turn pending.

Verified by gpt-6-astra through Codex (T3 Code).

# PHOTO-20260926: camera and activity delivery

SPEC review correction: initial integration keyed mounting on signedIn/token,
which disposed capture during foreground session refresh; the initial check
callback also retained stale authority. The owned session adapter now retains
the flow through refresh, blocks requests while loading, reads fresh authority,
and cancels/clears on identity loss. Handoff requires immediate owner invalidation
before logout/switch/known expiry because loading alone has no transition reason.
Native system-camera return proof remains held for the mobile owner.

Fixed by gpt-6-astra through Codex (T3 Code).

Tracker: unlinked. User assigned this isolated photo owner; no tracker mutation requested.
Photo plus description only; optional bus endpoints, no video/audio. Supported
assessment with confidence strictly above 0.5 earns 50, without a daily cap.
Reject duplicate photos/actions/trips; a preliminary bus award reduces only the
remaining award for the same verified journey. Code owns points. Discard raw
photos and descriptions; retain minimal decision/dedup metadata only.
Live AI and production credit remain unavailable pending gateway and shared budget
contracts. No inference or spend authorized. The user selected photo-first UI; PR28 owns the client and native proof.
Account/App/dock paths remain outside this server-only PR.

Recorded by gpt-6-astra through Codex (T3 Code).

### Server-only PR delivery, 2026-09-26

Tracker: unlinked. The user superseded the PR28 publication hold and authorized
one server-only PR against main. Exclude mobile files/dependencies and the AI
assessment already merged in PR45. Register an always-disabled activity API;
no HTTP body decoding, inference or live credit. Infrastructure retains the
0010 hosted upgrader. Deployment must wait for that reviewed migration and grants;
merge is a separate manager-owned turn. No CI queries or device/provider actions.

Recorded by gpt-6-astra through Codex (T3 Code).

## AI-BUDGET-001: durable shared USD admission

Related to parent #3 and merged PR45. Implement the existing `AiCostStore`
contract with one PostgreSQL budget shared across development and hosted callers.
The ceiling remains $10; no provider, rate, credential or hosted database is
enabled. Migration `0011_ai_cost_store.sql` is reserved by the coordinator;
photo work owns `0010`. Acceptance covers concurrent admission, restart/replay,
immutable fingerprints/rates, per-stage claims, partial completion, unknown-spend
holds and persistent suspension after bound violations. Isolated PostgreSQL and
heavy gates used the coordinator's explicit slot grant, now released. Eleven
full-chain PostgreSQL cases and security pass. Full repository checks retain an
route responsiveness deadline failure; its isolated rerun passes in 4.6 seconds.
Full check is RED and the cause is unproven. The coordinator authorized one real
inactive PR for review with that limit explicit; no merge turn is granted.
CI remains paused.

Recorded by gpt-6-astra through Codex (T3 Code).

## ONEMAP-001: finish the Singapore routing adapter

Related [#6](https://github.com/NachikethReddyY/AMR-Fan-App/issues/6) and #7;
OneMap-specific steering is unlinked. User selected OneMap, then requested the
unfinished routing work through current-main integration and one real PR.
This conversation owns implementation directly; no delegated implementation
writer remains. Camera and mobile evidence stay with their separate owners.

The inherited adapter accepted walking road instructions as cycling based only
on the request mode. A failing regression reproduced this; returned instruction
modes now must agree with the requested mode. Continuous transit remains
supported. Disconnected transit retains metrics but cannot become a prepared
journey or obtain a recommendation under the current contract.

Live blocker: the manager/infra owner must assign a confirmed OneMap account's
email/password through the existing private-file configuration, then authorize
live validation and deployment. No account or credentials were invented or used.
Google billing, phone changes and cloud/database mutation remain outside scope.

Edited by gpt-6-astra through Codex (T3 Code).

## ROUTE-RESP-001: repeated geometry consumes provider deadline

Related to #6; diagnostic steering is unlinked. The full local gate reported
six of twelve routes, then all modes timing out, under the unchanged five-second
per-mode deadline. The isolated fixture passed locally, so that failure was not
reproduced in this diagnostic. Instrumenting exact main `726efbb` identified
49,164 polygon-containment calls for twelve identical alternating paths.
Each mode spent 1.18–1.59 seconds in normalization in that single baseline run.

Each bounded geometry check now reuses successful exact-coordinate and directed
segment checks. It preserves the original geometry, all traversals, cancellation,
provider deadlines and the 50 ms heartbeat requirement. The same instrumented
main fixture required 48 containment calls after the change. The CPU cancellation
regression now uses distinct coordinates because repeated geometry can finish
before its 25 ms deadline. Native journey work and its unselected UI remain separate.

Edited by gpt-6-astra through Codex (T3 Code).
