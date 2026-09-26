# TokenRouter integration handoff

This is an offline server preparation for parent #3 and the route, activity,
report and submission owners. It contains no activated gateway caller, shared
budget database, photo endpoint or APK integration. Historical quality gates and
disabled defaults in [runtime](runtime.md) remain in force.

## Contract evidence, 26 September 2026

| Dimension | Observed status | Evidence and limit |
| --- | --- | --- |
| Exact model availability | Both IDs present | Two earlier, separately authorized bounded catalog reads. Metadata only; inference availability untested. |
| Gateway Jev family | `system-one`, tag `Text` | Corrected catalog sanitizer. Exact HTTP path, envelope and version echo not supplied. |
| Gateway Luna family | `openai`, `openai-response`, tag `Text` | Corrected catalog sanitizer. No image capability assertion. |
| Gateway price, token bounds, budget | Unverified | Neither selected catalog record contained these fields. No guessed account endpoint or paid probe. |
| Upstream typed format | Documented | TypeSafe API reference; does not establish TokenRouter passthrough. |
| Live task quality | Unevaluated | All new responses are synthetic. Historical local evaluations remain separate and immutable. |

The catalog envelope had `object`, `success`, `data`. Both selected records had
`id`, `object`, `created`, `owned_by`, `supported_endpoint_types`, `tags` only.
No credential, raw response or unrelated model record is included here. The
corrected metadata request was explicitly authorized, not an automatic retry.

