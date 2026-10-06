# Tasks

## TRAVEL-REC-003: transit sort control, 2026-10-06

- [x] Suggested/Fastest/Greenest/Simplest picker on Transit options.
- [x] Prove all three reorderings plus unchanged default on device.
- [x] Back out the unfinished map-overhaul app edits; tree builds.

Acceptance: sorts reorder correctly, badges and footnotes untouched, default
view pixel-identical. Proof is the device screenshots above. No server
change, no re-deploy.

Recorded by opencode/muse-spark-1.3-contributor-free through opencode.

## TRAVEL-REC-002: viability cap for active travel, 2026-10-06

- [x] Cap walk/cycle wins at 30 minutes in query recommendations.
- [x] Cap walk wins at 30 minutes in transport recommendations and Jev snapshots.
- [x] Prove dominance (car 5x faster), cleaner-car and near-tie scenarios.
- [ ] Re-deploy the server to BB-1 and re-verify live. No commit or deploy done
  from here.

Acceptance: over-cap active travel stays listed but never wins on either
surface or in Jev ranks; a dominant or cleaner car is recommended with an
honest reason. Server proof local only; live proof needs the re-deploy.

Recorded by opencode/muse-spark-1.3-contributor-free through opencode.

## TRAVEL-REC-001: transit CO2 and recommended pick, 2026-10-06

- [x] Narrow `v1/routes/query` recommendations to verified candidates.
- [x] Estimate transport-plan legs and recommend lowest CO2 within deadline.
- [x] Add Jev rank path with deterministic fallback (needs provider key).
- [x] Prove with backend tests, simulator build, and device screenshots.
- [ ] Deploy the server changes to the backend the app uses, then re-verify
  badges and transit CO2 live. No commit, push or deploy done from here.

Acceptance: transit options show service-calculated CO2, a recommended option
is badged from verified candidates with a Jev rank where available, and
unavailable states stay honest.

Server proof is local plus real BB-1 response shapes replayed through the new
estimators; live gateway and deployed-backend proof still need the provider key
and a deploy. iOS proof is backward compatibility against the old backend.

Acceptance: transit options show service-calculated CO2, a recommended option
is badged from verified candidates with a Jev rank where available, and
unavailable states stay honest.

Recorded by opencode/muse-spark-1.3-contributor-free through opencode.

## AI-ONEMAP-002: live activity assessment and OneMap transport, 2026-10-05

- [x] Send captured image bytes to the multimodal Luna adapter.
- [x] Reject screen, screenshot, indoor, potted-plant, and ambiguous evidence
  before the server points policy can award points.
- [x] Lock the Android camera during processing and move accepted output to a
  separate results state so retakes cannot create concurrent submissions.
- [x] Use OneMap for live place search, map tiles, GPS marker support, and
  route-provider output for train, bus, walk, and car options.
- [x] Deploy the OneMap route configuration and API image to BB-1.
- [x] Run focused AI, route, transport, typecheck, and Android build checks.
- [ ] Add the provider key file at `/home/bb-1/.auth/amr-ai.env` before live
  Luna inference can run on BB-1.

Acceptance: the live path never uses synthetic scoring when the TokenRouter
provider is selected, invalid visual evidence earns zero points, OneMap search
and route responses carry live-source metadata, and the Android APK builds and
installs. Authenticated camera submission remains device-account dependent.

Recorded by gpt-6.1-sol through Codex (T3 Code).

## IOS-REBUILD-001: full Swift iOS rebuild, 2026-10-05

- [x] Run a clean signed simulator build.
- [x] Run a clean iPhone-target compile build.
- [x] Rerun the focused Keychain session check.
- [x] Inspect the simulator app signature and embedded entitlement sections.
- [x] Install and interact with the app on the iPhone 17 simulator.
- [x] Remove the empty GET body that caused `NSURLErrorDataLengthExceedsMaximum`.
- [x] Match the reference dock with a capsule for Home, Rewards, and Impact plus a circular Travel control.
- [x] Install on iPhone 18 Pro and tap through all four destinations.

Acceptance: fresh simulator and iPhone-target artifacts build successfully,
the simulator artifact carries the Keychain entitlement, and focused session
checks pass. Native install and interactive sign-in remain unverified without
physical-device signing; simulator Account resume is verified.

Recorded by gpt-6-astra through Codex (T3 Code).

