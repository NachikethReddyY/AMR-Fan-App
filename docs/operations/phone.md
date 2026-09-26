# Fan phone integration

Related to #3, #4, #5, #6, #7, #11, #14, #15, #16, #19 and #20.
These are partial implementations. Native accessibility and provider evidence
remain required; this document does not close an issue.

Fans use the native iOS/Android app. Web is reserved for the separate admin
dashboard. The phone has no web account-storage adapter.

## Current behavior

The four destinations remain Home, Travel, Rewards and Impact. Account sessions
use the existing native SecureStore adapter and server-owned real/demo profiles.
Home and Rewards read current balance from the server. History retains numeric
server order and opaque string cursors, and clears when identity/profile changes.

Rewards still has exactly Redemption and History. Redemption reads the current
offer before confirmation, sends its version and a request ID, and accepts the
server's price/receipt. A changed offer requires another review and confirmation.
History also displays owned reward receipts and current submission status through
their separately paginated owner endpoints. No History entry is edited.

- Tree receipts retain the profile name at purchase and say demonstration.
- Content opens through the retained-content GET endpoint, including after the
  offer is disabled. Opening does not purchase again.
- Vouchers show the retained percentage and demonstration status. They do not
  claim a redeemable retailer code.
- One submission form supports an optional tag and explicit non-refundable
  500-point confirmation. Rejected submissions may be prepared as a new paid
  submission. Current moderation status is distinct from the original receipt.
  Voting and selection controls are not integrated here.

Pending paid intents are stored privately by feature and profile before sending.
After a lost response or restart, the phone retries the same request and payload
before allowing a new purchase/submission. Storage operations across remounted
screens serialize; an old result clears only its matching saved intent. Failed
recovery blocks new spending. A logout hides all private screen state; a pending
intent stays private for that same profile's later reconciliation. The server
rechecks current authorization for every retry. Client balance arithmetic does
not authorize a transaction.

Travel retains the reviewed PR24/26 route rows, recommendation summary and
selected/unavailable states. It now calls `/v1/routes/query` and displays server
estimates/recommendation, source and unavailable modes. Editing a query discards
its previous selection and any late response. Cab/EV are not inferred from a
conventional driving route. Start/capture remain unavailable until the separate
journey integration and native permission/evidence work are accepted.

Impact reads only `/v1/impact/official`. It displays literal approved values,
units, periods, meaning, method, source-page quote and review metadata. Synthetic
sources are labelled. Missing optional fields stay missing. No numeric totals
are calculated from those figures. Personal/community travel impact remains
unavailable in this phone candidate.

The official-record adapter normalizes explicit PostgreSQL approval timestamps
to ISO timestamps before native parsing. Invalid dates and timestamps without a
timezone fail validation. Literal figures and source evidence remain unchanged.
This corrects the native Hermes rejection of PostgreSQL's space-separated date
format. Related to #19, #20 and parent #3.

## Selected C presentation

The user selected C Balanced green for native Home and Travel. Home now uses a
full-width green balance panel, a compact labelled account action and functional
entries into the existing destinations. Travel gives the server recommendation
and duration a green summary, while preserving every route row, estimate,
source and selected/unavailable state. Shared secondary actions use the selected
neutral capsule treatment. Four tabs and their measured large-text labels remain.

Normal balance text is 60/68 pt. At accessibility sizes it uses a 24/32 pt base
with system scaling still active; the full observed five-digit value remains
readable on Pixel and iPhone. No balance value is calculated or abbreviated.
The native text-measurement correction remains at the leaf; controllers and
screen state are not remounted for font changes.

The selected map remains open. Installed Expo 57's compatible map version is
react-native-maps 1.27.2, currently absent. A proposed Apple Maps iOS / Google Maps
Android integration needs dependency/config ownership, confirmed app identities,
Android key restrictions and a native rebuild. Existing server comparisons return
bounded geometry; the phone adapter currently discards it. A separately scoped
adapter and map change must preserve geometry/source association and address
native basemap provider privacy. No map package or provider was introduced here.
Optional explicit location, verified race/calendar and news integration also
remain open. No sample news, countdown, map or nonfunctional controls were added.
See [selected design](../../DESIGN.md).

## Proof and limits