[TokenRouter's setup](https://www.tokenrouter.com/docs/openclaw-setup/) documents
`https://api.tokenrouter.com/v1` and OpenAI-compatible chat. Its
[feature guide](https://www.tokenrouter.com/docs/tokenrouter-feature-guide/)
describes balances, quota plans and upstream failover without a precise shared
hard-stop contract. An indexed [Luna model page](https://www.tokenrouter.com/models/openai/gpt-6-luna/)
lists `/v1/chat/completions`, `/v1/responses`, and $0.10/$0.50 per million
input/output tokens, but direct retrieval still returns 404. This is not a
current account-specific rate pin or proof of image support.

[TypeSafe's API](https://docs.typesafe.ai/api) documents upstream
`POST https://api.typesafe.ai/v1/systemone`: `model`, `state`, named typed
`questions`, then matching `answers` and token `usage`. Choice returns an option,
complete probability distribution and confidence. Noul lacks Choice confidence.
The [model page](https://docs.typesafe.ai/models) pins upstream `jev-1.13.0`, text
only, 64k total context and 32k state plus longest question. Its $0.042 per million
input tokens and free output are upstream rates, not verified gateway rates.
No Jev output-token ceiling request field is documented there.

[OpenAI's Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna)
supports upstream image input, 1,050,000 context tokens and 128,000 output tokens.
Standard short-context upstream rates are $0.10 input/$0.50 output per million;
other tiers can differ. The [image guide](https://developers.openai.com/api/docs/guides/images-vision)
documents base64 data URLs using chat `image_url` content parts or Responses
`input_image`. Neither upstream documentation proves gateway image passthrough,
its billed image-token maximum or provider retention. The existing 2 MB app media
bound is unchanged; the text transport is not a photo uploader.

## Smallest offline mapping

`server/ai/jev-decisions.ts` exports `prepareJevRouteChoice(snapshot)` and
`prepareJevActivityChoice({observations})`. Each returns a bounded request plus
`read(unknown)` for the documented **upstream** `jev-1.13.0` format, labelled
`protocol: "typesafe-upstream-only"`. No URL, fetch, key or automatic gateway model
alias exists. Do not send these requests to TokenRouter until its mapping is
verified and separately reviewed. In particular, `typesafe/jev-1.13` remains
disabled in `createTokenRouter`.

Route preparation shares `prepareRoutePreference` with the existing normalized
validator. It excludes over-limit options before model state is formed and keeps
a private snapshot for response validation. One Choice compares eligible IDs
using code-supplied time, emissions and points. The complete distribution orders
relative preferences; exact ties use duration then ID. This is an offline mapping
proposal for the accepted relative recommendation, not a calibrated utility
score or a policy change in `server/routes/query.ts`. Confidence does not sort.
No numeric weights, recalculated metrics or generated geometry are accepted.
The [confidence reference](https://docs.typesafe.ai/confidence) describes
concentration, not probability of correctness. [Jev's limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
require code arithmetic and warn about adversarial state. Synthetic parser tests
cannot show prompt-injection resistance or recommendation quality.

Activity preparation consumes only the already bounded Luna observations. One
Choice distinguishes supported bus, supported other, not supported and uncertain.
`createActivityAssessment` still requires supported AND confidence strictly above
0.5, then a transactional eligibility recheck. No Noul probability is relabelled
as confidence. Non-bus award rules remain outside this module. Request/response
fixtures and the two-stage synthetic composition are in `jev-decisions.test.ts`.

## Durable USD admission seam

`server/ai/cost-reservation.ts` has no default rates or store. `quoteAiCost` parses
an explicit versioned, expiring rate card and a plan with one or two calls. It
uses integer nano-USD: one dollar is 1,000,000,000 units. Verified fractional
nano-USD rates must be rounded **up** by the config owner. Products use `bigint`
before conversion, and the fixed scope `amr-tokenrouter-dev-and-demo` is capped at
10,000,000,000 units. Test rates are artificial and are not activation config.

Each call names an exact allowed model, maximum billable input/output tokens and
an opaque stage ID. Input ceilings must include image tokens, instructions,
framing and every billed input category. Output ceilings must cover reasoning and
any other billed output. Fixed fees, rounding, surcharges and gateway failover
must be included conservatively or admission must stay unavailable. Parsing a
rate card does not verify these facts.

The DB owner implements `AiCostStore`:

1. `reserve(reservation)` atomically checks the one shared budget across development
   and deployed callers. Count prior actual spend, uncertain spend and outstanding
   reservations before adding both activity stages. Serialize scope and operation
   ID; bind the request fingerprint and immutable rates. Duplicate IDs return
   `duplicate`, never another grant. Exhaustion or database failure means no call.
2. `claimCall({scope,operationId,fingerprint,callId})` atomically marks one stage
   started exactly once, rechecking cancellation and rate expiry. A restart or
   replay cannot dispatch a started stage. No provider I/O belongs inside a DB
   transaction. A reserved stage proven never dispatched may be cancelled by the
   store owner; a started stage must not expire into available budget.
3. `reconcile({...identity,accounting})` is idempotent. `accountAiUsage` gives a
   bounded reported charge or retains the full stage reservation for missing,
   invalid or over-bound usage. Over-bound usage must suspend new admission until
   the provider bound and actual charge are reconciled. A timeout, HTTP failure,
   client cancellation or lost response is not proof of zero billing. Do not
   release unknown usage based on elapsed time or product rejection.

`reserveAiCost` denies admission without a store, redacts store errors and returns
only the reservation result. It does not dispatch, claim stages, enforce a DB
lock or reconcile for the owner. The synthetic store tests prove argument and
failure handling, not multi-process durability or provider enforcement. A new
schema must prove cap concurrency, restart, replay, conflicting fingerprints,
partial two-stage completion and unknown-charge recovery with real transactions.
Do not use the fan points ledger for this USD budget.

## Exact product-owner seams

Inspected on main `1ea07e1b2d83ae148ed3e0817cd49cb1af395b38`:

- `server/routes/query.ts:createRouteQuery` owns authentication, provider search,
  factors and deterministic `recommendRoute`. Form an opaque snapshot after
  code metrics exist, reserve one Jev call, and consume only original IDs/metrics.
  Preserve unknown-metric fallback and recheck the active snapshot before display.
  No coordinates, geometry or account identifiers enter AI state. The inspected
  query does not expose a points estimate; the route/award owner must supply a
  verified preview or leave it null, which keeps AI preference unavailable.
- The activity API owner must authenticate, validate camera origin, decode bounded
  JPEG/PNG bytes and dimensions, strip metadata, establish transfer consent and
  check duplicates before reserving both stages. Claim before each dispatch. Never
  hold profile/points locks while waiting for Luna or Jev. Cleanup releases string
  references and overwrites the supplied buffer; this is not heap zeroization or
  provider deletion. No original image or description may be durably retained.
- `server/points/index.ts:runPointsOperation` is the transaction seam for a later
  activity service, not callable by the model. In `perform`, recheck current
  authority/profile and unique fingerprint/action/journey links, then persist the
  minimal decision, receipt/fingerprint and one code-selected ledger effect.
  Successful same-key replay returns the stored receipt before any new assessment
  or credit; a conflicting intent fails. No daily award cap is introduced.
- Eligible no-location photos and preliminary bus photos receive 50 in owner code.
  `server/awards/operation.ts:executeSettlement` already retains cumulative journey
  credit, but currently gates production credit. The award owner must link the
  preliminary payment to the same verified journey and pay only the remaining
  difference. Existing action/trip payment must prevent a second photo payment.
  No production gate is bypassed by these AI modules.
- `server/submissions/index.ts:createSubmission` keeps the same normal 500-point
  confirmed, affordable, non-refundable fee. Harmful paid content cannot enter
  voting and retains its reason/record; uncertainty stays pending admin review.
  No extra penalty, typing charge, provider-retry debit or automatic approval.

Activation requires the exact gateway SystemOne route/envelopes/model echo,
Luna image contract, current gateway rates and billable maxima, durable shared
admission and account hard-cap evidence including remaining/in-flight funds.
Only then may the manager grant a bounded synthetic conformance allocation.
The user-confirmed $10 ceiling is not authority to spend it now. No additional
catalog/account lookup or inference was performed during this resumption.

Prepared by gpt-6-astra through Codex (T3 Code).
