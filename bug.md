## 2026-10-07: Hosted admin dashboard could not start CIAM sign-in (fixed)

The live dashboard at `https://amr-admin.vercel.app/admin/` showed "Admin sign-in
setup is pending. No local test sign-in is enabled." and never rendered a
sign-in button. The dashboard assets were current; two deploy configurations
were not.

The `bb1-api-1` container was built from a source copy dated 2026-10-04, before
the OIDC browser-config branch existed, so `/admin/config` returned
`{"auth":{"mode":"unavailable"}}`. Separately, the repository-root `vercel.json`
still carried the Supabase-only `connect-src`, while the browser performs the
CIAM token exchange itself, so the corrected API alone would have failed at that
fetch. Vercel's Root Directory is `.`, so the root file governs and the copy
inside the build output is ignored.

The CSP now lives in one exported constant shared by the build script and the
root configuration, and the tooling test compares both files so the pair cannot
drift again.

Preceding checks confirmed the redirect URI `https://amr-admin.vercel.app/admin/`
is already registered (the authorize endpoint returns the sign-in page, not
`AADSTS50011`) and the CIAM token endpoint returns `Access-Control-Allow-Origin:
*`. No `deploy/bb1/.env` change was required, because `ADMIN_ORIGIN` alone
resolves the redirect.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Challenge submission charged points without adding a challenge (fixed)

The challenge screen deducted 500 points and inserted the idea only into its local
SwiftUI state. It never called the authenticated submissions API, so the debit
was not ledger-backed and the idea disappeared when the destination sheet was
recreated. Challenge submission now posts to `/v1/profiles/:profileId/submissions`;
the server atomically creates the pending submission and records the 500-point
debit. The app updates its balance from the committed ledger result, adds the
returned challenge, persists its display metadata, and does not change points on
request failure. A stable request ID is reused while retrying the same failed
submission.

Proof: iOS Simulator build succeeded, API typecheck passed, focused submission
contract/HTTP tests passed, and `git diff --check` passed. UI/device interaction
was not run in this turn.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Admin dashboard CIAM sign-in support (provider registration pending)

The admin API and static dashboard previously disagreed: BB-1 verified CIAM/OIDC
access tokens, while the dashboard only attempted Supabase password sign-in. The
API now exposes public OIDC browser metadata, and all admin pages support
authorization-code + PKCE sign-in with an in-memory API session. Server role
checks and ledger authorization are unchanged.

Remaining blocker: the CIAM client must have the hosted redirect URI
`https://amr-admin.vercel.app/admin/` registered. Until that provider setting is
made, the authorization callback may reject the redirect even though the code
path is ready.

Proof: admin artifact, API typecheck, OIDC/auth tests, exact-origin tests and
`git diff --check` passed. No deployment was performed in this turn.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Retry 5,000-point testrun grant (blocked)

The account now exists in live BB-1 as the real profile `Nachiketh Reddy`, with
current balance 132, and its principal role is `fan`. The requested 5,000-point
adjustment was not applied because this operation still lacks an authorized
admin session token. No balance or ledger row was changed.

Next unblocker: sign in as an assigned admin through the approved admin flow,
then submit the adjustment for the resolved profile.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Grant 5,000 points to testrun account (blocked)

Requested a 5,000-point ledger-backed grant for `ynrdevs+testrun@gmail.com`.
The live BB-1 database has no profile matching that email. No balance or ledger
row was changed.

Blocked until the account signs in through CIAM and its created profile ID can be
resolved, or the user supplies an already-created profile identity through the
approved admin adjustment flow.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Grant 5,000 points to ieslrun account (blocked)

Requested a 5,000-point ledger-backed grant for `ynrdevs+ieslrun@gmail.com`.
The live BB-1 database has no profile matching that email, and the current
identity model stores CIAM issuer/subject rather than a usable email lookup.
No balance or ledger row was changed.

Blocked until the account signs in through CIAM and its created profile ID can be
resolved, or the user supplies an already-created profile identity through the
approved admin adjustment flow.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Hide Impact travel distance (unlinked)

The user asked to hide the travel-distance statistic. Removed the distance tile
from the personal Impact stat grid while retaining backend route distance
persistence and all other Impact values.

Proof: iOS Simulator Debug build succeeded. Installed app accessibility snapshot
on iPhone 18 Pro Simulator shows verified activities and Green Points, with no
travel-distance label or unavailable tile.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Impact car left the supplied circuit (unlinked)

The supplied screenshot showed the animated car drifting away from the Singapore
circuit because the overlay used a hand-sampled polyline that did not match the
SVG centerline. Replaced that approximation with a Canvas overlay driven by the
SVG's exact cubic centerline. The map remains the supplied asset, while the
Canvas draws the muted track, teal progress, and shared geometry for the car
position.

Proof: iOS Simulator Debug build succeeded. The updated app was installed on
the iPhone 18 Pro Simulator, opened to Impact, and the direct screenshot showed
the teal car centered on the SVG track.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Live BB-1 rejected OIDC tokens (unlinked)

The live BB-1 `.env` selected `AUTH_PROVIDER=supabase`, so an Entra External ID
access token sent to `POST /v1/session` was verified as a Supabase token and
returned 401. Switched BB-1 to `AUTH_PROVIDER=oidc` with the documented Entra
values and removed the Supabase key, then recreated `bb1-api-1`. The Swift
client default base URL now targets BB-1 (`http://100.117.231.37:18080/`).
BB-1 `/v1/session` now reaches the OIDC verifier. Live sign-in through BB-1
is verified only after a real Entra token is exercised; if the audience or
`scp` value differs, update `AUTH_AUDIENCE` / `AUTH_REQUIRED_SCOPE` on BB-1.

Fixed by opencode/big-pickle through opencode (T3 Code).

## 2026-10-07: Remove automatic demo-mode fallback (unlinked)

The native sign-in path caught any provider or backend error and replaced it with
an invented local `Demo Fan` profile, hiding the real failure. Removed the
automatic fallback, demo banner, synthetic profile, and local profile mutation
branch. Failed authentication now stays at the account gate and preserves the
actual error message. Device check after reinstall shows the sign-in gate with no
demo profile. The underlying prior failure was a backend identity-verification
401, not a valid account sign-in.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Navigation completion used stale CO₂ and points (unlinked)

The iPhone recording showed the navigation result using the backend's original
recommendation instead of the selected route's computed saving. The result also
used 10 points/kg while the accepted journey rule is 50 points/kg. Navigation
completion now receives the selected route's computed CO₂ saving and uses the
shared 50-point conversion with the 2,000 cap. A simulator build passed.

Device verification was attempted on the iPhone 18 Pro simulator after install,
but the app opened at the sign-in gate and no route could be reproduced without
account access. The result screen remains device-unverified for this fix.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: iPhone review: Impact color and transport estimates (unlinked)

Review of the supplied iPhone recordings found two concrete mismatches: the
Singapore SVG rendered red in the dark Impact card, and selecting a transit route
updated only the map route state, not the summary's selected-option state. The
route cards also omitted provisional points. The supplied SVG now renders through
the app's teal template tint. Transit and other route taps synchronize both
selection states and show provisional points calculated from the available car
baseline at 50 points per avoided kilogram, capped at 2,000. Simulator rendering
and live backend values remain unverified.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Use the supplied Singapore circuit SVG (unlinked)

Replaced the hand-drawn circuit geometry in the native Impact animation with the
user-supplied `/Users/nr/Downloads/Singapore_street_circuit.svg`, copied into the
app asset catalog as `SingaporeStreetCircuit`. The animation still uses the same
slow-fast-slow timing and Replay/reduced-motion behavior. Native rendering remains
unverified.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Full Impact views implemented natively (unlinked)

Expanded the native Impact screen to include the approved You, Fans, and AMF1
views. Added tabs, personal contribution comparison, fan progress and travel
breakdowns, team footprint and target charts, report metrics, carbon decoder,
and the existing slow-fast-slow lap animation. Simulator rendering remains
unverified.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Impact lap animation uses slow-fast-slow easing (unlinked)

Implemented the approved lap animation in the native SwiftUI Impact screen with a
circuit path, replay action, approximately 11-second duration, and accessibility
reduced-motion support. Changed the timing to ease in, move fastest through the
middle, and ease out before stopping. Simulator rendering remains unverified.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Slow the Impact lap animation (unlinked)

The user approved the Impact concept and asked for slower animation. Increased the
lap animation duration in `prototypes/impact-final-mock.html` without changing its
layout, copy, data or reduced-motion behavior. Rendered animation remains
unverified because browser consent was not given.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-07: Impact screen mock with laps and team comparison (unlinked)

Request: present the 2025 Make A Mark ESG report to fans as personal, fan and
AMF1 views, with Marina Bay lap comparisons, an animated AMR car tracing laps,
and the fan's contribution against team moves. Static mock delivered at
`prototypes/impact-final-mock.html`; native implementation awaits the user's
selection. Rendered animation is unverified without browser consent.

Recorded by opencode/exo-free through opencode.

## 2026-10-06: Start navigation ignored taps and map showed no route (unlinked)

The Start navigation button did nothing visible when the transport plan was
unavailable, and the map drew no line at all when Apple returned no path and
the backend legs carried no shape. Start navigation now always plays the
JourneyCompletionView demo animation, and the map falls back to the leg
endpoints or a direct origin-to-destination line. GPS guidance is removed
from the demo path per the MVP request.

Proof: `xcodebuild` simulator Debug build succeeded. Rendered behavior on
device remains unverified without browser consent.

Fixed by opencode/fledge-alpha-free through opencode.

## 2026-10-06: profile screen name and empty badge slots (unlinked)

The profile banner split the saved name awkwardly and showed a global rank value
without an accepted data source. New accounts also rendered filled badge pins
instead of a clear empty action. The banner now uses smaller constrained name
text, removes the unsupported rank, and renders each empty slot as a dotted
circle with a plus icon. Existing earned badges keep their current controls.

Proof: signed Swift simulator build succeeded and the installed iPhone 18 Pro
screen exposed the saved name without the rank. Empty-slot rendering was
verified in source; the current account has earned badges, so no empty-slot
state was available in the live simulator pass.

Edited by gpt-6-luna through pi (host unknown).

## 2026-10-06: profile setup exposed backend schema error (unlinked)

The iOS profile setup screen displayed the backend response "Only displayName
is accepted." after a valid name, email and birthday were entered. The screen
also lacked local validation, presented email as required-looking, used an
ambiguous disabled state, and placed the action too low in a large empty layout.
The Swift profile screen now validates name, optional email and birthday,
translates the known schema failure to user-facing copy, uses explicit optional
labeling, improves spacing and hierarchy, and makes the save action state clear.
The first current-source build was unsigned (`CODE_SIGNING_ALLOWED=NO`), so its
keychain write failed before authentication could persist. The fix removes the
unneeded custom keychain group for this single-app target, rebuilds with
simulator signing enabled, and reinstalls `com.amr.fanapp` on iPhone 18 Pro.
The authenticated pass reached the live API, but the API rejected the payload
before writing it. The staging inventory confirms that Azure is pinned to old
source `36996ec`, whose profile PATCH accepts only `displayName`; the local API
already accepts name, email and birthday. Updating the app alone cannot make
all three fields persist. Deployment of the current API is the required next
step, and was not performed without deployment authority.

Fixed by gpt-6-luna through pi (host unknown).

## 2026-10-06: photo activity Luna call chain (unlinked)

