# Local AI runtime and server adapters

This infrastructure supports #3, #7, #11 and #19. It does not implement their
account authorization, upload, database or UI flows. Report candidates remain
pending until an assigned admin reviews/corrects/approves them. These modules
cannot publish, grant access, award points, change balances or discard reports.

## Server interface

Create one `createAi` instance per backend process from `server/ai/index.ts`.
Pass only explicit server configuration; never spread `process.env` or place a
credential in `EXPO_PUBLIC_*`. Configuration errors return a fixed message.

- `extractReport({ permission, documentId, pages: [{page, text}] })` returns
  `review` with exact UTF-16 source spans, nullable literal fields, missing-field
  names and model/adapter versions, or `unavailable` with a bounded reason.
  `permission` is the trusted caller's attestation, not authorization evidence.
  The caller must establish upload permission and remote-transfer consent first.
  No PDF parser, OCR, upload storage or URL fetching is included.
- `explainRoute({ mode, durationMinutes, fastestMinutes, toleranceMinutes,
  estimatedKgCO2e, baselineKgCO2e, avoidedKgCO2e, factorVersion })` consumes the
  already-selected/calculated route. It sends no endpoints or location traces.
  Luna can order three immutable facts. Invalid/unavailable output uses the same
  deterministic facts. Invalid input produces a generic unavailable explanation.
- `adviseSubmission({ text, tag, moderation })` requests only missing annotations
  in one Laya call. Existing validated values skip their questions.
- `classifyReport({ text, category })` requests only a missing category. It never
  decides whether source sections should be retained. All outcomes require review.

Unknown keys are rejected, including location/approval fields. Literal source
spans prove provenance, not the complete semantics of a metric. Even validated
text can be misleading in context; manual review remains mandatory.

| Limit | Value |
| --- | --- |
| Luna endpoint/model | loopback CLIProxy `/v1/chat/completions`, exact `gpt-6-luna` |
| Report input | 8 distinct pages, 12,000 total characters, at most 24 candidates |
| Transport | 60,000 outgoing bytes, 65,536 incoming bytes, no redirects |
| Luna deadline/output | 15 seconds default, maximum 20 seconds; 2,500 completion tokens |
| Laya deadline | 3 seconds default, maximum 5 seconds |
| Calls | one per invocation, zero automatic retries, concurrency one per provider instance; busy rejects |
| Privacy | no prompts/credentials/source text logged; no model tools; `store:false` requested |

CLIProxy is a remote provider boundary despite its local address. `store:false`
is not a provider retention guarantee. Caller-level authorization and quotas
must exist before exposing this through a public application endpoint. Multiple
backend processes would need a shared quota decision before deployment.

`LUNA_API_KEY` is optional; absent credentials cause review/fallback without a
request. `LUNA_BASE_URL` defaults to `http://127.0.0.1:8317/v1`, `LAYA_BASE_URL` to
`http://127.0.0.1:55434`. Only literal loopback HTTP origins are accepted in this
local candidate. Cloud endpoints need separately reviewed configuration.

Laya advisory is **disabled** by default (`LAYA_ADVISORY_ENABLED=false`) because
all held-out task gates failed. `true` is an explicit evaluation/integration
switch, not quality approval. Do not enable automatic product calls until a new
scoped evaluation meets the documented gates. Report prefill also defaults off (`LUNA_REPORT_EXTRACTION_ENABLED=false`) after
the fresh semantic gate failed. An explicit `true` permits scoped revalidation
and later authorized review-candidate integration. This reversible setting does
not remove accepted report extraction. Its quality limits and review requirements
remain in [evaluation](evaluation.md).

## Reproducible native MPS service

Primary [Laya source](https://github.com/NandhaKishorM/laya/tree/4066d5d5fbf08b66c6757ddeedbd797bd7655bc0)
implements native MPS and the Jev-style `/v1/systemone` contract. PyPI version
0.3.20 lacked the revision/digest constructor arguments present in that source.
`requirements.lock` therefore pins the exact source archive SHA256 and runtime
dependencies. `models.json` pins each Hub commit and safetensors SHA256.

Acquire the host's model/port/cache lease before setup or load. The run used
`127.0.0.1:55434`, one model, two torch CPU threads and a 4 GiB sampled RSS ceiling.
A fresh capacity check must meet the lease before every load. The current script
requires at least 50% host memory free, checks every two seconds, and stops its
own process if capacity falls below that threshold. This is a maintainer safety
bound for this 32 GiB host, not a production SLO or OS-enforced memory partition.

```sh
scripts/local-ai/bootstrap.sh
~/.cache/amr/laya/venv/bin/python scripts/local-ai/download.py
~/.cache/amr/laya/venv/bin/python scripts/local-ai/runtime.py
```

The shared cache is `~/.cache/amr/laya`, including one Python 3.12 environment.
No model copies are made in worktrees. Downloads use public pinned artifacts
without implicit Hub authentication. Runtime uses the pinned cache offline.
The service obtains an exclusive file lock before loading and binds only
127.0.0.1:55434. No proxy changes or cloud provisioning are needed.

The default checkpoint is typed-decisions, selected on 18 app development cases,
not on advertised benchmarks. The small selection difference does not prove it
is generally better. Use `--model english|multilingual|typed-decisions` only for
an explicitly leased sequential evaluation, stopping the old process first.

```sh
curl --fail --silent http://127.0.0.1:55434/health
~/.cache/amr/laya/venv/bin/python scripts/local-ai/evaluate.py \
  --split selection --output .evidence/local-ai/new-selection.json
```

The adapter uses `/v1/systemone` with `state` and the exact questions in
`server/ai/questions.json`. This is a restricted subset of Jev, not complete Jev
compatibility: no arbitrary questions, batch routes, model switching, tools or
browser requests. The service checks 8 KiB body bytes, 1,600 state characters,
question equality and the selected tokenizer's actual remaining context budget.
Excess context is rejected, never silently truncated. Malformed input returns
400, excess bytes/context 413, browser Origin 403, busy 503 and deadline 504.
Responses retain the upstream `answers` and `usage` shape.

There is one inference executor and no work queue. HTTP timeout retains the busy
slot while the GPU call is still running; a 10-second hard watchdog exits only
this process if inference is stuck. RSS is sampled at 100 ms, so this does not
claim a hard no-overshoot guarantee. Health reports sampled current/peak RSS.
No unauthenticated network binding beyond loopback is allowed.

Stop with Ctrl-C in the owning terminal, or SIGTERM to the recorded own PID.
Confirm its exit and port closure, then release the leases. Keep the pinned
cache for the next owner. Do not use broad process kills. This run created no
private runtime config; if later needed, `~/.config/amr/laya/runtime.env` must be
mode 600. The service itself needs no provider credentials.

## Verification and later revalidation

```sh
node --test server/ai/*.test.ts
~/.cache/amr/laya/venv/bin/python -m unittest discover \
  -s scripts/local-ai -p '*_test.py'
```

`pnpm ai:evaluate -- <new-evidence-path> fresh` runs only the committed synthetic
Luna holdout, with `LUNA_API_KEY` injected from the existing secret source by the
operator. It refuses to overwrite evidence. Never copy the key into a command,
fixture, work record or model prompt. The default split is the original holdout;
use a new preregistered split for a changed model or prompt, not repeated tuning
against existing answers.

The local inference utility is not the admin/backend application. The existing
Docker application DAST target remains unimplemented; no scanner-fixture result
is claimed as AI or authorization proof. Real malformed-request and adapter
failure tests cover this slice. Authentication and report approval need their
later application tests and isolated DAST target.

Written by gpt-6-astra through Codex (T3 Code).