The phone tests cover durable retry/restart, stale confirmations, ownership,
late responses/401s, opaque page cursors and literal approved report parsing.
Run `pnpm exec jest src/features --runInBand`, then the required checks in
[verification](verification.md). The isolated HTTP proof is:

```sh
pnpm db:run-test -- node --test --test-concurrency=1 src/features/rewards/testing/phone-http-proof.ts
```

That command is restricted to the author's disposable test namespace. It uses
current assigned-admin services/API for synthetic setup and the real account,
rewards, submissions and History authorization/database paths. It closes its
listener and pool and revokes its sessions. It does not prove rendered UI.

Native static Android/iOS exports pass; they do not establish interaction,
Dynamic Type, screen-reader output or physical-device behavior. Prior Android
account/tab evidence carries only where lineage is unchanged. Bounded Pixel and
iPhone 17 Pro observations cover account isolation, History pagination, reward
receipts/content, paid submission and synthetic route comparison. Approved
figures render on both native platforms after the timestamp correction.
Small-iPhone largest Dynamic Type and actual VoiceOver remain mandatory and
unverified. Hosted Supabase email/password and Google/provider configuration remain external limits.

Metro and Babel use the accepted baseline configuration. Native SecureStore,
accessibility queries/subscriptions and four-tab navigation remain protected.
C changes only the owned presentation described above. The six prepared native dependencies include `expo-web-browser` for
the retained OIDC preparation; email/password uses direct Auth HTTP. That dependency does not create a fan web product.

Earlier synthetic browser experiments remain private historical evidence. They
do not establish native functionality, visual acceptance or accessibility.
The shared header and account/points text renew their native text measurement
when font scale changes. Screens and controllers remain mounted. On iPhone 17 Pro,
Large to largest accessibility text and back preserves the open name editor,
its unsaved draft, current profile and History. Header, body and action text
reflow without relaunch. Pixel normal/largest text and approved-figure refresh
also pass; Android's font-setting change recreates the Expo activity, so that
observation does not establish mounted-state preservation on Android.
Related to #4, #5, #19, #20 and parent #3. All partial issues remain open and this
candidate remains on mandatory native UI HOLD for the outstanding small-phone
and screen-reader proof. Hosted CI is paused by the user to save build minutes;
local proof does not imply hosted gates passed.

C was observed on Pixel Android 16 and iPhone 17 Pro iOS 26.5 through Expo Go
SDK57 with the local candidate JavaScript bundle and synthetic own-server data.
Normal and largest text, real/demo balance, retained content, approved figures,
History pagination and route selection were checked. iPhone live size changes
preserve an unsaved name draft, edited route query and selected route. This is
simulator/emulator development-client proof, not a standalone release build or
physical journey proof. No new paid transaction was required for this restyle.

Edited by gpt-6-astra through Codex (T3 Code).

## Native email/password checkpoint

The account panel uses the fixed project's public Supabase configuration from
`GET /admin/config`. Direct Auth requests implement email/password sign-up,
sign-in, refresh and `logout?scope=local`; no SDK or dependency was added. An
unavailable, foreign-project or secret-key configuration fails closed. The
accepted backend candidate must be integrated before production configuration
and verification are available in this phone branch.

A confirmation response creates no AMR session. After provider sign-in, the app
exchanges the access token at `POST /v1/session`; the server owns account identity,
roles and profiles. Native SecureStore keeps provider credentials beside the
opaque AMR session in one serialized record. Passwords are never persisted.
Foreground resume and explicit Refresh session first validate the existing AMR
session, then rotate expiring provider credentials. An AMR401 signs out; it does
not silently exchange a provider token to recreate revoked authority.

Logout attempts both AMR session revocation and Supabase local-session logout,
including when one fails. Local credentials clear generation-safely after the
attempts. Partial remote failure is visible; it does not claim server revocation
succeeded. A crash during the attempt leaves non-resumable revocation intent.
A delayed old completion cannot clear a replacement session. The seven-day AMR
session and provider token lifetimes are separate.

Development-only loopback Auth fixtures are explicitly labelled and rejected
outside development. They preserve fixed production-project configuration
validation and do not establish hosted signup, email delivery or SMTP readiness.
See the [native acceptance and video protocol](native-acceptance.md) for the
whole-feature gaps and recording requirements. No fan web adapter was added.

Edited by gpt-6-astra through Codex (T3 Code).