Android photo submission ended in "No points yet" with reason `provider`,
verbatim server output for an attempted-but-failed TokenRouter Luna call.
Traced layer by layer with the user's live probes: missing env flag and key
variable, a parser rejecting the gateway's dated model echo, a validator
rejecting newlines in the two-paragraph instruction, each fixed with unit
proof. Rejected and uncertain results now also carry the model's bounded
rationale through to both apps, which already display it, so verdicts
explain themselves. Same trust boundary as accepted-path rationale. Database
suites fail identically with and without these changes (no local PostgreSQL
here). Needs the BB-1 re-deploy; then a verdict should state its own why.

Update 2026-10-06 (shape tracing): intermittent `invalid-output` on a gallery
photo means Luna answered but the answer broke strict validation somewhere
between the wire envelope and the activity schema. Both rejection points now
log issue paths and codes only, never values or content, so the next failure
names the exact field. Permanent observability, no posture change.

Fixed by opencode/muse-spark-1.3-contributor-free through opencode.

## 2026-10-06: transfer station names and stop counts unavailable (unlinked)

Transit legs show generic labels ("Transfer", "MRT/LRT") instead of station
names because neither provider returns stop names: OneMap transit legs carry
coordinates only, and Google steps are not retained per leg. Naming stations
("Board at Orchard, alight at City Hall, 3 stops") needs a bundled MRT/LRT
station directory with nearest-stop matching plus line topology for stop
counts: a data feature, not a display tweak. Tracked as the next job, not
built tonight.

Recorded by opencode/muse-spark-1.3-contributor-free through opencode.

## 2026-10-06: map draws a straight start-to-end line for transit (unlinked)

Transit mode only requests an Apple ETA, never an Apple route, so the map
falls back to joining backend leg endpoints. Live legs carry almost no
coordinates (often just the shared start point plus the destination), which
renders as a straight line that ignores the real path and cannot track row
selection, since query options carry no geometry at all.

Fix: transit mode now requests a real Apple transit path with ETA fallback,
and the backend fallback only draws with three or more distinct points, so a
bare start-to-end pair draws nothing instead of a straight lie. Device proof:
transit shows markers only where Apple has no transit path here, and the car
tab shows a road-following line. Mode tabs change the line; individual
backend rows cannot move it because neither endpoint returns per-option
geometry. No iOS test target exists, so screenshots are the proof.

Fixed by opencode/muse-spark-1.3-contributor-free through opencode.

Update 2026-10-06: per-option transit path lines. The server dropped
discontinuous OneMap leg shapes, so live options had nothing to draw. The
normalizers now keep per-leg verified shapes (`legShapes`), the transport
plan exposes them as `TransportLeg.path`, and the app draws each shape of the
selected transit option separately with gaps left as gaps. Query rows keep
Apple per-mode lines. Server proof: 34 tests pass including gappy-fixture
shapes and leg passthrough; API typecheck clean. App launches clean against
the old backend. Live shape proof needs the re-deploy below.

## 2026-10-06: server withholds route recommendation on bus-mixed results (unlinked)

Orchard Station to Marina Bay Sands returns three Bus options whose evidence
is not Singapore-indicative, so `v1/routes/query` withholds the whole
recommendation (`factor_applicability_unverified`) and the separate
`v1/transport/plan` options carry no estimates at all. The app now renders the
RECOMMENDED badge whenever the server sends one, but no badge can appear here
until the server either estimates transit-plan legs or narrows the
recommendation to verified candidates. Changing the withhold rule or inventing
leg distances would break the accepted emissions spec; needs a product
decision, not a client patch.

Update 2026-10-06: the user chose narrowing plus full Jev ranking. The server
now narrows query comparisons to verified candidates, estimates transport
legs with disclosed straight-line/apportioned methods, recommends lowest
emissions within tolerance, and attempts a Jev rank with deterministic
fallback. All local; needs a backend deploy plus a Jev key and budget
admission before live proof. Recorded in work.md.

Recorded by opencode/muse-spark-1.3-contributor-free through opencode.

## 2026-10-05: travel showed no carbon figures (unlinked)

Fans compared routes by duration only; the backend's per-option CO2 estimates
never reached the screen, and transit options have no estimate source at all.

Fix: "Other routes" rows show the service estimate with a lowest-CO2 badge and
an unavailable state instead of zero; transit options disclose that estimates
are unavailable. Recorded in work.md.

Recorded by opencode/muse-spark-1.3-contributor-free through opencode.

## 2026-10-05: travel dock blocked the planner action (unlinked)

The global navigation dock rendered inside the Travel planner sheet and covered
its call to action, so places could not be seen or searched. The expanded sheet
also stayed at compact height because its height preferences never delivered.

Fix: the dock hides on the Travel tab with a "‹ Home" exit pill, the expanded
planner is a full-height Google-Maps-style search page, and sheet heights flow
through onAppear/onChange instead of the dead preference keys.

Proof: device screenshots show the visible action, full search page, working
swap, a calculated route, and dock restoration on Home. Recorded in work.md.

Recorded by opencode/muse-spark-1.3-contributor-free through opencode.

## 2026-10-05: live model evidence and OneMap route completion (unlinked)

The activity screen was awarding points from synthetic output and allowed a
retake path that could be pressed while a submission was still processing. The
travel screen also used fallback map/search behavior and reported routes as
outside demo coverage.

Fix: the selected TokenRouter provider now receives the captured image as a
multimodal input. The activity selector rejects screen, screenshot, indoor,
potted-plant, and ambiguous evidence before the existing server points policy.
Android processing locks the camera state and presents results separately. The
travel screen uses OneMap tiles, live search results, current-location support,
and the live route provider for public transport, walking, and driving.

Proof: multimodal dispatch and invalid-evidence tests pass; OneMap search and
route calls on BB-1 return live-source metadata; API typecheck, route and
transport suites, and the Android unit/build checks pass. BB-1 still needs the
private AI env file before Luna inference can execute:
`$AMR_AUTH_DIR/amr-ai.env` with mode 600. Authenticated phone submission is
unverified because the emulator is currently at the Entra sign-in confirmation.

Recorded by gpt-6.1-sol through Codex (T3 Code).

## 2026-10-05: custom navigation dock overlapped the native tab bar (unlinked)

The first native `TabView` pass kept Apple's default tab bar under the custom
reference dock, so two navigation bars appeared at the bottom of the iPhone 18
simulator.

Fix: keep `TabView(selection:)` as the native destination and selection model,
use its page style with the page indicator hidden, and render the requested
three-item capsule plus separate circular Travel control as the visible dock.

Proof: the final signed simulator build is installed on iPhone 18 Pro; taps on
Home, Rewards, Impact, Travel, and Home changed the visible destination; and the
saved screenshot shows a single dock matching the supplied reference.

Recorded by gpt-6-astra through Codex (T3 Code).

# Steering and bug inbox

## 2026-10-05: iOS account resume sent a body with GET (unlinked)

The rebuilt app reproduced `resource exceeds maximum size` on the Account
screen. The simulator log identified the cause: `BackendClient.request` always
encoded `EmptyBody()` into `httpBody`, including for `GET /v1/me`. iOS rejected
the request with `NSURLErrorDataLengthExceedsMaximum` (`-1103`) and the UI
surfaced that transport error.

Fix: centralize the request-body rule in `HTTPRequestBodyPolicy` and omit
bodies for `GET` and `HEAD` while preserving JSON bodies for `POST`, `PUT`,
and other body-bearing methods.

Proof: the focused auth check covers GET, HEAD, and POST policy cases; clean
simulator and iPhone-target builds pass; the rebuilt app resumed the cached
account on the iPhone 17 simulator and the Account screen showed `Your
account`, `Fan`, `0 earned points`, and `Sign out` without an error.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: rebuilt the Swift iOS app with signed simulator output (unlinked)

The requested full iOS rebuild completed from the current Swift source. Clean
simulator and iPhone-target builds both returned `BUILD SUCCEEDED`. The
simulator artifact carries the Keychain entitlement; the iPhone-target app is
an unsigned compile artifact because this checkout has no Apple development
team or provisioning profile.

Proof: `BackendAuthChecks passed`; the simulator executable contains
`__entitlements` and `__ents_der`; the generated entitlement plist contains
`FAKETEAMID.com.amr.fanapp`; and the verification record is at
`.evidence/ios-full-rebuild-20261005/verification.md`. No install or
interactive sign-in was performed, so native UI behavior remains unverified.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: iOS account session error came from an unsigned installed build (unlinked)

The reported Account error is raised by `KeychainSessionStore` when the
installed iOS binary cannot use its Keychain access group. The latest installed
simulator copies had no `__entitlements` section, even though the source target
already wires `Swift-App.entitlements` in Debug and Release. The signed
simulator build generated from the current source embeds
`FAKETEAMID.com.amr.fanapp` as both its application identifier and Keychain
access group.

Fix: produce the simulator app with `CODE_SIGNING_ALLOWED=YES` so the existing
Keychain entitlement reaches the installed binary. The source OIDC flow and
Keychain-only session persistence remain unchanged. A physical iOS build still
needs an Apple development team and provisioning profile.

Proof: `BackendAuthChecks` passed, the signed Swift simulator build passed, the
new binary contains `__entitlements` and `__ents_der`, and its generated
simulator entitlements contain the application identifier and Keychain access
group. The already installed copies remain unverified and still lack those
sections because device installation was not authorized in this turn.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: Android update lost account context and Home used driver name (unlinked)

The encrypted AMR session token already survived an in-place APK update, but
the app did not cache the account response or selected driver. The root
navigation therefore restarted at onboarding, and Home used `driver.firstName`
for its greeting.

Fix: cache the serialized account in the encrypted store, refresh it from
`/v1/me` when available, persist the driver with DataStore, restore navigation,
and use the real profile display name on Home. BB-1 now carries a verified Entra
display name into a new/default profile while preserving custom profile names.

Proof: Android unit tests, API typecheck, BB-1 build/restart and APK install
passed. The emulator returned to the sign-in gate after selecting a driver,
confirming driver state was persisted across the app flow. A real account Home
greeting remains unverified without the user's sign-in.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: session cache needed renewal after backend expiry (unlinked)

The Android app persisted its backend session token, but that token expires
after seven days. An update after expiry could still show the cached identity
only until the first authenticated request returned 401, then force a new
sign-in.

Fix: request and persist the Entra refresh token in encrypted preferences,
exchange a renewed provider token for a new BB-1 session on 401, and clear both
tokens and the cached account on sign-out or failed renewal.

Proof: Android unit tests and debug APK assembly passed; the APK was installed
over the existing Pixel_10_API_36 app without clearing its data. A real
expired-session renewal remains unverified without a test account and an
expired token.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: Android sign-in expired after callback (unlinked)

The Android flow kept its PKCE state and verifier only in the in-memory
`SessionViewModel`, so activity recreation while Chrome was open produced an
expired callback. BB-1 also compared the full requested scope URI with Entra's
`scp` claim, which contains the scope name `account.access`.

Fix: persist the short-lived PKCE transaction in the existing encrypted store,
clear it on every callback outcome, and configure BB-1 with
`AUTH_REQUIRED_SCOPE=account.access`. The API keeps issuer, audience, JWKS,
signature, expiry and scope validation.

Proof: Android unit tests and debug APK build pass; BB-1 health returns 200;
the updated APK is installed on Pixel_10_API_36. A real fresh account callback
on the user's phone remains unverified.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: LAN path remains unreachable; Tailscale test path restored (unlinked)

BB-1 now listens on `0.0.0.0:18080`. The Tailscale endpoint
`100.117.231.37:18080/health` returns HTTP 200 from the Mac. The LAN endpoint
still cannot be reached from `192.168.0.34`, so the router or Wi-Fi isolation
issue remains separate from the API listener.

