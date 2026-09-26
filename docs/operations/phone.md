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
account/tab evidence carries only where lineage is unchanged. New rewards,
submissions, Travel, official Impact and balance/History need native observation.
Small-iPhone largest Dynamic Type and actual VoiceOver remain mandatory and
unverified. Live OIDC and Google/provider configuration remain external limits.

Metro and Babel use the accepted baseline configuration. Native SecureStore,
accessibility queries/subscriptions, typography and four-tab navigation remain
unchanged. The six prepared native dependencies include `expo-web-browser` for
native OIDC authentication; that dependency does not create a fan web product.

Earlier synthetic browser experiments remain private historical evidence. They
do not establish native functionality, visual acceptance or accessibility.
Device observation is pending an exclusive device allocation. All partial issues
remain open and this candidate remains on mandatory native UI HOLD.

Edited by gpt-6-astra through Codex (T3 Code).
