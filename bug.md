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
| BLACKBOX-001 | Black Box CI pilot, 2026-09-29                      | Add a manual owner-only WSL runner job that tests one existing suite at an exact commit, with no paid fallback                                  | Nachiketh; unlinked                                                                        | Workflow and local proof prepared; default-branch delivery and live run pending authorization                          |

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