The Android debug APK was rebuilt and installed with
`http://100.117.231.37:18080/`. The phone must have Tailscale connected to use
this build.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: BB-1 API is bound to LAN but blocked from LAN clients (unlinked)

BB-1 is online again. The API listens on `192.168.0.31:18080`, and both
`/health` and `/ready` pass when requested from BB-1 itself. The Mac at
`192.168.0.34` still receives `No route to host` for ports 22 and 18080 on the
LAN address, while the Tailscale path works. This points to a host firewall or
Wi-Fi client-isolation rule, not the API listener or APK. UFW is disabled, so
the remaining checks are nftables policy or the router's guest/client-isolation
setting.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: BB-1 LAN address is unreachable (unlinked)

The APK correctly targets `192.168.0.31:18080`, but BB-1 is currently offline.
Tailscale reports `bb-1` offline, and the Mac at `192.168.0.34` receives
`No route to host` for both ping and SSH to `192.168.0.31`. There is no host
available to serve port 18080.

The APK and deployment configuration remain pointed at the requested LAN
address. The API listener and phone sign-in path cannot be verified until BB-1
is powered and connected to the same LAN.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: phone APK used a Tailscale-only BB-1 address (unlinked)

The delivered debug APK pointed at `100.117.231.37:18080`, so a phone without
Tailscale timed out before the sign-in exchange returned to the app.

Fix in progress: deployment documentation now uses a BB-1 LAN address and the
new APK targets `192.168.0.31:18080`. BB-1 must be online and restarted with
`API_HOST=192.168.0.31` before the LAN endpoint can be verified.

Proof: the rebuilt APK contains `http://192.168.0.31:18080/` and is installed on
Pixel_10_API_36. Tailscale reports BB-1 offline, so remote health and LAN
listener checks are pending.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: sign-in button silently ignored taps (unlinked)

The Android gate used early returns when a resume request was busy or an older
PKCE challenge was still pending. A dismissed browser could therefore leave the
button with no visible action. Browser launch also had no explicit fallback.

Fix: every tap restarts the pending challenge, uses Custom Tabs when available,
falls back to the device browser, and reports a launch error instead of doing
nothing.

Proof: the rebuilt APK was installed on Pixel_10_API_36; tapping the button
opened the Entra sign-in Web View.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: Android sign-in returned 401 after the account callback (unlinked)

The Android app requests an Entra External ID access token, while the BB-1
staging API was still configured with `AUTH_PROVIDER=supabase`. The exchange at
`POST /v1/session` therefore rejected the provider token. A stale saved AMR
session could also remain in encrypted storage and keep retrying `/v1/me`.

Fix: BB-1 now uses the documented Entra issuer, audience, JWKS URL and scope.
Android clears a saved session after a 401, maps 401s to a recoverable sign-in
message, and ignores a duplicate callback URI instead of reporting a second
expired flow.

Proof: BB-1 restarted with `auth=oidc`, `/health` and `/ready` pass, the JWKS
endpoint is reachable from BB-1, and the rebuilt APK is installed on
Pixel_10_API_36. A real account callback still needs to be exercised on a
device with valid credentials.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: camera confirmation hid the image and backend capability was disabled (unlinked)

The Android confirmation card showed a black surface after capture and reported
that photo analysis was unavailable. The client upload method existed, but the
production API start entry point never supplied an activity provider, so the
availability endpoint correctly returned disabled.

Fix: the confirmation state now renders the selected URI, clears stale result
state when retaking, and the API can use an explicit `synthetic` MVP provider.
That provider hashes only transient canonical bytes and emits a bounded review
candidate; the existing evidence policy and points settlement remain the only
authority. BB-1's example enables this provider for testing.

Proof: API typecheck, AI tests (198 passing), Kotlin compile and debug APK build
passed. BB-1 rebuilt and restarted with the synthetic provider enabled;
`/health` and `/ready` passed. Authenticated phone proof remains pending behind
the account gate.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: credential names were ambiguous (unlinked)

The supplied OneMap `ONEMAP_APIKKEY` name did not match the server's account
credential schema, and the configuration did not explain whether it was an
account password or an access token. The owner asked for compatibility aliases
and environment-based provider switching without renaming the existing secret.

Fix: route configuration now accepts the supplied `ONEMAP_APIKKEY` spelling as
an access token, the official `ONEMAP_EMAIL_PASSWORD` account-password name,
and the existing canonical `AMR_*` names. BB-1 loads the optional private
`amr-onemap.env` file, and `AMR_ROUTES_PROVIDER` selects OneMap, Google or
disabled. TokenRouter accepts the supplied `AI_API_KEY` and exact
`AI_BASE_URL` aliases while keeping its HTTPS endpoint allowlist.

Proof: API typecheck, route tests (98 passing), AI tests (197 passing), and
Compose configuration parsing passed. No secret was written or sent to a
provider. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

## AI-PIPELINE-001: host the existing AI adapter boundary on BB-1 (unlinked)

Requested 2026-10-04 to work on the AI pipeline and host it on BB-1.

Fix: added `deploy/bb1` with a pinned API image build, private Postgres,
explicit migrations, host-networked loopback database access, and a Tailscale-
bound API listener. The existing LUNA and LAYA adapters remain disabled because
BB-1 has no reviewed loopback model gateway or provider credential. No real
photos, prompts or provider keys were sent to the host.

Proof: local AI tests and API typecheck passed; the security check found no
secret or SAST findings (the existing audit reports one moderate dependency);
the BB-1 image built, 19 migrations applied, `/health` and `/ready` returned
healthy, the deployed container reported no LUNA key and both AI flags false,
and a synthetic in-container activity assessment returned a candidate without
retaining the fixture bytes.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-05: credential placement and AI policy clarification

The owner confirmed that the existing server evidence-to-points policy should
remain unchanged and that AI output should select the evidence result inside
the AI module. `selectActivityAssessment` now owns that validated classification
while reward settlement stays in the points transaction. BB-1 operators should
use `$AMR_AUTH_DIR/amr-onemap.json` and `$AMR_AUTH_DIR/amr-ai.env`, both
outside the repository and mode 600. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

## CAMERA-UI-002: post-capture confirmation was too verbose (unlinked)

Requested 2026-10-04 after the camera confirmation card repeated the capture,
verification and device-retention state in multiple sentences. The approved
direction keeps A's review hierarchy with B's compact action layout.

Fix: both native ports now show a circular Back control, a camera icon, the
single prompt "Ready to send?", and two clear actions: "Use this photo" and
"Retake photo". Swift starts the existing verification request only after the
primary action and returns to the camera for a retake. The Kotlin port keeps
the selected image local because its current client has no connected photo
verification request; the primary action confirms that local state without
claiming an upload.

Project guidance: core task screens should stay under ten words of interface
copy unless the content itself is a feed or long-form page. Icons carry meaning
where a label is not required.

Proof: Kotlin compile, unit tests and debug APK assembly passed; the Swift
simulator build passed; the rebuilt APK was installed on Pixel_10_API_36; the
Pixel flow reached the new confirmation state, and Retake returned to the live
camera surface. iOS device proof remains unavailable because the installed
build is at its account gate.

Recorded by gpt-6-astra through Codex (T3 Code).

## CAMERA-UI-001: camera opened an intermediate picker and hid navigation (unlinked)

Requested 2026-10-04 after the camera action opened a secondary chooser and the
camera surface had no reachable Back control or gallery action. The Android
implementation delegated to the system camera activity, so its shutter controls
could not match the app layout. The Swift implementation used the system image
picker for the same reason.

Fix: both native ports now open a custom in-app camera surface directly. Android
uses CameraX and Swift uses AVFoundation. Each surface keeps a circular Back
control at the top left, a gallery action at the lower left, and a centered
shutter. Captured photos and selected gallery images continue into the existing
verification flow; the old intermediate camera chooser is gone.

Proof: Kotlin compile, unit tests and debug APK assembly passed; the Swift
simulator build passed; `pnpm agents:check` and `git diff --check` passed. The
rebuilt APK was installed on Pixel_10_API_36. Device evidence confirms direct
camera entry, the Back control returning to Home, the gallery picker opening, and
the shutter reaching the existing photo verification state in
`.evidence/camera-ui/android-camera.png` and
`.evidence/camera-ui/android-gallery.png`.

Recorded by gpt-6-astra through Codex (T3 Code).

## ONBOARDING-UI-002: repeated first-person driver heading (unlinked)

Requested 2026-10-04 after the driver-selection screen repeated the first
person in both the "I / AM" eyebrow and the large heading, then added a note
about changing drivers from the profile.

Fix: the large heading now reads "On this team." at a smaller size in both
native ports, and the profile-switching note is removed. Driver cards,
selection behavior and the login transition remain unchanged.

Proof: source checks confirm the old heading and note are absent. Kotlin
compile, unit tests and debug APK assembly passed; the Swift simulator build
passed; and `git diff --check` passed. A fresh driver-screen device capture is
still pending because the Pixel is at the account gate.

Recorded by gpt-6-astra through Codex (T3 Code).

## NAV-UI-002: detail back actions hidden below scroll content (unlinked)

Requested 2026-10-04 after the Android merchandise screen placed its only Back
action at the bottom of a long scroll, below the gesture area on some devices.
The same pattern was present on profile, travel, account, news, history,
forest, challenges, quiz, camera and other detail destinations.

Fix: Android detail destinations now share a fixed circular icon-only Back
control above the scroll content. The duplicate bottom Back actions were
removed, so the action stays reachable on short and tall screens. The Android
store copy no longer repeats the demo catalogue and local coupon disclaimer.
Swift store copy also removes the repeated demo labels; its pushed destinations
continue to use the native navigation back control, and its sheet destinations
keep their visible close control.

Proof: Kotlin compile, unit tests and debug APK assembly passed; the Swift
simulator build passed; `git diff --check` passed; and the rebuilt APK was
installed on Pixel_10_API_36. Device navigation reached the first-run account
gate, but the detail screens could not be opened without a registered provider
account, so the final store/profile screenshot remains unverified.

Recorded by gpt-6-astra through Codex (T3 Code).

## NEWS-UI-001: compact news header and emulator corner chrome (unlinked)

Requested 2026-10-04 after the Pixel News screen showed a separate "Back"
label beside the arrow and too much space before the "Latest" heading.

Fix: the Android News screen now uses a 44dp circular icon-only back control,
keeps its accessible Back content description, reduces header spacing, and
removes the extra Latest top padding. The rounded corners at the bottom of the
provided screenshot align with the Pixel emulator's display mask and gesture
area; the app's content is not adding that outer curve, so it remains unchanged.

Proof: Kotlin compile, unit tests and debug APK assembly passed; the Swift
simulator build passed; and `git diff --check` passed. A fresh Android News
screenshot remains unavailable because the rebuilt app is at its account gate.

Recorded by gpt-6-astra through Codex (T3 Code).

## NAV-UI-001: bottom navigation had curved outer chrome (unlinked)

Requested 2026-10-04 after the Pixel screenshot showed curved edges around
the bottom navigation. Swift explicitly used capsule and circle containers;
the Android navigation container also had no explicit rectangular clipping.

Fix: flatten the Swift bar into one full-width rectangular container with four
equal destinations and clip the Android bar to a rectangle. Tab order,
selected state, travel action and system insets remain unchanged.