## ACCOUNT-ANDROID-001: persist session and greet the account holder, 2026-10-05

- [x] Cache the authenticated account beside the encrypted AMR session token.
- [x] Persist the OIDC refresh token in the encrypted store and renew expired
  backend sessions without returning the user to sign-in.
- [x] Persist the selected driver with the existing DataStore preferences.
- [x] Restore the driver and skip onboarding/login navigation when the session
  is still valid.
- [x] Use the real profile display name for the Home greeting.
- [x] Propagate verified Entra display names into a new profile while preserving
  an existing custom name.
- [x] Rebuild/install the Android debug APK and restart BB-1 with the change.
- [ ] Verify a real account's Home greeting after the user signs in once.

Acceptance: updating the APK keeps a valid session and driver choice, and Home
shows the account holder's profile name rather than the selected driver's name.

Recorded by gpt-6-astra through Codex (T3 Code).

## AUTH-ANDROID-003: expired sign-in after Entra callback, 2026-10-05

- [x] Persist the PKCE state and verifier in the encrypted session store so
  activity recreation does not discard the callback transaction.
- [x] Correct BB-1's OIDC scope check to the Entra `scp` claim value
  `account.access`.
- [x] Run Android auth tests, rebuild, and install the debug APK.
- [ ] Complete a fresh account sign-in on the user's Tailscale-connected phone.

Acceptance: a fresh callback survives activity recreation and the API accepts
the resulting access token without showing the expired-session error.

Recorded by gpt-6-astra through Codex (T3 Code).

## AUTH-NET-004: Tailscale test path, 2026-10-05

- [x] Bind BB-1 API to `0.0.0.0:18080` so both LAN and Tailscale can reach it.
- [x] Verify `/health` through `100.117.231.37:18080`.
- [x] Rebuild and install the Android debug APK with the Tailscale base URL.
- [ ] Complete sign-in and camera upload on a phone that has Tailscale access.

Acceptance: the test phone can reach BB-1 over Tailscale and the existing
authenticated flows remain unchanged.

Recorded by gpt-6-astra through Codex (T3 Code).

## AUTH-NET-003: retry BB-1 LAN after host recovery, 2026-10-05

- [x] Confirm BB-1 is reachable and identify its active LAN address.
- [x] Ensure the API binds that address on port 18080.
- [ ] Verify `/health` and `/ready` from an external LAN client and reinstall
  the matching APK.

Acceptance: the LAN endpoint responds and the phone can use the same address
without Tailscale. BB-1 self-checks pass; external LAN access is blocked by
host or Wi-Fi network policy.

## AUTH-NET-002: LAN endpoint still unreachable, 2026-10-05

- [x] Check BB-1 presence and current LAN address: the host is offline on both
  Tailscale and the local `192.168.0.0/24` network.
- [ ] Check the API listener and host firewall for port 18080 after BB-1 is
  online.
- [ ] Fix the smallest reachable endpoint or update the APK to the confirmed
  address.
- [ ] Verify the endpoint from a LAN-capable client and install the matching
  APK.

Acceptance: a phone on the same LAN can reach `http://<bb1-lan-ip>:18080`
without Tailscale, and the sign-in exchange no longer times out. Blocked until
BB-1 is powered and reachable.

## AUTH-NET-001: use BB-1 LAN address for phone access, 2026-10-05

- [x] Reproduce the timeout and confirm the APK targeted the Tailscale address.
- [ ] Bind BB-1 to its reachable LAN address after the host comes back online.
- [x] Rebuild/install the phone APK with the LAN address.
- [ ] Verify health, readiness, and the sign-in return path over the LAN.

Acceptance: the phone APK uses `192.168.0.31:18080` and no longer requires a
Tailscale connection to reach BB-1. Remote listener proof is pending because
BB-1 is currently offline.

## AUTH-UI-002: sign-in button does not open browser, 2026-10-05

- [x] Reproduce the no-op tap and identify the silent pending-auth/in-flight
  guard as the responsible boundary.
- [x] Fix the smallest responsible boundary without changing the OIDC/PKCE
  contract.
- [x] Rebuild/install the Android APK and verify the button opens the browser.

Acceptance: tapping "Sign in or create account" launches the configured Entra
sign-in URL or shows a visible actionable error when browser launch is
unavailable. Verified on Pixel_10_API_36.

## AUTH-401-001: expired session during sign-in, 2026-10-05

