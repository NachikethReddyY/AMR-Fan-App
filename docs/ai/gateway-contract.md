# TokenRouter contract verification

Observed 26 September 2026 after PR45, on base `1dd0141`. This records provider
facts, not activation or model-quality approval. No inference, repeat `/v1/models`
probe, credential retrieval or account mutation ran in this task.
The earlier [integration handoff](integration.md) remains the owner-seam reference.

## Evidence scorecard

| Dimension | Status | Sample and method | Confidence and limit |
| --- | --- | --- | --- |
| Jev gateway request | Documented | One signed-in model detail and its Python/cURL examples | High for displayed route/model/fields; no conformance request |
| Jev response | Partial | Full Python example reads named Choice/probabilities, Noul and Score fields | Model/version echo, confidence and usage envelope absent |
| Current displayed rates | Observed | Both selected model detail panels | Account console display only; no effective-date guarantee or complete billing formula |
| AMR key restriction | Observed | One existing key row and its unchanged quota form | Finite USD quota and model allowlist; concurrency hard-stop and runtime key binding unverified |
| Luna image input | Unverified | Model detail plus official image guide | Detail says Text; guide covers other image models, not Luna observation |
| Failure/failover billing bounds | Unverified | Official FAQ, terms, management and concurrency docs | No maximum charge across internal attempts established |
| Live correctness/cost | Unevaluated | Zero inference calls | No working-AI or semantic-quality claim |

Sources were limited to official TokenRouter documentation and the authorized
signed-in console, plus the inherited handoff and current source. T3 preview was
signed out. The existing Helium session supplied read-only console access.
No account screenshots, key values, identities or unrelated usage records are
included in this document. Private account observations stay in local evidence.

## Confirmed gateway request and displayed prices