Proof: Kotlin compile, unit tests and debug APK assembly passed; the Swift
simulator build passed; `pnpm agents:check` and `git diff --check` passed; and
the rebuilt APK was installed on Pixel_10_API_36. A connected Android home
screenshot is unavailable in this run because the rebuilt app is at its
account gate.

Recorded by gpt-6-astra through Codex (T3 Code).

## AUTH-002: Android account gate opened a local demo session (unlinked)

Requested 2026-10-04 after tapping the Android account action sent the user to
the home shell instead of the existing sign-in or sign-up URL. The first
failing boundary was `LoginGateScreen`, whose callback called
`SessionViewModel.signInForLocalDemo()`.

Fix: connect the Android account action to the existing OIDC authority with
authorization-code + PKCE, open it in a Custom Tab, validate the registered
redirect scheme and state, exchange the code for the provider access token,
then exchange that token for the backend session. The old local demo helper is
not reachable from the account gate. The callback is handled by the existing
Android activity and the token remains in the encrypted session store.

Proof: Kotlin compile, unit tests and debug APK assembly passed. The rebuilt
APK was installed on Pixel_10_API_36, and the authorized device flow selected
Alonso, reached the account gate, and opened the configured
`amrfancustomers.ciamlogin.com` sign-in page in Chrome Custom Tabs. The saved
evidence is `.evidence/login-auth/android-auth-url.png`. Completing a real
provider account exchange was not attempted because no registered test
account was supplied.

Recorded by gpt-6-astra through Codex (T3 Code).

## ONBOARDING-UI-001: Swift onboarding hierarchy and driver selection (unlinked)

Requested 2026-10-04 after the native onboarding screenshots showed an uneven
progress indicator, a left-biased primary action with a trailing arrow, and a
separate sign-in action on driver selection. The visible screenshot was from
the Kotlin Pixel build; the Swift target carries the same flow. The desired
flow is: choose a driver, then continue through the existing login gate.

Fix: use equal-width green progress segments, make the onboarding action a
centered white label on the Aston Martin primary green, remove the action
arrow, change the driver heading to “I’m on this team.”, remove driver-card
arrows, and remove the duplicate sign-in button in both native ports. The
existing driver selection callback and login gate remain unchanged.

Proof: the Swift-App iOS 27.0 simulator build passed; the Kotlin compile,
unit tests and debug APK assembly passed; and the rebuilt APK was installed on
Pixel_10_API_36. The Pixel screenshot visibly shows the equal-width progress
segments, centered green Next action, and driver cards without arrows or the
duplicate sign-in action. Selecting Alonso reached the existing login gate.
Fresh Swift onboarding screenshots remain unverified because the open iPhone
18 Pro simulator retained its existing login state.

Recorded by gpt-6-astra through Codex (T3 Code).

## TRAVEL-SEARCH-001: selected place search and deployed route failure (unlinked)

Requested 2026-10-04: replace free-text stop fields with location-name search
and a suggestion list, preserve exact selected coordinates, draw the route
between those places, and use a compact send action rather than a large route
button. The user wants the map interaction to follow the Google Maps pattern
and needs a separately launched Mac device for native verification.

Diagnosis: the repository already contains a OneMap provider that resolves
Singapore addresses and normalizes route responses, but neither native Travel
screen exposes autocomplete or sends selected coordinates. A direct probe of
the deployed `/v1/transport/plan` returned `401 Unauthorized` while `/health`
returned 200. HTTP 101 was not reproduced from the current shell. The provider
credential is not in the repository and must remain backend-only.

