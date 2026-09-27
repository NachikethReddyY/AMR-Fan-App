# Steering and bug inbox

## GOOGLE-001: enforce the authorized USD 1 total routing allowance

Tracking: unlinked follow-up to route planning. User authorized Google billing
setup with a USD 1 total AMR routing cutoff and no automatic reset. This replaces
strict-zero routing only, not AI or any other service. Root accepted a separate
PostgreSQL row reserving all selected modes before dispatch, capped at 200
attempts. Errors, timeouts, crashes and uncertain commits never refund attempts.
No account-wide or leaked-key billing guarantee is claimed.

Implementation owns routes, minimal registration, tests, docs and reserved
`0012_google_route_budget.sql`. Root owns cloud/key/deployment and review.
Production deployment is held: ledger 0010 precedes undeployed AI 0011, whose
initialization prerequisite is not cleared. Do not assert zero historical AI
liability, change its checksum or bypass the deployment runner. A separately
reviewed schema-only suspended/no-spending-grants path belongs to that owner.

Local implementation and focused proof are complete: failing-first admission,
real PostgreSQL concurrency/process termination/restart and registered API tests
pass, as do `pnpm check` and `pnpm security:check`. Root's independent review and
the separate production migration/deployment work remain pending.

Recorded by gpt-6-astra through Codex (T3 Code).

## AI-SUPPORT-046: one authorized technical support email

User authorized one email to the official TokenRouter support address about the
aggregate charge ceiling, exact Jev model routing and separate Luna image/billing
bounds. Sent once from the observed authenticated account after compose review.
Confirmed Gmail's sent notice and the sent message headers/body. No attachments,
credentials, account IDs or private source were included in the sent message.
No provider inference is authorized. Sanitized receipt and private thread link
are stored only under `.evidence/tokenrouter-live-integration/`.

Recorded by gpt-6-astra through Codex (T3 Code).

## AI-GATEWAY-046: establish the live provider contract

