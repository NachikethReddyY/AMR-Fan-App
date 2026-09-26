# Fan submissions and voting

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Issue #11 implementation status

The registered server candidate implements atomic paid submission, current owner
status reads and assigned-admin approval/rejection. Real HTTP and process-restart
tests pass. The separate admin page has observed sign-in, approval/rejection,
denial, conflict/retry and escaped-content browser proof. Its initial session-lock
expiry check has controlled fresh/replay regression proof on the reviewed base.
Phone Rewards/History, native accessibility and actual demo-reset integration
remain required acceptance.
[Submission operations](../operations/submissions.md) records interfaces,
verification and limits. Voting and selection remain with issues #12 and #13;
their accepted rules below are unchanged. This candidate does not close #11.

## Issues #12/#13 registered candidate status

The registered participation module implements atomic contributions, one exact
shared ranking, assigned-admin session creation/closure and audited release or
demonstration fulfilment. All 20 serial PostgreSQL/registered HTTP/restart cases
and 18 unit/admin cases pass. Original #11 receipts and moderation remain unchanged;
callers use the separate live projection for operation-linked status and totals.
The separate admin page has actual browser proof for authority, ranking, original
snapshots, retained-key retries, release and demonstration fulfilment. The preview
host disconnected during the 320px check; narrow-width/200% zoom, full keyboard,
phone and reset acceptance remain unverified. Package/check/CI and API/static
registration are included; shared navigation is unchanged.
[Participation operations](../operations/participation.md) records interfaces,
proof and remaining acceptance. #12/#13 remain open pending independent review
and remaining product integration.

## Outcome

Fans submit questions or proposed driver/team activities and spend points to choose what is selected for a fan interaction.

## Accepted behavior

- Questions and proposed activities are one feature. Optional content tags may describe a submission. Tags share the same fee, moderation, ranking and selection places.
- Creating a submission costs 500 non-refundable points and enters admin moderation. A rejection or unanswered submission does not refund the fee.
- Approval is required before voting. Contributions cost at least 10 available points, may use the fan's available balance and add one ranking point per point spent. The submission fee adds nothing to ranking.
- An assigned admin closes the interaction session. Select up to three approved, unfinished submissions total with positive contributions, ranked by contributed points and then earlier approval. Exclude zero-vote submissions; fewer than three eligible submissions means fewer selections.
- Unselected submissions keep their contributions and History in the backlog for later sessions, without refunds.
- Selection freezes contributions and further selection. The admin can mark a question answered or an activity performed, or release an unfinished selection back to the backlog with contributions retained. Fulfilled submissions stay out of future selection. Selection does not guarantee fulfilment.
- A rejected submission can be submitted again only as a new paid submission. Show its new 500-point charge before confirmation and retain the original rejection and fee.
- Demo and real profiles share this one ranking. Their balances remain separate and demo reset preserves shared contributions and selections.
- Show moderation, selection and fulfilment status in History. Use the atomic debit, retry and price-confirmation protections in [points and History](05-points-and-history.md).

## Depends on

[Accounts](01-accounts-and-demo.md), [points and History](05-points-and-history.md), and assigned-admin moderation controls. Deliver submission/moderation before paid voting and selection.

## Before implementation

Choose the submission form and optional tag presentation within the accepted design. These are content labels, not new product types or category tabs. Driver/team fulfilment remains labelled demonstration until arranged.

## Acceptance cases

| Scenario                                                                                                       | Expected observation                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fan with 600 points submits a driver question through Rewards                                                  | Deduct 500 once, leave 100, enter admin moderation and show History; ranking starts at zero and an answer is not guaranteed.                      |
| Fan spends 10 points to vote on an approved driver question                                                    | Deduct 10 and increase that question's ranking by 10 together, once.                                                                              |
| Fan tries to vote with fewer than 10 points or on an unapproved/selected submission                            | Reject without a debit or ranking change.                                                                                                         |
| A paid question vote is retried, or would exceed the available balance                                         | Return the recorded outcome on replay; reject an unaffordable new vote without a debit or ranking change.                                         |
| Admin closes a session with eligible questions and proposed activities                                         | Select up to three total from one ranking by contributed points, with earlier approval breaking ties; content labels do not reserve extra places. |
| Optional tags are added to otherwise identical submissions                                                     | Their fee, voting weight, eligibility and selection remain the same.                                                                              |
| A driver question is rejected, unselected or selected but not yet answered                                     | Apply the shared no-refund, backlog, paid-resubmission and contribution-freezing rules for its state; preserve its History.                       |
| Submitted driver question is rejected or remains unanswered                                                    | Keep the fee deducted and show the corresponding status.                                                                                          |
| Admin closes a session with two approved unfinished positive-contribution challenges and a zero-vote challenge | Select the two qualifying challenges; exclude the zero-vote challenge.                                                                            |
| Two qualifying challenges tie on contributed points                                                            | Rank the earlier-approved challenge first.                                                                                                        |
| An approved challenge is not selected                                                                          | Preserve its contributions in the backlog for later sessions without refunds.                                                                     |
| Fan resubmits a rejected challenge with 600 points                                                             | Show the 500-point charge, then create a new submission with 100 points remaining after confirmation; retain the original rejection and fee.      |
| Fan attempts to contribute to a selected challenge                                                             | Reject without changing balance or challenge total.                                                                                               |
| A selected challenge is considered for another session                                                         | Exclude it until the admin resolves its current selection.                                                                                        |
| Admin marks a selected challenge performed                                                                     | Keep its history and exclude it from later selections.                                                                                            |
| Admin releases a selected unfinished challenge to the backlog                                                  | Restore contribution/selection eligibility and retain its contributed points and history.                                                         |
| A demo fan contributes to a challenge                                                                          | Deduct from that demo balance and increase the same shared ranking used by real accounts.                                                         |