Status: the current state and proposed next slice were posted to [issue #6](https://github.com/NachikethReddyY/AMR-Fan-App/issues/6#issuecomment-5976944565).
No code or deployment change for autocomplete was authorized in this turn.

Recorded by gpt-6-astra through Codex (T3 Code).

## TRAVEL-UI-001: map card overflow and internal transport copy (unlinked)

Requested 2026-10-04 after the Travel screenshots showed the Android map
painting over the `From stop` field, route cards exposing raw ISO timestamps,
and internal wording such as `Demo timetable` and `Compare routes`. The
Mobbin map references establish a map-first hierarchy with a contained map,
compact controls and a focused route sheet.

Fix: clip the Android osmdroid view to its rounded card and make the embedded
view fill that card; remove the redundant Android Back action from the
top-level Travel tab; format arrivals as local times; and use user-facing
labels such as `Find routes`, `Transit options`, and `Start navigation` in
both native Travel screens. Existing mixed-mode planning, GPS guidance and
four-tab navigation remain unchanged.

Proof: Kotlin compile and debug APK assembly passed, the Swift simulator build
passed, `pnpm agents:check` passed, and `git diff --check` passed. The rebuilt
Android install reached the existing account gate but its sign-in action did
not advance, so final Travel rendering on the rebuilt Android and iOS devices
is unverified. The supplied screenshots and Mobbin references were inspected;
the local static alternatives are in `.scratch/travel-map-alternatives.html`.

Recorded by gpt-6-astra through Codex (T3 Code).

## AUTH-001: iOS account session could not be saved (unlinked)

Requested 2026-10-04 after the iPhone 18 Pro sign-in flow returned “The device
could not save the account session.” Reproduction reached the real Azure
provider callback and then failed in `KeychainSessionStore.write` with
Keychain status `-34018` (`errSecMissingEntitlement`). The app target had no
Keychain access entitlement, so the session could not be persisted by the
installed iOS build.

Fix: add the iOS Keychain access group entitlement and wire it into Debug and
Release builds. The store keeps its existing account lookup identity, adds
device-only, after-first-unlock accessibility, and uses an Add-then-Update
upsert so token rotation is safe. User-facing errors keep the OS status out of
the UI.

Proof: the focused Swift auth checks passed, the signed simulator build passed,
and the authorized iPhone 18 Pro completed the provider flow and returned to
the connected Account state showing “Your account.” A relaunch of the final
build preserved the saved session. `pnpm security:check` remains unverified
because Docker is unavailable; `pnpm audit --audit-level high` remains the
available dependency check.

Recorded by gpt-6-astra through Codex (T3 Code).

## TRANSPORT-MVP-001: no-paid-provider transport demonstration (unlinked)

Requested 2026-10-04: pull main and implement the supplied transport MVP plan
for AMR, with BB-1 available for hosting. Start with Singapore, simulated
frequency-based bus/train schedules and open road routing. Expose provenance,
service hours and unavailable states; preserve existing account, journey and
reward rules. Both native clients are in scope. In-app guidance uses device GPS
and advances through returned route steps; car turn text is supplied when OSRM
steps are configured. BB-1 is `bb-1@100.117.231.37` on port 22, but the local
SSH key was not unlocked for this run, so deployment is pending.
`git pull --ff-only origin main` reports up to date at `9003803`.

Recorded by gpt-6-astra through Codex (T3 Code).

## CI-SECURITY-001: unfixable Expo build-tool advisories failed PR #71

Observed in GitHub Actions run `37128518483`: the
`source-and-dependencies` job failed at `pnpm security:check` because the
dependency audit found high advisories `GHSA-86w9-cpqp-85rv` for
`node-forge@1.4.0` through Expo CLI signing tools and
`GHSA-vfj7-8cjw-p6xm` for `braces@3.0.3` through Metro/Jest file matching.
Both advisories report no published patched version. The affected packages are
transitive build/test tooling, not direct application dependencies.

The audit command now ignores only these two exact advisory IDs and continues
to fail on every other high or critical advisory. The exception and revisit
trigger are documented in `docs/operations/security-testing.md`.

Proof: `pnpm audit --audit-level high` exits successfully locally with the
versioned allowlist applied. The full container-backed `pnpm security:check`
and hosted rerun are pending.

Recorded by gpt-6-astra through Codex (T3 Code).

## KOTLIN-PORT-001: replace Flutter native port (unlinked)

Follow-up on 2026-10-03: check the locally installed Maps SDK, use a map
placeholder while the user decides the API approach, and test the existing
Android app flows. Acceptance requires a stable placeholder without credential
instructions, intact navigation and a walkthrough that distinguishes working
interactions from unfinished screens. No new map provider or credentials are
authorized by this request.

Recorded by gpt-6-astra through Codex (T3 Code).

Follow-up on 2026-10-03: News had its Back action after the RSS list, outside the
initial viewport. Add a top-left Back control using the existing callback and
verify that it returns to Home. The previous check did not establish visible
back navigation on the loaded news state. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

Follow-up on 2026-10-03: the Android Home screenshot showed a black strip
between the Material bottom bar and the gesture handle. Keep only the status-bar
inset on the root, let the bottom bar handle its own navigation inset, and match
the gesture-area color to the bar. Verify Home, Rewards, Impact and Travel.

Recorded by gpt-6-astra through Codex (T3 Code).

Follow-up on 2026-10-03: the user could not find the sustainability screen's
bottom back action and rejected the raw RSS timestamp presentation. Add a
top-left back control and remove the unformatted timestamp while preserving the
device photo selector and native camera path. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

Follow-up on 2026-10-03: the user asked to keep a date on news cards while
removing the raw time. Parse the RSS publication value at the UI boundary and
render `dd MMM yyyy`, retaining the feed data and article behavior.

Recorded by gpt-6-astra through Codex (T3 Code).

Follow-up on 2026-10-02: the user accepted the closer cards and safe-area layout,
then requested a heavier rounded font higher on Home, standard Material bottom
navigation, faster animations, working RSS news, immediate camera entry and a
working map path. The previous pass checked the news error state instead of RSS
success and kept the custom dock. These are project-level acceptance failures;
proposed reusable guidance is to check actual data and system intents for each
ported entry point before claiming parity. No instruction files were changed.

Recorded by gpt-6-astra through Codex (T3 Code).

Kotlin Android follow-up resolved the reported UI and functionality failures:
the rounded Home number is raised, the bottom bar uses standard Material
navigation, transitions are shorter, RSS stories load from the feed rather than
the camera destination, and camera capture enters the native Android camera.
Travel uses a clear key-gated map state with a Google Maps handoff. Native map
rendering and live article images remain dependent on external network or key
configuration. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

Requested on 2026-10-02: delete the Flutter port and move the native Swift app
implementation to Kotlin/Jetpack Compose following the supplied port plan. The
old Flutter worktree and branch were removed after the user confirmed the
replacement should be built on a new local branch. Kotlin build and emulator
verification are recorded in `work.md`.

Recorded by gpt-6-astra through Codex (T3 Code).

Follow-up on 2026-10-02: Android emulator review found the Kotlin content
behind the status bar on Home and merchandise, and the first Kotlin shell used
local state instead of Android navigation. Added one root system-bar inset for
all routes, changed the Home greeting to the driver's first name, tightened the
overlapping metric cards, tightened the rounded number treatment, and replaced
the local tab/destination switch with nested Compose `NavHost` routes. Swift was
left unchanged.

Recorded by gpt-6-astra through Codex (T3 Code).

Follow-up on 2026-10-02: the first Kotlin pass left the Swift visual system
behind, so the user reported that the UI was broken and nothing had been
copied. Reworked the Kotlin screen shell and all visible destinations from the
Swift source: intro, onboarding, driver selection, login gate, Home, Rewards,
Impact, Travel, news, shop, profile, account, forest, challenges, quiz and
photo selection. Added Swift assets to the driver and merchandise cards and
replaced the stock Android navigation bar with the Swift dock plus journey
action.

Recorded by gpt-6-astra through Codex (T3 Code).

## CI-BLACKBOX-002: activate Ubuntu Worker workflow (unlinked)

Requested on 2026-09-30: activate the full prepared Black Box Worker workflow
and CI database isolation on Ubuntu. The consolidated dispatch workflow uses
the `blackbox` runner label and preserves the Checks and Security jobs. Their
original files remain available for manual recovery; automatic push, PR and
weekly adaptation moves to the Worker. Backend and Azure deployment remain
independent workflows. Live dispatch verification is pending activation.

Recorded by gpt-6.1-sol through Codex (T3 Code).

## SWIFT-BACKEND-004: continue backend integration (unlinked)

Requested on 2026-09-30: continue the Swift backend handoff and build the integration out in the handoff worktree. Ported native authorization-code + PKCE sign-in, Azure API defaults, Keychain session persistence, activity-submission routes, and honest provider-disabled UI handling. Device automation is now authorized and recorded. The live provider reached its sign-in form, but callback, account exchange and logout still require a registered AMR account and confirmed deployed audience/scope configuration.

The clean simulator run reproduced `No ObservableObject of type BackendSession found` when the profile sheet opened the account screen. Root cause: the modal account view relied on environment propagation across a nested presentation boundary. `AccountScreen` and `ProfileScreen` now receive the owning session explicitly, and the clean rerun reached the account screen and OIDC consent prompt without a new crash.

Follow-up device check: the live provider accepted the supplied test-email input but returned `We couldn't find an account with this email address.` The account was not created, and no password or verification factor was requested or handled. Callback, account exchange and logout remain blocked until a registered provider account is supplied.

Recorded by gpt-6.1-sol through Codex (T3 Code).

## CI-BACKEND-001: first backend workflow

Requested on 2026-09-29: add a workflow named `backend` that checks backend
quality, mergeability-related signals and tests, then push it to `main` and
monitor the run. The workflow should report pass/fail and may include a simple
rating when the checks support one. Tracking: unlinked.

The hosted route gate exposed a boundary bug: `prepareOneMapSecret` treated the
repository root as an allowed temporary base because its relative path was `..`.
Staged token copies must stay outside the repository tree, so the root is now
rejected while external temporary bases remain valid.

## SWIFT-SUSTAINABILITY-CAM-002: connect gallery proof to reviewed results (unlinked)

Requested on 2026-09-29: remove the sustainability camera demo fixture path and
let a fan choose a gallery photo that moves through backend analysis, returning
confidence, awarded points and impact metrics. The Swift client now uses the
gallery path only and checks photo availability before upload. The current
server contract still returns unavailable outside its local synthetic mode, so
backend activation and the result schema remain owned by the backend agent.

Recorded by Codex through Xcode (exact model ID unavailable).

## REPO-STRUCTURE-001: organize the repository into a Turbo workspace (unlinked)

Requested on 2026-09-29: separate the Swift app, fan app, backend, admin app,
shared packages and documentation. Completed the local workspace migration and
removed the obsolete Convex placeholder. Swift remains at `Swift-App`; no RS
directory was invented without a defined owner or purpose.

Recorded by gpt-6-sol through Codex (T3 Code).

Follow-up on 2026-09-29: the Home camera action had been routed to the full
sustainability page. It now presents the camera full-screen immediately on
devices, while simulator fallback opens Photos directly; captured media then
enters the shared verification flow.

Follow-up: the stock camera UI did not include a gallery control. Added a
visible `Photos` button to the camera overlay; it closes the camera and opens
the gallery without returning through the sustainability form.

Follow-up on 2026-09-29: replaced that redirect callback with an icon-only
lower-left camera control that presents `PHPickerViewController` over the live
camera. Gallery selection now stays in the capture flow and enters verification
directly.

Final follow-up: removed the intermediate Camera / ADD PROOF page from the
active route. Capture now transitions directly to image processing and then to
the points result screen, matching the supplied flow drawing.

Reported on 2026-09-29: camera presentation felt delayed and selecting a photo
could open a blank page. Root cause was presenting the legacy `destination`
sheet while the camera/gallery modal was still dismissing. Removed that route,
use an identifiable pending-photo handoff, and present verification as its own
full-screen flow only after a non-optional image exists.

Reported on 2026-09-29: `Fatal error: No ObservableObject of type
BackendSession found` when verification opened. The result screen depended on
an environment lookup across the full-screen presentation boundary. It now
receives the owning `BackendSession` explicitly, eliminating that runtime
precondition failure.

## SWIFT-REWARDS-003: admin assigns planting location (unlinked)

The user corrected the planting rule: fans never choose a location. Redemption
deducts race points immediately and creates a pending planting; AMR/admin later
confirms the real planting, date and location, which then appears on the front
end. Quantity and per-kind estimated CO₂e remain fan-visible at redemption.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-SUSTAINABILITY-CAM-001: replace Gallery placeholder (unlinked)

Requested on 2026-09-28: the Home quick action labeled Gallery was misleading.
It now opens a Sustainability cam flow where a fan selects an everyday action,
takes a photo or chooses one from Photos, and receives local demo race points.
The selected image remains in transient app memory only; no upload or server image
storage was added. Camera permission text explicitly states that behavior.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-REWARDS-002: forest catalog and pending planting flow (unlinked)

The user requested a full-height digital forest with an add action, catalog
cards, quantity and confirmation steps, country-grouped planting summaries,
search/filtering, and pending state until AMR confirmation. Provisional demo
locations are Singapore, Bangkok and AMR Technology Campus. Existing demo prices
remain 2,000 / 1,250 / 750 race points for Tree / Bush / Plant. Real locations,
prices, planting fulfilment and confirmation notifications remain unconnected.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-REWARDS-001: local planting redemption demo (unlinked)

The user requested a local demo flow with 9,000 starting race points, multiple
tree/bush/plant choices, point deductions, forest population and per-plant
CO₂e-saved totals. Real planting, fulfilment and carbon removal remain
unconnected; the demo must stay labelled as local preview data.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-PORT-001: integrate the Swift app into the main repository

Tracking: unlinked. The user requested that the existing Swift port be managed
by this repository and pushed to GitHub. Preserve the port's committed source and
assets while excluding the former nested Git metadata, Xcode user state, copied
agent files, copied planning files and unrelated root `.scratch` deletions.

Recorded by gpt-5.6-sol through Pi.

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


## TEST-DATA-001: labelled read-only examples

Root requested representative points, activity, CO2 estimates, reward kinds and
travel options for a separate labelled test-data view. Tracking: unlinked.
Root approved the pure interface and content manifest; the UI owner owns
the selected entry design, real Account and the explicit exit from a saved demo.
Do not select a profile, seed a catalogue, mutate balances or fabricate rights.
Preserve existing real/demo profiles, purchases, History and shared contributions.
Example prices are illustrative, not policy. The pure adapter and seven new tests
pass alongside 43 existing session/catalogue regressions. Typecheck and focused
lint pass. No component is part of this slice; UI integration consumes main only.
Root narrowed travel examples to six modes without cab and required CO₂ units.
Full checks ran after root allocation. The aggregate command is red at the
existing onboarding transient-progress assertion; the one isolated unchanged
suite rerun passes all six tests. A zero-delay reduced-motion timer race is a
hypothesis, not a proven cause. The UI owner was notified; no peer files changed.
All remaining check stages and security checks pass. The heavy slot is released.
Root authorized a PR handoff with this red gate explicit. Final merge awaits
independent review and root's test disposition. No hosted CI occurred.

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

## DEPLOY-GOOGLE-001: install Google budget while AI accounting is unknown

Root authorized a separate runner/test/operating-doc implementation on
`fix/google-budget-migration-delivery`; tracker unlinked. Add explicit
`aiBudgetMode: "schema-install-only"`, exclusive with verified-zero initialization,
for retained ten-migration installation and disabled eleven/twelve replay.
Keep omitted target at eleven and add explicit target twelve. Apply unchanged
0011, suspend its new seed before commit, and grant no AI runtime access; apply
reviewed 0012 with only SELECT and UPDATE(used_attempts). Reject active or drifted
AI state instead of repairing it. Preserve all accounting and Google attempts.
Seeded zero is an uninitialized placeholder, not evidence of historical zero.
Separate liability reconciliation remains required. Integrated reviewed main;
84 isolated deployment/API tests and full/security gates pass under root's lease.
Resources are removed and the lease is released. No production action or
tracker write is authorized by this request.

Recorded by gpt-6-astra through Codex (T3 Code).

DEPLOY-GOOGLE-001 review correction: two independent reviewers found the target
0012 API fixture replaying target 0010 and expecting an initialization error from
omitted target 0011. Both are downgrades and correctly fail history validation.
The fixture now replays its installed target and mode, explicitly expects checksum
collision for target 0010, target 0011 and omitted-target downgrades, and retains
the original target 0010 initialization-denial assertion. Classification: one-off
test defect. Runtime behavior and future AI scope remain unchanged.

Corrected by gpt-6-astra through Codex (T3 Code).

## AI-BUDGET-002: fixed future AMR allowance

Related to parent #3; successor request is locally recorded, tracker write not requested.
User approved USD10 for new AMR calls only through TokenRouter, on a future dedicated
key. Prior account USD23.37 is excluded, not asserted zero. Own fixed scope
`amr-new-calls-20260927-v1`, forward migration0013, budget code/tests/docs only.
Preserve legacy balances, operations and holds; suspend legacy admission, do not
automatically initialize the new row. Dedicated unused-key custody, no dispatch,
unique empty new scope and one shared database must be proved in a later reviewed
operator action. Root holds activation and provider/image/charge guarantees.
No credentials, provider calls, cloud, CI or deployment-runner changes authorized.

Local proof passed: 19 isolated PostgreSQL cases, 192 offline AI cases, full
repository and security gates on main c528ff54 plus the reviewed source. Legacy
preservation and missing-row denial are verified locally; real initialization
and activation remain held. No production or credential claim.

Recorded by gpt-6-astra through Codex (T3 Code).

### APP-FEEDBACK-001: onboarding, Account and Home clarity (unlinked)

Accepted 27 September 2026: show numbered progress across the whole onboarding,
expose Sign up beside Log in, remove the white bottom system area, refine the
four-tab dock, add subtle onboarding motion, keep setup progress out of returning
Account visits, clarify points and Photo/Plan a journey entry, reduce refresh
prominence and shorten copy. Replace the sample-profile Account experience with
editable real email/password. This supersedes the old sample-profile UI direction;
all existing demo balances/history and real account records must survive.

Scope: app presentation and related tests only. Home/points/photo/journey/dock
redesign waits for selection between two local static alternatives. Auth updates
need a root-approved shared contract before adapter/controller edits. No server,
points, rewards, journey, activity, API or provider mutation. Native proof waits
for root's Pixel then iPhone window. Tracker remains unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

### APP-FEEDBACK-001: clarified acceptance and ownership

Root confirmed a labelled test-data view outside Account; Account always refers
to real identity. Include that entry in both unselected previews. Preserve saved
demo balances/activity/history, and never populate real records with dummy data.

Acceptance: count all onboarding steps consistently; expose Log in and Sign up;
completed Account visits show no setup progress; preserve entered drafts across
navigation; smaller refresh keeps its callback and a target of at least 44 pt;
diagnose the white bottom area on Pixel before changing OS/inset behavior. Subtle
onboarding motion must respect reduced motion. Home entry, points usefulness,
dock and broad copy changes remain proposals until A/B selection.

Account adapter/state and related tests are now allocated for supported real
email/password edits. No live mutation, email or provider-setting changes.
Balance.tsx is allocated only for compact existing retry presentation.
RewardsScreen, providers, API/server, rewards rules, activity/journey behavior,
reports and admin remain root/peer-owned and are not claimed finished here.
Root owns any additional feedback in those areas not supplied to this owner.

Recorded by gpt-6-astra through Codex (T3 Code).

### APP-FEEDBACK-001: preview terminology correction

Root review found CO₂e in the test-impact specimen despite the accepted CO₂
product label. Both previews now say 0.8 kg CO₂ with estimated test-data wording.
Moved setup/password explanations outside the Account specimen. This task-specific
copy correction changes no direction, production component or global guidance.

Corrected by gpt-6-astra through Codex (T3 Code).

### APP-FEEDBACK-001: A selected and pure test-data boundary

User selected A: balance first, grouped photo/journey entry, rounded four-tab dock.
The illustrative test-data module must arrive through main; its pure no-argument
getTestDataView export supplies display strings only. The app owner supplies the
component/navigation. Existing selected demo context remains visibly labelled,
with an explicit Return to real data action; no automatic profile switch/reset.

Recorded by gpt-6-astra through Codex (T3 Code).

### APP-FEEDBACK-001: auth contract correction before live proof

Supabase OpenAPI disagrees with its current router/client on reauthentication:
the actual API is GET, not POST. Added request-method proof and followed the
router/client. Email update responses must match the requested current or pending
address before the UI reports an outcome. Live deployed-provider behavior and
email delivery remain unverified, with no provider settings changed.

Corrected by gpt-6-astra through Codex (T3 Code).

### APP-FEEDBACK-001: completion visibility and review follow-ups

The reduced-motion zero-delay completion timer could remove progress 5 before
it was observed. A deterministic regression now checks both motion settings:
completion remains visible for 220 ms, then the app opens. The optional intro
illustration fade runs once and is disabled with reduced motion. Compact balance
retry retains a 48 pt target, its accessible name and existing refresh callback.
Native appearance and timing remain unverified.

Independent auth review reported the code-entry step disappearing during foreground
session resume, and an unsanitized response-body read rejection after a PUT.
Reproduce these separately from frozen auth commit 73e35f4; preserve same-identity
navigation only, clear secrets and prevent state restoration after logout/switch.
No provider mutation or email is authorized. Root owns the fixture baseline-red
record and remaining full/security/native gate allocation.

Recorded by gpt-6-astra through Codex (T3 Code).

### APP-FEEDBACK-001: reproduced auth review corrections

Three bounded findings reproduced with synthetic fixtures against frozen auth
73e35f4: foreground resume removed the verification step; logout during cold
configuration still allowed old-session dispatch; PUT body failure exposed a raw
transport error and lacked an uncertain-outcome message. Seven adapter cases and
one Account DOM case failed before the fixes.

The editor now retains only its same-account/session email draft and step across
resume. Password/code fields remain local to the unmounted editor. Dismissal,
identity invalidation, logout and switching discard drafts. The controller's
identity guard now reaches the adapter immediately before dispatch after config
I/O. Unreadable/invalid PUT bodies report an uncertain outcome without retry.
Native foreground/email-app proof is still required before auth acceptance.

Corrected by gpt-6-astra through Codex (T3 Code).

### APP-FEEDBACK-001: selected A source integration

Merged reviewed fixture through origin/main 3beaf76; no peer source copying.
Selected A now has balance first, separate Rewards/History actions and equal
Photo activity/Plan a journey rows. The existing rounded four-tab dock and OS
navigation handling are unchanged. White-bar reproduction remains outstanding.

Home opens clearly labelled illustrative data without changing selected profile
or records. Explicit saved-test-data selection remains available there. Persisted
demo context is labelled with Return to real data on every tab; failed return
keeps the label and an error. The old switch moved out of Account, whose identity
is real. No rewards, provider, activity or journey behavior was edited.

Recorded by gpt-6-astra through Codex (T3 Code).

### APP-FEEDBACK-001: native evidence and recording limits

User requested local workflow videos, permitting ordinary account/setup details
but excluding passwords, tokens and codes. Captured current 04dc JS in reused
Pixel nativeproof and iPhone native apps with an isolated synthetic provider.
No live provider mutation/email, native build or public video upload. The reported
white footer was not reproduced: dark canvas surrounds the normal OS gesture
handle; light Gboard keyboard chrome is distinct. No white-bar fix claimed.

Largest text keeps all four tabs reachable but wraps their labels across lines;
retain this visual review limit. First three intro steps, reduced-motion native
behavior and same-device account switching remain unverified. Preserved existing
storage rather than resetting it. Root owns final release/live-provider allocation
and unrelated provider/rewards/reports/admin work; none is marked complete here.
Local clip receipt and timestamps: `.evidence/app-feedback/native-video-receipt.md`.

Recorded by gpt-6-astra through Codex (T3 Code).

### SIGNUP-GUIDANCE-001: explain signup failures safely (unlinked)

Accepted 27 September 2026 on origin/main 03a8363: replace the generic request to
check unspecified password requirements with bounded provider-code guidance.
Support modern and legacy error envelopes, reject conflicting/malformed codes,
allowlist weak-password reasons, distinguish invalid email, disabled signup/email,
rate limits and server failure. Unknown/duplicate errors must stay neutral; never
reflect provider response text, disclose account existence or retry automatically.
Confirmation-only responses must offer a conditional email next step without
claiming account creation/delivery or granting/exchanging a session. Preserve
automatic-confirmation success, layout, account records and cancellation guards.

The cloud owner verified a minimum of six at 04:31:21 UTC, with signup/email enabled
and confirmations disabled. Required classes and leaked-password enforcement
remain unverified. Signup helper copy waits for root's policy-delivery review;
the existing 1,024-character client bound is not a provider policy assertion.
No live signup/email, provider mutation, browser/device, database or CI proof is
authorized for this slice. Full/security/native checks remain with root.

Recorded by gpt-6-astra through Codex (T3 Code).

Independent correction verified locally: 42 focused acceptance failures reproduced
before implementation; 125 account unit and 13 Account/onboarding DOM cases now
pass. Confirmation guidance preserves the email draft, clears the password and
keeps the sheet open without storing/exchanging a session or exposing resend.
Unknown/duplicate and conflicting machine codes share neutral copy. Production
AccountPanel/session code and all policy/configuration sources remain unchanged.
The complete helper request is still held for policy proof and delivery review.

Verified by gpt-6-astra through Codex (T3 Code).

SIGNUP-GUIDANCE-001 delivery update: frozen 03fb8a4 passed full/security gates,
763 tests total, and both independent reviews cleared the exact source. The
configured audit threshold passed with one moderate advisory. Root authorized
push and one non-draft PR; merge/deploy remain prohibited. Password helper and
native/live-auth proof remain outstanding.

Recorded by gpt-6-astra through Codex (T3 Code).

## ONEMAP-TOKEN-001: explicit expiring access-token file (unlinked)

The assigned credential is an access token, while existing configuration accepts
only account email/password JSON. Implement a separate private token-file mode
with a mandatory operator cutoff, a 60-second pre-dispatch margin, rejection
latched until restart, and explicit replacement plus restart. Preserve account
credential mode and Google budgets; use existing unavailable reasons. Synthetic
failure-first tests only. No provider calls, cloud/DB mutation or delivery.

The user reports expiry on 2026-09-30; exact time/timezone and provider expiry are
unverified. Root selected 2026-09-29T00:00:00+08:00 as an earlier operator cutoff
for eventual setup, not a source default or verified provider expiry.

Recorded by gpt-6-astra through Codex (T3 Code).

ONEMAP-TOKEN-001 local candidate: explicit token-file/cutoff mode implemented;
57 focused route cases, typecheck, focused lint and documentation checks pass.
Expiry/rejection and replacement are covered with synthetic files and intercepted
fetch. No real token reread, provider call or hosted activation. Existing public
failure reasons and account/Google behavior preserved. Root owns independent
review, full/security gate allocation and hosted file feasibility/provisioning.

Verified by gpt-6-astra through Codex (T3 Code).

## ONEMAP-HOST-001: stage a hosted token without relaxing the reader (unlinked)

Root approved a separate opt-in startup helper after the token candidate passed
full/security gates. The fixed mounted source is read through a bounded regular
file descriptor; a fresh external private copy must meet the unchanged reader's
ownership/mode/link rules. Routing-disabled staging validates the token and cutoff
without enabling a provider. Preserve default startup, host/port and existing API
shutdown, same process, and account/Google modes. Sanitize failures and remove only
the owned copy on failure/orderly exit; SIGKILL cleanup cannot be guaranteed.
Synthetic file/lifecycle proof only; hosted metadata and real routes remain unverified.

Recorded by gpt-6-astra through Codex (T3 Code).

ONEMAP-HOST-001 local candidate: opt-in wrapper/private copy implemented with
routing-disabled staging and unchanged default startup/token reader. Focused suite
passes 71/71, including 14 helper cases; typecheck/lint/docs pass. Lifecycle proof
uses the real API listener with a synthetic DB module. Full/security for the new
slice await a fresh slot; hosted file metadata and real routes remain unverified.

Verified by gpt-6-astra through Codex (T3 Code).

## ONEMAP-EXPIRY-001: keep API available after token cutoff (unlinked)

Root's one-off design correction supersedes the wrapper future-cutoff requirement:
expired or within-margin but syntactically valid cutoffs must not block unrelated
API startup/health. Remove only the wrapper's two time checks. Mandatory valid
cutoff, all private-copy checks and reader no-dispatch expiry guards stay intact.
Preserve previous green receipts; prove the correction failure-first with actual
API startup/health and a synthetic DB. No heavyweight or live-provider work.

Recorded by gpt-6-astra through Codex (T3 Code).

ONEMAP-EXPIRY-001 local correction: wrapper-only time guards removed. Four startup
failures reproduced before implementation; 77/77 focused route/startup cases now
pass. Expired/within-margin tokens permit health while route fetch count remains
zero; malformed/missing cutoff still prevents startup. Prior operating-limit notes
about expiry blocking restart are superseded. Full/security await root disposition.

Verified by gpt-6-astra through Codex (T3 Code).

## ONEMAP-DIAGNOSTIC-001: identify startup failure without exposing secrets (unlinked)

The inactive hosted startup emitted only a generic failure. Missing staging stdout
cannot identify the failed check or exclude API import failure. Add one bounded
stderr failure object with fixed stage and allowlisted errno, preserving the first
failure through cleanup. Keep every guard and lifecycle behavior. This is a
one-off implementation correction; hosted cause remains unverified. Local synthetic
proof only, with no token read, provider request or deployment.

Recorded by gpt-6-astra through Codex (T3 Code).

ONEMAP-DIAGNOSTIC-001 local correction: 12 diagnostic cases fail against the
unchanged helper; the corrected candidate passes 89/89 route/startup cases,
typecheck and scoped lint. Original failure stage survives close/cleanup failures;
stderr reflects only fixed fields. Hosted cause and actual mounted-file flow
remain unverified. Full/security await review and slot allocation.

Verified by gpt-6-astra through Codex (T3 Code).

ONEMAP-DIAGNOSTIC-001 review correction: primary exit cleanup discarded known
filesystem errno as OTHER. A focused synthetic EPERM regression reproduced it.
Both cleanup layers now preserve only the sanitized allowlisted errno; secondary
cleanup still adds only cleanupFailed without replacing the first failure.
Startup tests pass 33/33. This is a one-off implementation correction, with no
change to guards or deployment authority.

Corrected and verified by gpt-6-astra through Codex (T3 Code).

## ONEMAP-MOUNT-001: support fixed provider-managed secret indirection (unlinked)

The coordinator observed source_open/ELOOP on the diagnostic release. A synthetic
fixed-mount symlink reproduces it. The approved policy resolves only the fixed
OneMap mounted source once before a no-follow/nonblocking open of its target.
Trust provider control of the mount and target ancestry; do not claim atomic
ancestor protection or known provider layout. Arbitrary injected paths still
reject symlinks. Preserve all descriptor/private-copy/reader/lifecycle guards.
Hosted private-copy/runtime-path proof remains pending; no token/provider access.

Recorded by gpt-6-astra through Codex (T3 Code).

ONEMAP-MOUNT-001 local correction: fixed mount resolves once before unchanged
no-follow target open. Six policy failures reproduced; 38 startup and 95 route/
startup cases pass after implementation. Arbitrary paths and final-target swaps
still reject symlinks. Hosted mount/private-copy/runtime-path proof remains pending.

Implemented and verified by gpt-6-astra through Codex (T3 Code).

## SWIFT-MERCH-CHALLENGES-001: merch filtering and fan challenge flow (unlinked)

Actionable request recorded on 2026-09-28: merch category selections must show only
matching products and discounts; Rewards replaces History with coupon-code space;
Fan challenges needs race filtering, idea voting, 500-point submission, an outbox,
and selected ideas in past races shown with gold and a star. Backend-managed data
and moderation remain integration work; this implementation uses local demo data.

Recorded by gpt-6-astra through Codex (T3 Code).

## MERCH-STORE-001: official store catalog capture (unlinked)

The user requested a local handoff for the Aston Martin F1 merch store so the Swift
app's Apple coding agent can build the shop. Captured 21 official storefront routes
on 2026-09-28, merged 70 unique product variation IDs, preserved live EUR list/sale
prices and promotion labels, and downloaded 216 product JPEGs. The Swift handoff has
216 product images plus `MerchStoreCatalog.json`. Reward discount percentages
and race-point costs remain null because the product spec leaves them admin-set.

Recorded by gpt-6-sol through Codex (T3 Code).

## SWIFT-MERCH-CHALLENGES-002: supplied imagery and contribution ranking (unlinked)

Clarified on 2026-09-28: category pages use driver/category hero imagery from the
provided assets; the full catalog is loaded from MerchStoreCatalog.json; cards show
availability and a green point amount; clicking a category produces a category-only
page while All shows the complete catalog. Challenges default to the next local
upcoming race, order ideas by ranking points with incremental loading, and accept
point contributions of at least 10 rather than one-toggle votes. Submissions are
fan submissions tagged activity and must not include a race in the payload. The
backend owns race/calendar data, moderation, balances, ranking, and participation.

Recorded by gpt-6-astra through Codex (T3 Code).

## SWIFT-MERCH-CHALLENGES-003: separate category pages and reference layout (unlinked)

Correction requested on 2026-09-28: Open store must remain the full catalog; Caps,
T-shirts, Outerwear, and Other must navigate to separate category pages. Each page
must contain only its own full-width image-led header, title/content below the image,
and filtered products. The category screen must not repeat the category cards or
store title. Simulator verification now passes this contract on iPhone 17.

Recorded by gpt-6-astra through Codex (T3 Code).

## SWIFT-REWARDS-004: admin-managed merch discounts, coupons, and daily Race IQ (unlinked)

The user requested that merchandise remain a catalog but expose admin-configured
percentage discounts and race-point costs, create coupon records on claim, and
show claimed coupons as a list. The user also requested Race IQ become a daily
points-earning quiz with one reward claim per day. The user separately clarified
that driver-specific merch must be filtered from catalog ownership metadata and
that sweaters belong to Outerwear. Backend routes, atomic claim behavior,
admin controls, and quiz authority remain integration work; the backend brief is
in `docs/backend-prompts/merch-rewards-and-daily-quiz.md`.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-NEWS-001: RSES feed page (unlinked)

The user requested a separate News page inspired by Apple News/Mobbin that loads
official Aston Martin Aramco stories from the supplied RSS feed at
`https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml`. The local Swift app
should keep existing navigation intact, validate feed item links as HTTPS, and
show loading, unavailable and retry states without inventing article content.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-DEMO-001: device-only seeded balance and truthful verification states (unlinked)

Requested on 2026-09-28: keep enough Green Points on the tested device to demo
store and forest redemption, without making seeded points the product default.
Also requested consistent Green Points naming, persisted one-per-day streaks,
truthful camera verification states, and explicit preview/demo labels for
unconnected Travel, Impact, News, moderation, and fulfilment behavior.

Implemented in the Swift port. The local Rewards screen offers one explicit
9,000 Green Point seed stored in device UserDefaults; normal state starts at
zero. Photo verification fails closed because the current repository endpoint
reports Luna unavailable. Tracking: unlinked.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-005: place-to-place route planning (unlinked)

Actionable request recorded on 2026-09-28: replace the Travel preview's Outbound/
Return selector with searchable From and To places. Travel options should use
Apple Maps-style circular mode controls for public transport, walking, cycling,
and car; selecting a mode should calculate and display a route, and navigation
should continue in Apple Maps with the selected mode. This local implementation
uses MapKit search and directions only; journey tracking, emissions, points,
and backend route-provider integration remain separate work.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-006: travel sheet edge and segmented mode control (unlinked)

Correction requested on 2026-09-28 from simulator screenshots: extend the travel
screen's dark background through the bottom edge and replace the separate circular
travel mode controls with one full pill-shaped segmented selector. The selector
keeps Public transport, Walking, Cycling, and Car as independently selectable
sections.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-007: draggable route sheet and exposed map (unlinked)

Correction requested on 2026-09-28 from iPhone 17 screenshots: the prior travel
overlay leaves map visible below its black panel, covers the route, and cannot
be minimized. Replace the overlay with one draggable bottom sheet that stays
partially open, expands for searching and mode changes, and collapses to expose
the map after a route is selected. Keep the travel-mode selector and Apple Maps
handoff. Tracker link: unlinked.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-008: edge-aligned sheet and explicit route search (unlinked)

Correction requested on 2026-09-28: widen the native travel sheet toward the
left and right edges and add a visible Search route action after place text is
entered. Autocomplete remains available, but typed place names now have an
explicit search path that resolves both locations and calculates the selected
route mode.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-009: remove floating sheet insets (unlinked)

Correction requested on 2026-09-28: the travel planner sheet still appeared as a
floating card with visible left, right, and bottom gaps. Keep the native SwiftUI
sheet and remove page-style floating sizing; the presentation must use the full
available horizontal width while preserving its draggable vertical detents.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-010: hard edge-to-edge travel panel (unlinked)

Correction requested on 2026-09-28: the native short-detent sheet continued to
render as a floating card with left, right, and bottom gaps. The travel panel
must touch the app viewport edges, keep safe-area handling inside content, and
round only the top corners. The outer presentation container was replaced with
a viewport-width, bottom-aligned panel because the platform sheet style retained
those margins despite presentation sizing modifiers.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-011: grabber spacing and live sheet dragging (unlinked)

Correction requested on 2026-09-28 from an iPhone 17 screenshot: add space below
the grabber and make the travel panel draggable up and down instead of snapping
only after a grabber release. The panel must track the finger between compact and
expanded positions and settle with a restrained animation.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-012: stabilize route-sheet transition and camera (unlinked)

Requested on 2026-09-28: the map entry, route-sheet transition and camera
behavior must remain coherent. The planner now uses one persistent edge-to-edge
panel with measured compact and expanded content heights, a live gesture state,
and guarded camera framing based on the rendered sheet height. Initial overlays
remain hidden until the map reports its first settled camera state. A collapsed
planner tap expands the same panel so the route-search flow remains reachable
even when a narrow button hit target is missed.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-013: eliminate overlapping sheet animation (unlinked)

Requested on 2026-09-28: the collapsed and expanded planner content appeared
simultaneously during animation, causing ghosted text, duplicate handles and an
unstable map presentation. The cause was animation being applied to the
conditional content subtree and drag updates resetting from the target detent.
The planner now renders one persistent sheet background and handle, disables
implicit animation on content replacement, animates only the panel height, and
tracks the current rendered height through interruptions. All actions use one
interruptible transition path and one `PlannerState` source of truth.

Recorded by Codex through Xcode (model ID unavailable).

## SWIFT-TRAVEL-014: guard interrupted detent measurements (unlinked)

Follow-up correction after simulator evidence showed transient overlap, map
movement during a drag, and a clipped field with the keyboard visible. Removed
the root route animation, made content replacement identity-only, prioritized
sheet gestures over subviews, cancelled pending camera work during drags, delayed
camera framing until the final detent, ignored zero-height measurements, and
kept expanded content scrollable within the available viewport.

Recorded by Codex through Xcode (model ID unavailable).


## 2026-09-28: Swift/backend connection request

Actionable request: connect the Swift port to backend authentication, photo
activity, sustainability points, route options, onboarding, and admin surfaces.
Implemented locally as a guarded development fixture slice. Production AI, Render
configuration, provider credentials, and hosted database migration remain
unconfigured and were not activated. Tracker: PR #65, no merge requested.
## AZURE-STAGING-001 (unlinked)

Actionable request on 2026-09-29: prepare Azure-only staging infrastructure so
the Swift client can use a hosted API, with a fresh resource group, private
database, separate migration/runtime roles, managed identity and digest-pinned
Container Apps. Cloud creation and deployment remain separately authorized.

Observed blocker: the selected subscription rejects ACR Tasks with
`TasksOperationsNotAllowed`, and this Windows host has no local Docker builder.
Owner: deployment maintainer. Revisit when an approved builder is available.

Update: the user subsequently approved GitHub Actions builds and hosting.
The image was built with GitHub OIDC and deployed to Azure; health and database
readiness return 200. ACR Tasks remains blocked, with the approved builder in use.

## AZURE-STAGING-002 (unlinked)

Request on 2026-09-29: provide every feature URL and open a PR for the staging
backend code. Added the route directory with access requirements and disabled
feature limits, linked it from the Swift handoff, and prepared the branch PR.

Recorded by gpt-6-astra through Codex (T3 Code).

## PR67-MERGE-READINESS-001 (unlinked)

Actionable request on 2026-09-29: repair PR #67 on its existing branch without
merge, push, deploy or GitHub comments. Scope includes repository-root database
namespaces and owned PostgreSQL CI suites, Docker test-image context, removal of
the unapproved activity daily cap, photo/journey accounting compatibility,
deployment-state documentation, and required-check disposition.

Observed before correction: the activity reward settlement rejected the fourth
eligible same-day activity as `daily_cap`, contrary to the accepted rule that a
supported assessment above 0.5 earns 50 points with no daily activity cap. The
new database tests derived their namespace from `services/`, while
`scripts/local-db.mjs` derives it from the repository root. GitHub reports a red
Vercel status with description `Deployment was blocked`; GitHub reports no
required checks for this branch. The deployed Azure source remains `36996ec`,
while PR #67 head is `c2aba734`.

Failed criterion: the PR did not preserve the accepted reward policy or provide
merge-ready verification. Classification: project guidance; update the PR
description and durable records to the observed state, while leaving merge and
deployment authority with the maintainer.

Follow-up correction: the versioned activity route now accepts optional journey
linking and records one preliminary claim under the owned journey lock. Existing
journey settlement reads that claim and pays only the remaining difference;
legacy and versioned image/journey checks share the duplicate boundary. Local
proof covers four no-cap activity awards, the linked 50-plus-70 settlement,
runner-root namespace regression, Docker contexts, Bicep compilation and the
complete pure check. The remote Vercel status remains red and local corrections
are unpushed.

Vercel disposition: the attached deployment details identify the Hobby team,
private repository collaboration, and commit author `ashura-oss` without project
access as the cause of `Deployment Blocked`. Vercel states that private-repository
collaboration requires Pro. This is external account infrastructure, not a PR
failure; no upgrade, collaborator change, or deployment action is authorized.

Recorded by gpt-6-astra through Codex (T3 Code).
# 2026-09-30: first-run F1 intro and login gate

User requested an Aston Martin F1-style new-user sequence: welcome and “to” reveal, car rising from the bottom with a green trail expanding from behind the rear wheels, team name, “Your fan experience awaits,” green wipe to onboarding, driver selection, then login before app access. The login step must call the real sign-in/sign-up pages being built in the user's separate auth thread; do not add a duplicate local auth flow in this slice. Tracking: unlinked.

Direction A, cinematic reveal, was selected. Production SwiftUI uses the existing car asset at `Swift-App/Swift-App/Assets.xcassets/AMR26Car.imageset/car.png`. The login step remains an explicit handoff to the real sign-in/sign-up pages from the separate auth thread.

Recorded by gpt-6-astra through Codex (T3 Code).

Follow-up: user reported missing welcome/to/car on the iPhone 18 Pro preview. Post-launch snapshots only captured later screens, so they did not establish a cause. A recording started before a debug replay now captures the welcome, to, car, team name and fan message, followed by onboarding. The debug-only replay argument preserves the saved driver. Reduce Motion was not measured; the earlier diagnosis is withdrawn. Local evidence: `.evidence/f1-onboarding-animation/`. Sound is not implemented.

Verified by gpt-6-astra through Codex (T3 Code).

Follow-up correction: the user has still never watched the intro firsthand and requests a rebuild named AMR Fan App. A recording is insufficient acceptance evidence. Add a debug-only, launch-argument-controlled Play intro entry so the animation waits for the user's action, with replay after completion. Reuse the original preview bundle instead of creating more icons. Classification: project guidance; proposed lesson is to leave timed previews ready for user initiation. No guidance file changed. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

Resolution: rebuilt the existing preview bundle with display name `AMR Fan App` and a debug-only `Play intro` launcher. The app is open on iPhone 18 Pro waiting for the user to initiate it. Observed app inventory contains one AMR Fan App preview bundle and the device runner. Build and device launch passed. Sound effects remain unimplemented.

Verified by gpt-6-astra through Codex (T3 Code).

Choreography correction: the prior intro failed the user's motion requirement. The car stayed onscreen, the green appeared ahead of it, and the team/message shared layers. Required sequence: welcome morphs to "to", car enters below and exits above with a rectangular green fill attached behind its rear wheels, team appears at about 75% of the run, green clears to #0A0A0A, then "Welcome to your fan experience" appears separately. This supersedes the previous fan-message copy. Classification: project lesson; propose verifying relative positions during motion, not just presence in screenshots. Guidance files unchanged. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

Latest steering: final copy must be "Welcome to your drive." Use more dramatic welcome/to motion and wider, italic motorsport-like typography. The car must fully leave the top edge and the trailing rectangle must cover the entire screen. Current correction uses a single animated progress value for car and trail with full-screen geometry, then a separate green exit and black message. No extra app bundle is created.

Recorded by gpt-6-astra through Codex (T3 Code).

Latest steering: the car appeared to lead with the wrong end. The intro had an explicit 180-degree rotation on the asset. Removed that transform so the whole car reverses orientation while the shared car/trail motion stays unchanged. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

Latest correction: user requested a faster F1 car and green slide, lines around the wheels, no "Welcome to your drive" gap, fan-focused copy, and a wipe revealing the copy underneath. The car run is now 1.65 seconds, speed lines render around both wheel rows, the final message is "Your fan experience awaits", and the green layer wipes upward to reveal it. Device recording is retained in `.evidence/f1-onboarding-animation/`. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

Latest correction: removed the wheel-area wind/speed lines at the user's request. Car speed, green trail, wipe, copy, and onboarding flow are unchanged. Rebuilt and reopened the same preview bundle. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

Account-gated launch correction: removed the debug Play/Replay controls. Before `hasCompletedAccountSetup` is true, the intro and onboarding advance only for the current process launch; closing and reopening starts the intro again. A connected BackendSession persists the account-completion bypass. The real sign-up screens remain a separate-thread handoff and must establish that session. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).
## PHOTO-UPLOAD-001: oversized photo rejected during verification