- [x] Reproduce the expired-session 401 on Android and identify server
  validation as the primary mismatch: BB-1 expected Supabase while Android
  sends Entra External ID tokens.
- [x] Fix the smallest responsible boundary and preserve encrypted token
  storage and server-side authorization.
- [x] Rebuild/install the Android APK and verify the updated auth boundary is
  present on Pixel_10_API_36.
- [ ] Complete a fresh sign-in with a real account on a reachable phone.

Acceptance: a fresh sign-in does not reuse an expired token, the API accepts
the new session, and an expired session produces a recoverable sign-in path.
BB-1 is aligned to Entra; final account proof remains device-dependent.

## CAMERA-UI-003: camera preview and backend assessment, 2026-10-05

- [x] Render the captured URI behind the confirmation actions.
- [x] Supply the explicit MVP activity provider from the API start entry point.
- [x] Keep assessment output inside the existing evidence-to-points policy.
- [x] Rebuild the Android debug APK.
- [x] Deploy the API provider configuration to BB-1 and verify its health,
  readiness, and explicit provider settings.
- [ ] Exercise the full authenticated upload on a phone.

Acceptance: capture shows the selected photo, Use this photo reaches an enabled
server activity capability, and the returned score/category/points appear in
the confirmation state without retaining raw media. BB-1 deployment is
verified; authenticated phone proof remains open behind the account gate.

## AI-PIPELINE-001: BB-1 staging host, 2026-10-04

- [x] Package the existing API and AI adapter boundary in a reproducible BB-1
  Compose bundle.
- [x] Build the pinned API image on BB-1's x86 host.
- [x] Start private Postgres and apply the ordered schema migrations.
- [x] Start the API on the BB-1 Tailscale address and verify `/health` and
  `/ready`.
- [x] Verify AI inference remains disabled and run a synthetic in-container
  assessment without real media.
- [x] Normalize OneMap account-password and access-token environment aliases;
  keep `AMR_ROUTES_PROVIDER` as the provider switch.
- [x] Load the optional BB-1 OneMap auth env file without placing secrets in the
  checkout.
- [ ] Install a reviewed loopback model gateway and enable a provider only after
  credentials, output validation and production scope are approved.

Acceptance: the existing AI pipeline is packaged and running on BB-1 with no
provider secrets in the repository or container, health and readiness checks
pass, and real inference remains explicitly unavailable until its provider is
reviewed.

## CAMERA-UI-002: compact post-capture confirmation, 2026-10-04

- [x] Prepare and approve a static direction combining A's hierarchy with B's
  compact action layout.
- [x] Replace the Android confirmation copy with "Ready to send?", "Use this
  photo" and "Retake photo".
- [x] Make Android Retake return to the live camera while keeping the selected
  photo local until the existing verification capability is available.
- [x] Make Swift wait for Use this photo before starting its existing
  verification request, and make Retake reopen the camera surface.
- [x] Build both native targets, install the Android APK, and inspect the
  confirmation state and Retake action on Pixel_10_API_36.
- [ ] Inspect the Swift confirmation state on a connected device after the
  account gate is cleared.

Acceptance: the post-capture state contains no repeated capture or device
retention explanation; its visible task copy stays below ten words, the Back
control remains reachable, Use this photo starts Swift's existing verification
path or confirms Android's local retention until that capability is available,
and Retake returns to capture without leaking the retained photo.

## CAMERA-UI-001: direct camera surface, 2026-10-04

- [x] Replace the Android external camera activity with an in-app CameraX
  preview.
- [x] Replace the Swift system image picker camera with an AVFoundation
  preview.
- [x] Keep Back at the top left and move gallery selection onto the camera
  surface.
- [x] Use a centered circular shutter and preserve the existing verification
  handoff.
- [x] Build both native targets, run repository checks, install the Android APK,
  and exercise camera, gallery, Back, and shutter flows on Pixel_10_API_36.

Acceptance: tapping the camera action opens the live preview directly; the
camera surface has a reachable Back control, an overlay gallery action, and a
centered shutter; the old intermediate chooser is absent; selected or captured
photos still reach verification.

## ONBOARDING-UI-002: concise driver-selection heading, 2026-10-04

- [x] Remove the repeated first-person wording from the large heading.
- [x] Reduce the heading size in Swift and Kotlin.
- [x] Remove the profile driver-switching note.
- [x] Rebuild both native targets.
- [ ] Inspect the driver screen on device after account access is available.