Related to parent [#3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3);
new tracker item unlinked. After merged PR45, the provider owner must establish
the actual Jev route/envelopes, Luna image support, current billing bounds and
the shared USD 10 controls before transport implementation or activation.
Preserve the separate durable-store, photo HTTP and route owners' paths.

Read-only official docs and the existing Helium console established the gateway
Jev request path, both models' displayed rates including Luna tiers/cache, and
the finite AMR key quota/model restrictions. Full response/echo, image bounds and
failure/failover charges remain missing. See [contract evidence](docs/ai/gateway-contract.md).
No live requests, account changes or replacement credentials were used.

The durable owner retains `cost-reservation.ts`, its PostgreSQL implementation,
isolated tests, migration 0011 and the durable-seam documentation. Runtime config
will use only explicit `AI_COST_DATABASE_URL`. No interface change is needed yet.

Follow-up: root requested full model-example/output-limit inspection, concrete
documented preparation, and the smallest remaining fields. Completed a pure
Jev request mapper with failing-first tests; response/transport activation stays
blocked on the documented facts. Same-model direct OpenAI image support is
recorded only as an approval-dependent alternative. The later authorized support
email is recorded in AI-SUPPORT-046 above; no reply is claimed.

Root review correction: the earlier failed criterion treated response-envelope
facts as prerequisites for a diagnostic probe. Only the aggregate maximum charge
and no-substitution assurance remain provider blockers before that probe; unknown
usage retains the full reservation and the result remains unavailable to product
callers. Classification: project guidance; shared instructions are unchanged.
The support draft was prepared before the later authorization. Deliver this offline slice
through one PR after the scheduled full/security lease. Preserve TODO exactly
while rebasing main; no cross-branch import or live activation is authorized.

Recorded by gpt-6-astra through Codex (T3 Code).

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
full-chain PostgreSQL cases and security pass. Full repository checks retain a
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

PR48 review correction: a later contradictory receipt within the original
reservation throws inside reconciliation, leaving the earlier lower charge and
admission active. Add a persistent disputed-call hold and suspend admission in
the same transaction, preserve the original receipt, then report conflict after
commit. Three new cases failed against original `4f83e244`; all fourteen passed
with the correction on isolated PostgreSQL 17. Owned resources were cleaned.
Initialization still requires verified no prior provider spend or
in-flight calls, or separately reviewed import of existing liabilities.

Recorded by gpt-6-astra through Codex (T3 Code).

PR48 current verification: after PR43 merged as `026b4d70`, the corrected budget
branch was rebased onto actual main. Full `pnpm check` and `pnpm security:check`
now pass, including the earlier route deadline case. The fourteen PostgreSQL
cases passed with byte-identical adapter, SQL and tests. Earlier red evidence is
retained. Exact P2 re-review and root merge disposition remain pending.

Verified by gpt-6-astra through Codex (T3 Code).

## ADMIN-VERCEL: show and deploy the existing admin web screens

User requests a coherent admin dashboard on their logged-in Vercel Hobby team.
Reuse points, rewards, submissions, reports and participation screens; retain
Render admin access and server-assigned roles. Add only public browser assets,
fixed Render API routes and one optional exact added browser origin. No native
app, real data mutation, role grant, paid resource or Render setting changes.
Tracker: unlinked; related admin scope #12 and #13. Live assigned-admin proof
requires legitimate access and remains blocked. Local implementation and browser/auth proof complete. Independent review of
DAST10202 and exact-source candidate is pending; no production deployment.

Edited by gpt-6-astra through Codex (T3 Code).

PR46 delivery update: user accepted the exact three-form10202 exception; see
[exception record](docs/operations/admin-dast-exception.md). Retained DAST still
fails. Route-main refresh is local only, with scheduled gates and root review
pending. No blanket exception, scanner suppression or cloud action.

Recorded by gpt-6-astra through Codex (T3 Code).

# DEPLOY-010-011: extend guarded retained-database upgrades

Unlinked migration-tool follow-up after PR44, 26 September 2026. The bootstrap
is fixed at nine migrations. Extend only the deployment runner, tests and docs
for retained eight/nine histories through finalized photo 0010 and AI budget
0011, after their SQL reaches main. Preserve exact ordered checksums, prior
ledger timestamps, roles, passwords, ACLs and data. Apply pending DDL and scoped
grants under the existing advisory transaction lock; collisions or failed
validation roll back the entire upgrade. Photo requires SELECT/INSERT only.
The AI owner supplies the final privilege contract. Heavy database proof waits
for the root lease. No SQL edits, production migration, deployment, Actions,
provider calls or shared database access are authorized here.

Recorded by gpt-6-astra through Codex (T3 Code).

DEPLOY-010-011 scope correction: independent review found missing retained
participation column REFERENCES and grant-option refusal. Validate these before
pending DDL without repairing existing ACLs. Historical provider spend also
invalidates an assumed zero budget: the user authorized an explicit 0010 target
so independent photo/journey readers can migrate while AI stays inactive. Omitted
target remains 0011 with its verified initialization prerequisite. Reject target
below existing history; no SQL edits, guessed liabilities or production mutation.

## Native participation in Rewards, 2026-09-26

Tracker: #11, #12 and #13. Add shared fan voting and current operation-linked
participation status to Rewards' existing Redemption and History sections.
Preserve the 500-point non-refundable submission fee (including rejection),
minimum 10-point contributions, server authority, exact ranking and original-key
retries. Selected/fulfilled entries cannot receive contributions; fulfilment
remains demonstration. No app/auth/dock/backend/photo/travel/admin changes.
Static option selection goes through the coordinator. Heavy tests/device proof
await an allocated slot; cloud, providers and CI are excluded. One real PR,
independent review and coordinator-owned squash; no cross-branch copies.

Recorded by gpt-6-astra through Codex (T3 Code).

### AWARD-PRODUCTION-001, 2026-09-26

Requested reachable production journey award readiness using sourced Singapore
factors and retained physical calibration evidence. Preserve feature 03/04/05
rules, assessed distances, endpoint-only missing-middle fallback, idempotent
upward-only ledger and merged PR47 photo preliminary hooks. Server awards/factors
and minimum assessment contract owned here; phone/routes and impact have separate
owners. Tracker: #9. In progress; no shared DB/cloud/provider/CI/device actions.

Award/Impact boundary clarification: user permits labelled estimates for recorded
full journeys with approved factors before physical calibration, without automatic
points or verified-savings claims. Impact owns that implementation. Provisional
points remain unauthorized. Google Routes is selected with strict $0 provider
spend. This award candidate preserves its retained release boundary.

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

Award proof update: isolated PostgreSQL/API regressions, full local check and
security check pass. Photo fixture guard was corrected to the exact worktree
test namespace after it refused the allocated disposable database. No application
photo behavior changed. Pending product question is now explicit CO2 estimation
with neutral car baseline because the candidate published CAG factors numerically
match EPA CO2-only values. No CO2e relabelling or dataset activation is authorized
yet; independent policy code remains testable with synthetic factors.

Recorded by gpt-6-astra through Codex (T3 Code).

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

## REPORT-TEXT-RETENTION: hosted report delivery contract, 2026-09-26

Owning work: report ingestion #19 and approval #20. Latest user contract requires
hosted PDF processing with transient original uploads, durable page-labelled text
and source provenance, deletion after text commits, and expiry of failed uploads.
Existing storage explicitly retains originals and source delivery downloads PDFs.
Preserve assigned-admin approval before official Impact publication and all
unrelated product code. Prepare locally first; root coordinates actual-host
isolation proof and zero-spend verification before any Render Free creation.
New uploads now stay in bounded memory, with no object-storage write. Expiry
duration is pending only for failed/abandoned legacy objects; no default is implied.
Local candidate and tests are in progress; hosted readiness remains unverified.

Recorded by gpt-6-astra through Codex (T3 Code).

Report queue steering, 2026-09-26: rebase preparation through main `e2f95534` and
hold container/parser work until after migration and Impact proofs. Rebase and
lightweight source/fixture inspection completed; report Linux/PG proof remains
queued before native builds. No new-upload decision is pending. Legacy expiry
remains isolated from the new in-memory upload path.

Recorded by gpt-6-astra through Codex (T3 Code).

Root expiry assumption, 2026-09-26: under the user's no-further-decisions request,
legacy failed/abandoned uploads use a configurable 24-hour expiry. New PDFs remain
in memory. Cleanup must skip active uploads and remove successfully extracted
originals only after durable text commits. This code change authorizes no
production bulk deletion; runtime deployment and idle scheduling remain owned by
root. Send blockers to root rather than ask the user again.

Recorded by gpt-6-astra through Codex (T3 Code).

PR53 review correction: cleanup inspected only the first 1,000 name-sorted
legacy objects. This can delay expiry, or starve later expired/saved objects
when new lower-sorted arrivals continue. Fetch the full bounded-page inventory
before deletion changes offsets; reject repeated/out-of-order pages and preserve
active-upload locks, durable commit ordering and expiry. A 2,005-object test
fails before the fix and passes afterward. No remote storage or heavy fixture ran.

Recorded by gpt-6-astra through Codex (T3 Code).

## Impact contribution binding, 2026-09-26

Tracker: [#21](https://github.com/NachikethReddyY/AMR-Fan-App/issues/21). Deliver personal/community lifetime estimated CO2e from
trusted retained journey contributions, separate from official approved ESG.
Replace Home/Impact literal placeholders within accepted geometry. Preserve
award transactions, photo/schema ownership and Travel/account/tab behavior.
Current production journey receipts explicitly report unavailable credit;
empty activity must remain distinguishable from unavailable validation, and
neither state may fabricate a zero or real-travel claim. CI is paused; heavy
checks and isolated database proof require the coordinator's lease.

Recorded by gpt-6-astra through Codex (T3 Code).

Impact decision, 2026-09-26: the user accepts labelled CO2e estimates from full
recorded journeys using approved factors before physical calibration. Display
must not require productionCredit.ready or enable points. Fallback planned
estimates, fixtures and duplicate/top-up contributions remain excluded. This is
project product guidance; no shared instructions changed. The coordinator grants
one bounded isolated DB/full/security slot with owned containers and generated
credentials only. CI, provider, device and shared DB actions remain prohibited.

Recorded by gpt-6-astra through Codex (T3 Code).

Impact root-review correction: the latest settled receipt could remain visible
when newer evidence had already advanced the journey assessment. Match the
current assessment version/revision in the same snapshot and expose mismatches
as `assessment_pending` until explicit settlement. The interval regression is
authored; real PostgreSQL red/green proof remains queued. This enforces existing
project guidance in `docs/operations/awards.md`; no shared guidance changed.

Recorded by gpt-6-astra through Codex (T3 Code).

Impact CO2 integration follows merged PR50 at `458cae1`. The user-approved label
is "Estimated CO2 avoided". Use only explicit compatible CO2 assessed calculations;
legacy CO2e and planned provisional calculations cannot enter CO2 totals. Retain
published-unit discrepancy and neutral one-occupant car scope. No dataset default
activation or peer source copy. Existing assessment-freshness proof remains required.

Recorded by gpt-6-astra through Codex (T3 Code).

Native participation steering: user selected B on 26 September 2026. Contribution
review temporarily replaces the ranking inside Redemption; cancel and an
acknowledged result return to ranking. Selection hold resolved. Heavy checks and
native proof require the coordinator's allocation. One PR remains the endpoint.

Recorded by gpt-6-astra through Codex (T3 Code).

Native participation final steering, 27 September 2026: finish frozen-source
native proof before latest-main refresh; preserve Impact/Home and Reports.
Root owns final integration and squash. Device/Metro/fixture leases released.
Observed protected-dock defect: labels split across lines at maximum text
(Android 3.2, iPhone largest); no letters clipped in retained screenshots.
Do not redesign dock here. Android keyboard and iPhone largest contribution
controls remain unverified for combined native integration. Native fixture,
measurements, screenshots and video paths are recorded in local acceptance proof.

## JOURNEY-NATIVE-001: native recording successor

Related to #8, #7 and #10; successor and provisional receipt steering is unlinked. Restore
only stash a56c0089 on a new branch based on merged main. Implement selected
Travel UI B: active journey replaces search/comparison, arrival and stop remain
accessible, and planning returns after completion. Preserve encrypted offline
GPS capture, immediate finish time, account isolation and conservative leg
attribution. Approved provisional points use the awards owner's retained planned
estimate and recorded endpoints; label their basis and exclude verified impact.
Approved factors and strict $0 provider configuration remain separate gates.
Heavy checks, native builds and T3 device proof wait for the root lease. Physical
calibration is unavailable. One new PR, no CI queries or final APK delivery here.

Recorded by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: Google route warning

Cloud review confirmed ordinary step geometry does not introduce an extra route
request. Retain Google's beta/missing-path warning in existing walking/cycling
route details, including displayed walking connections. Do not add traffic-aware
routing, TRAFFIC_ON_POLYLINE or speedReadingIntervals. Strict $0 project activation
remains held; no provider calls establish Singapore mode availability or latency.

Recorded by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: explicit CO2 provenance and overnight coordination

The user accepted provisional CO2 estimates from the exact CAG factors: car
0.1901 kg/vehicle-km with one occupant, bus 0.0441 kg/passenger-km and MRT
0.0578 kg/passenger-km, under published_surface_access scope. The awards owner
will publish explicit gas/unit fields in PR50. Native parsing and copy must use
those retained fields after the main squash. Legacy CO2e receipts retain their
original meaning; no ICE, Singapore fleet-average or lifecycle interpretation.
The previous receipt schema freeze is superseded for these additions only.

The user delegated overnight coordination to root. Send blockers there and ask
no further user questions. Existing internal-build authority still follows root
resource leases; final APK delivery waits for all integration. CI stays paused.

Recorded by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: CO2 transport adaptation

Review correction: implicit CO2 dataset activation would break the existing main
client before native integration. Awards removes the default fallback; root will
activate the accepted artifact through `JOURNEY_FACTOR_RELEASE_FILE` only after
the compatible client merges. Native accepts both legacy and CO2 variants under
both calculation statuses without unit reinterpretation. No peer patch copied.

Awards communicated distinct estimated_co2/recommended_co2 variants with CO2 and
kgCO2, plus optional cag-surface-access-co2-v1 receipt measurement. The native
route parser, journey display projection and copy now accept those variants and
preserve legacy estimated/recommended CO2e values. Mixed estimate/recommendation
units and wrong measurement versions fail parsing. Shared calculations remain
with the awards owner. This is source preparation against the communicated
schema; actual main-squash integration and device proof remain pending.

Recorded by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: merged readiness caller compatibility

Awards main 458cae12 retained a literal-only includes parameter for released
single-mode distance. The native assessed-leg union exposed a type error. Root
authorized a narrow exact-membership comparison and regression in the successor
PR. Typecheck and 12 readiness tests pass; leg geometry remains unvalidated under
the unchanged physical release schema. No API/default dataset activation changed.

Edited by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: merged assessment decoder and build authority

The freeze check reproduced rejection of the merged physical_validated server
assessment by the phone's old literal-only decoder. Both server statuses are now
readable, with a focused regression; the phone grants no physical release.
Root authorized ios.bundleIdentifier xyz.theynr.amrfanapp for internal simulator
builds after confirming no tracked identifier. Apple account/distribution
registration is outside that authority. Internal Android compile passed; iOS and
combined device proof remain pending. No final APK claim.

Recorded by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: independent review corrections

Confirmed and fixed recorder cleanup/successor overlap, settlement envelope
mismatch and unacknowledged settlement loss. Failure-first deferred-stop,
clear/replacement and real registered-HTTP-to-native regressions now pass.
The recorder enforces cleanup and receipt boundaries independent of React.
Geometry review found no blocking issue. Device proof remains a separate gate.

Fixed by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: actual Android storage and job scheduling

The internal Pixel build reproduced two native integration failures missed by
pure recorder tests. Expo Crypto's Android fromCombined bridge rejects a base64
string despite the public type accepting it. The adapter now decodes stored
ciphertext to bytes before native decryption; its failure-first regression
preserves validated capture recovery. After that correction the retained intent
sent exactly one Start with the unchanged two-field input. The first native
location callback then crashed because TaskManager persists its job without a
manifest boot permission. Explicit RECEIVE_BOOT_COMPLETED is required; no other
permissions or production identity changes. Actual rebuilt callback/finish proof
remains pending. Temporary diagnostics are removed, with no raw data in source.

Fixed by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: iOS transient location and offline controls

Actual iOS Core Location delivered temporary locationUnknown followed by a valid
callback; treating all task errors as terminal stopped the capture first. Ignore
only iOS numeric0 with NSError's kCLErrorDomain description. Other errors still
interrupt, and no location is invented. Expo exposes the domain only in message.

Foreground account refresh while the fixture was offline hid the retained
capture. Root authorized a journey-only correction: suspend network authority
while account state loads/is unavailable, keep local Arrived/Stop visible, and
resume dispatch only after matching authenticated restore. Logout/profile/401
invalidation still synchronously removes the capture. No auth module changes.
Failure-first recorder/runtime and DOM regressions pass; affected device proof
is in progress.

Fixed by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: suspended recorder authority after asynchronous waits

Independent review found Finish dispatched after suspension during native stop,
and queued restore could re-adopt suspended credentials. A bounded recorder-only
audit reproduced the same missing guard after durable batch/Resume writes and
old capture publication during restore waits. Known 401 also waited for native
stop before hiding capture. Recheck the existing epoch after queue/storage/native
waits, adopt restored context only after validated reads, and reuse synchronous
invalidation for 401. Preserve local Finish and original retry identities.
Failure-first stop/write tests and protected recovery cases pass; final exact-head
review and current native recovery proof remain pending.

Fixed by gpt-6-astra through Codex (T3 Code).

### JOURNEY-NATIVE-001: final acceptance status

Native flow and scoped review corrections are locally verified at 6f18ab5; both
independent reviewers cleared that source. Simulator offline/restart/Finish and
identity-isolation proof completed. Physical/locked behavior, visible Android
numeric keyboard, native provisional receipt and populated Impact remain explicit
limits. Final documentation and the sole native PR proceed under existing root
authority; no merge, release or provider activation is implied.

Verified by gpt-6-astra through Codex (T3 Code).