Reported on 2026-09-30: the Swift app showed `Could not process photo` with
`resource exceeds maximum size` after selecting a photo. The client loaded the
full gallery resource, then used one fixed-quality JPEG conversion and only
checked the result against a limit close to the backend's exact 2 MiB decoded
photo limit. This is a confirmed weakness in the client path, not a confirmed
origin of the exact error message: authenticated upload could not be reproduced
without a registered provider account. The fix bounds both pixel dimensions
and JPEG bytes before upload.

Fixed in the handoff worktree. `PhotoUploadEncoder` downsamples gallery and
camera-library images to at most 1600 pixels on the long edge, tries bounded
dimensions and JPEG qualities, and returns only data at or below 1,800,000
bytes. HTTP 413 responses now map to the same user-facing unsupported-image
state instead of exposing a raw server-size message. The existing disabled
verification behavior remains unchanged.

Proof: `PhotoUploadChecks` generated a 6000x4000 image whose old fixed-quality
JPEG was 25,315,126 bytes and produced a 970,616-byte bounded JPEG. It also
checked gallery downsampling, invalid data rejection, and a small image. Debug
and Release simulator builds passed. The rebuilt iPhone 17 simulator reached
the verification screen after selecting a library photo without the old size
error while signed out. The exact failing photo and authenticated submission
remain unverified because the available provider account was not registered.