Acceptance: the screen keeps the existing "I / AM" eyebrow, shows a smaller
"On this team." heading, and no longer mentions switching drivers in a profile.

## NAV-UI-002: fixed detail back action and rewards copy, 2026-10-04

- [x] Add one fixed circular Back control to Android detail destinations.
- [x] Remove bottom Back actions that can fall below the gesture area.
- [x] Remove repeated demo catalogue and local coupon wording from store views.
- [x] Keep the single sample-data explanation in Account.
- [x] Build both native targets and install the Android APK.
- [ ] Open profile and merchandise screens on Pixel after account access is
  available.

Acceptance: every Android detail destination has a reachable back control above
the scroll content; store and rewards screens do not repeat demo wording; tab,
reward, profile and account behavior remain intact. Final detail-screen device
proof is pending a registered provider account.

## NEWS-UI-001: compact News header, 2026-10-04

- [x] Replace the text Back control with a circular icon-only button.
- [x] Reduce header spacing so Latest sits closer to the back control.
- [x] Confirm the bottom curve is emulator/device display chrome.
- [ ] Inspect the rebuilt News screen on the connected Pixel after an account
  state is available.

Acceptance: the News screen shows a circular accessible back control without a
Back label, Latest sits higher, and the list and system gesture area keep their
existing behavior. Native builds pass; the final device screenshot is pending
the account gate.

## NAV-UI-001: flat bottom navigation, 2026-10-04

- [x] Remove capsule and circle containers from the Swift bottom bar.
- [x] Clip the Android navigation container to a rectangle.
- [x] Rebuild both native targets and install the Android debug APK on Pixel_10_API_36.

Acceptance: bottom navigation has straight outer edges, four destinations
remain reachable, and safe-area handling is unchanged. The Android and Swift
builds pass; a connected Android home screenshot is unavailable in this run
because the rebuilt app is at its account gate.

## AUTH-002: Android account URL handoff, 2026-10-04

- [x] Reproduce the account gate jumping directly to the home shell.
- [x] Route the account action through the configured OIDC authorization URL.
- [x] Add Android redirect handling, state validation and PKCE token exchange.
- [x] Preserve encrypted backend session storage and show auth errors in the gate.
- [x] Build, install and verify the provider URL on Pixel_10_API_36.
- [ ] Complete a real provider sign-in and backend session exchange with a
  registered test account.

Acceptance: tapping the Android account action opens the existing sign-in or
sign-up URL, and a valid callback can create the normal backend session without
using the local demo session.

## ONBOARDING-UI-001: native onboarding hierarchy, 2026-10-04

- [x] Inspect the Swift and Kotlin onboarding and driver-selection callers.
- [x] Replace uneven progress segments with equal-width Aston Martin green segments.
- [x] Center the green Next action label and remove the trailing action arrow.
- [x] Remove driver-card arrows and the duplicate driver-selection sign-in action.
- [x] Build both native targets and verify the corrected Kotlin flow on Pixel.

Acceptance: both native onboarding flows show readable progress, a centered
green primary action, and driver selection advances to the existing login gate
without duplicate sign-in or decorative card arrows.

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
## Native travel and sustainability pipeline, 2026-10-05

- [x] Send selected iOS and Android place coordinates to the shared transport planner.
- [x] Add OneMap-backed place search with bounded Singapore normalization.
- [x] Add Android search suggestions, GPS step tracking and a Travel back control.
- [x] Submit Android camera photos through the existing evidence score and points policy.
- [x] Build API, Android and Swift targets; exercise both authorized devices.
- [ ] Supply reviewed OneMap credentials and a permitted Luna/JEV provider configuration for live inference.

## PROFILE-SETUP-001: username, email and birthday in onboarding, 2026-10-05

- [x] Add `email` and `birthday` to `app.profiles` (migration 0020) and extend `PATCH /v1/profiles/{id}`.
- [x] Parse/validate the new fields in types, store and HTTP tests.
- [x] Kotlin: editable profile (name/email/birthday), profile-setup step after sign-in, Home greeting uses the chosen name.
- [x] Swift: same profile fields on AccountScreen, setup step, Home greeting uses the chosen name.
- [x] Run focused backend tests and native builds where available.

Acceptance: a signed-in account without a real username or birthday gets a setup page; after saving, Home greets by the chosen name and the account screen edits name, email and birthday.