The signed-in [Models page](https://tokenrouter.com/console/pricing) documents
Jev's System-One destination as
`POST https://api.tokenrouter.com/api/alpha/decisions`. Its example sends bearer
authentication, JSON content type, `model: "typesafe/jev-1.13"`, string `state`,
and named `questions` with `type`, `instructions` and `criteria`. Examples include
Noul, Choice and Score. The full Python example, including its scrolled ending,
reads `response.json()["answers"]`, then the named answer's `choice`,
`probabilities`, `noul` or `score`. It supplies no confidence/model/usage example
or configurable output maximum. Luna's entire panel has only endpoints and
prices, with no request example or output-limit control. A bounded search of
official TokenRouter docs found no `max_completion_tokens` or `max_output_tokens`
reference. Absence from those inspected sources is not proof of non-support.

This establishes the gateway path independently of TypeSafe's upstream
`/v1/systemone`. It does not establish object-state/null-criteria passthrough,
the complete response envelope, version echo, input/output maxima or enforced
output controls. Existing `jev-decisions.ts` uses object state, null route
criteria and the upstream `jev-1.13.0` echo; changing only its URL is insufficient.
Keep its upstream-only label and the product transport's Jev block until a
verified response mapping exists. Unknown response fields do not prevent a
separately authorized diagnostic probe; such a probe returns unavailable for
product use and retains its full reservation when accounting is unknown.

`services/api/ai/tokenrouter-jev-request.ts` now prepares only the documented request
from an already validated route/activity decision. It serializes the bounded
state as JSON text and uses option IDs as descriptions for null route criteria.
It preserves existing instructions, observations, eligibility filtering and
metrics. Its `request-only` result has the exact URL, method, body and byte count;
it has no credential, dispatch function or response parser. It rejects bodies
over 60,000 bytes. This is an application byte bound, not a billable-token bound.
The original upstream request and parser remain unchanged. Three new synthetic
tests and 21 existing decision tests pass; provider conformance remains untested.

Luna's detail lists `POST /v1/chat/completions` and `POST /v1/responses`.
All amounts below are USD per million tokens, transcribed from the two detail
panels. The Luna overview card omits the higher tier.

| Model / displayed input tier | Input | Output | Cache read | Cache write |
| --- | ---: | ---: | ---: | ---: |
| `typesafe/jev-1.13` | 0.0420 | 0.0000 | Not displayed | Not displayed |
| `openai/gpt-6-luna`, at most 272K | 0.100 | 0.500 | 0.010 | 0.125 |
| `openai/gpt-6-luna`, above 272K | 0.200 | 0.750 | 0.020 | 0.250 |

These are evidence, not an enabled rate card. Cache writes cannot silently use
the lower ordinary input rate. The exact cache accounting, tier application,
image/reasoning units, rounding, fees and internal retry charges still need a
conservative bound. The existing cost interface can remain unchanged if a
verified upper rate and token total cover every billed category; that condition
is not established here.

## What the account and public controls establish

The AMR key's existing form has unlimited quota off, USD 10 available, and only
the two selected models allowed. The table shows USD 10 remaining out of 10.
The form was closed without saving. No secret was revealed or compared to local
configuration, so the provisioned server key's binding to this row is unverified.

The [management API reference](https://www.tokenrouter.com/docs/management-api-documentation/)
documents per-key remaining quota and a separate management credential. Wallet
reads can be cached for one minute. Usage records expose cache categories and
per-record costs rounded to six decimals; totals are rounded to four. Neither
display precision nor a wallet read proves reserved/in-flight liability. No
management key was searched for, created or used.

The [concurrency policy](https://www.tokenrouter.com/docs/rate-limits-concurrency/)
limits simultaneous requests by balance. The [terms, section 3.7](https://www.tokenrouter.com/docs/terms-of-use/)
explicitly discuss negative-balance risk. These do not promise an atomic hard
spend stop for in-flight requests. The [FAQ](https://www.tokenrouter.com/docs/faq/)
describes internal fallback, including compatible models, without a failure-charge
ceiling. Model allowlisting therefore does not alone prove exact-model failover.

The [image guide](https://www.tokenrouter.com/docs/how-to-use-image-models/)
documents image-conditioned generation for another model. It does not confirm
Luna base64 image observation, `detail` handling or billable image limits.

## Two pre-dispatch assurances for a diagnostic Jev probe

Root's independent review accepts the documented endpoint and Choice/probability
fields as sufficient to prepare one synthetic text probe. Model echo, answer
type/confidence and usage field names are observations for that probe, not
pre-dispatch prerequisites. An unknown or rejected response must not become a
product result, and unknown usage retains the entire reservation.

The remaining provider assurances are:

1. An aggregate maximum USD charge for one request containing one Choice question
   and a JSON body of at most 60,000 bytes, including all internal attempts,
   failures, overhead and fees.
2. The requested `typesafe/jev-1.13` model is used, or the request fails without
   substituting another model. The observed two-model key allowlist and general
   fallback documentation do not establish this guarantee. No failover-disable
   control was shown in the inspected key form.

The displayed input rate gives the exact conditional calculation
`60,000 × USD 0.042 / 1,000,000 = USD 0.002520`, or 2,520,000 nano-USD,
**if** 60,000 tokens bounds all billed input for one attempt. The byte cap alone
does not prove that premise. For at most `A` billed attempts, each with at most
`H` extra billed tokens, plus aggregate other charges `F` in USD, the bound is
`A × (60,000 + H) × 0.000000042 + F`. No verified values for `A`, `H` or `F`
were supplied by the inspected documentation. This is not an enabled rate card
or an authorized reservation amount.

The official [contact page](https://www.tokenrouter.com/contact-us/) lists
`support@tokenrouter.com` for integration assistance. Following explicit user
authorization, one technical email was sent on 26 September 2026 asking for those
two assurances and, separately, Luna base64 JPEG/PNG support and enforced billable
input/output bounds. Gmail's sent confirmation, headers and body were verified.
No attachments, credentials, account IDs or private source were sent to support.
The private thread link remains in local evidence. No answer is claimed yet;
Luna image support does not block this text-only Jev probe.

The probe still needs the separately owned durable `AiCostStore`, explicit
`AI_COST_DATABASE_URL` with no `DATABASE_URL` fallback, reservation and a one-time
claim before dispatch. It must retain unknown charges, issue no client retry and
have root's explicit bounded allocation. No live call is authorized by this
document. Response parsing, task quality and product activation require later
verification. Photo HTTP, route integration, report grounding and moderation
quality remain their owners' separate acceptance work.

## Same-model alternative if gateway image support is absent

The [official Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna)
confirms image input for direct OpenAI `gpt-6-luna`. Its
[vision guide](https://developers.openai.com/api/docs/guides/images-vision)
documents inline base64 inputs; the
[token-counting guide](https://developers.openai.com/api/docs/guides/token-counting)
states that output limits include non-visible generated tokens. This is a
documented same-model provider alternative, not proof of TokenRouter passthrough.
Direct OpenAI needs explicit user approval, separately provisioned access and
verified billing/privacy controls within the same shared USD 10 budget. No
provider switch, credential search or model substitution has been made.

Until a supported observation path is approved and bounded, photo assessment
must remain unavailable with no award. Descriptions alone cannot replace photo
observations. TokenRouter's Text label alone does not establish that Luna image
input is unsupported; confirmation remains the smallest next step.

Recorded by gpt-6-astra through Codex (T3 Code).