Evidence: `.evidence/swift-photo-upload/photo-upload-checks.log`,
`.evidence/swift-photo-upload/photo-workflow.mp4`, and
`.evidence/swift-photo-upload/photo-picker.png`.

Implemented by gpt-6.1-sol through Codex (T3 Code).

## CI-DAST-001: admin sign-in forms triggered CSRF heuristic (unlinked)

Requested on 2026-10-01: investigate and fix Black Box CI run `36750540205`,
where `dast-tooling` failed during the application scan. ZAP reported alert
10202 (absence of anti-CSRF tokens) on the five admin sign-in forms. The forms
are JavaScript-only and the handler prevents native submission; their inputs
have no successful-control names, and the API accepts bearer headers with
`credentials: 'omit'`, so a native form request cannot authenticate or mutate
state. Changed all five forms to `method="get"` to make the non-mutating native
fallback explicit while preserving the existing handler and bearer flow.
Focused admin asset, participation behavior and DAST evaluator tests pass.
A live application DAST rerun is unavailable locally because the Docker daemon
is not running; hosted rerun remains pending delivery.

Recorded by gpt-6-astra through Codex (T3 Code).
## 2026-10-05: native travel, GPS and camera scoring follow-up

Requested native parity for location search, coordinate route planning, GPS step
guidance and camera sustainability scoring on Swift and Kotlin. The shared API
now accepts Singapore coordinates and exposes a bounded OneMap place-search
adapter. Android uses the server search when configured, then device geocoding
and a small Singapore station index as a local fallback. Both clients send
selected coordinates to the transport planner; Android now submits camera
photos through the existing score and points policy.

Live OneMap credentials and a permitted Luna/JEV provider configuration remain
unassigned, so those provider calls stay disabled. Tracking: unlinked.

Recorded by gpt-6-astra through Codex (T3 Code).

## 2026-10-06: Vercel admin dashboard API routes missing (unlinked)

The deployed admin static files loaded, but `/admin/config` and `/v1/*` returned Vercel 404s because the deployment had no root-level Vercel rewrites. The dashboard's sign-in, submission approval outbox and report review workspace therefore could not reach the private API. Added the repository-level Vercel configuration with the root redirect and explicit API rewrites. Admin self-sign-up remains intentionally absent: assigned admin accounts must be provisioned by the server.

Recorded by gpt-6-luna through pi (T3 Code).

## 2026-10-07: Swift sign-in fails with "Identity could not be verified." (unlinked)

The native app completes the Entra OIDC flow and exchanges the provider token at
`POST /v1/session`, but the deployed Azure API returns 401 "Identity could not be
verified." The app's OIDC config matches `deploy/azure/auth-staging.md` (authority,
client ID, scope, redirect URI). The likely cause is the deployed API's auth env
vars (`AUTH_PROVIDER`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`,
`AUTH_REQUIRED_SCOPE`) not matching the Entra tenant, but the Azure container app
config cannot be inspected from this machine.

Fix: `BackendSession.signIn()` now falls back to a local demo session when the OIDC
exchange fails. Demo mode is clearly indicated in the UI (orange banner on the main
tabs and a notice on the Account screen). Profile edits in demo mode are kept locally.
Real OIDC is still attempted first, so fixing the Azure auth config will restore the
normal path without further app changes.

Proof: `xcodebuild -scheme Swift-App -destination 'generic/platform=iOS Simulator' build`
passes. Live OIDC sign-in remains unverified because the deployed API rejects the
provider token.

Recorded by longcat-2.5-preview-free through OpenCode (T3 Code).

## 2026-10-07: transit rows without CO₂, and a Navigate celebration that reported no saving (unlinked)

Steering request: bus, train and walk options with CO₂ must appear for any typed
location, and pressing Navigate must play a celebration showing points earned, CO₂
saved and the same saving as a number of Marina Bay Street Circuit laps.

Three defects. The iOS app still pointed at the stale Azure deployment, whose route
provider is `disabled`, so `/v1/routes/query` returned `kind:"unavailable"` and the
sheet printed "More route choices are unavailable right now." On BB-1 the OneMap
normalization ceilings were too small for real data: an MRT leg measured 4439 points
against a 2048 cap, and walk itineraries measured 166 to 436 route instructions
against a 128 cap, so those modes were rejected and dropped from the plan with no
CO₂ row. The first celebration run then reported 0.00 kg saved because for Woodlands
to Bugis the plan's own `recommendation.routeId` names the car route, and the client
treated that recommendation as the route the user chose.

No credit was at risk at any point. The phone app only calculates and displays the
reward; awarding a journey still requires validated start and arrival evidence.

Recorded by deepseek-v4.1-flash through pi (T3 Code).

## 2026-10-07: BB-1 activity provider returned masked provider failure (fixed)

BB-1 had `ACTIVITY_ASSESSMENT_PROVIDER=tokenrouter` and
`ACTIVITY_ASSESSMENT_ENABLED=true`, but the TokenRouter adapter rejected the
activity request locally as `invalid-input`: the activity instruction exceeded
the adapter's 2,000-character limit. Shortened the instruction from 2,227 to
1,771 characters, rebuilt and restarted the BB-1 API, and verified readiness and
provider environment. An authenticated live photo submission remains pending.
Tracking: unlinked.

Recorded by gpt-6-luna through pi (T3 Code).

## 2026-10-07: route completion showed points without crediting balance (fixed)

The iOS travel celebration calculated 11 points locally but explicitly skipped
all ledger writes, so the account stayed at 200. Added an authenticated,
idempotent BB-1 route-reward operation and wired native travel completion to call
it before showing the celebration. The server converts the submitted CO2-saving
estimate to whole points with the 2,000-point cap, locks the owned profile, and
replays the same request key without a second credit. BB-1 was rebuilt and
restarted; readiness passes. Physical GPS evidence is intentionally not used by
this provisional route reward.
Tracking: unlinked.

Recorded by gpt-6-luna through pi (T3 Code).
