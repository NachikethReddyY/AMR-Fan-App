# AI evaluation, 25 September 2026

| Dimension | Score/status | Sample and method | Evidence and confidence |
| --- | --- | --- | --- |
| Laya optional tags | 9/12 (75%), fail | Exact held-out choice; gate 90% | 95% Wilson 46.8–91.1%; authored sample only |
| Laya moderation attention | 8/12 (66.7%), fail | Exact held-out choice; missed two explicit privacy-abuse requests | 95% Wilson 39.1–86.2%; cannot gate moderation |
| Laya missing report category | 8/12 (66.7%), fail | Exact held-out choice; gate 90% | 95% Wilson 39.1–86.2%; keep every source section |
| Luna v1 report exact strings | 6/12 (50%), fail | All fields/candidates match original expected JSON | Formatting differences included; not semantic accuracy |
| Luna v1 supported values | 10/10 returned metrics | Manual semantic inspection against committed synthetic source | One further expected metric was unavailable; descriptive, post-run analysis |
| Luna v1 separate units | 9/10 returned metrics | One `50%` value left its separate unit null | Missing unit is visible, no fabricated unit |
| Luna v1 periods/source spans | 10/10 each | Supported periods or null; exact UTF-16 source spans | Does not prove full metric semantics |
| Luna v1 meaning | 9/10 returned metrics | One Tamil metric phrase wrongly filled the meaning field | Real semantic defect; literal-cue schema correction follows |
| Luna v1 no-metric handling | 2/2 | Empty unsupported/instruction-only inputs remain empty | Tiny sample, not injection immunity |
| Luna v2 fresh semantic cases | 11/15 (73.3%), fail | Fresh preregistered literal alternatives, same 90% gate | 95% Wilson 48.0–89.1%; includes safe refusals as incomplete cases |
| Luna v2 fresh exact cases | 6/15 (40%) | Original strict exact-string method retained | Do not compare directly with v1: different cases |
| Luna route facts | 4/4 | Only permutations of three fixed calculated facts accepted | 95% Wilson 51.0–100%; no live routes/location data |
| Boundary verification | 25 Node tests, 4 Python tests pass at measurement | Local HTTP, schema, evidence, limits, busy/timeout/fallback and disabled gates | Scoped behavioral proof; later app authorization/storage unimplemented |

The outcome is a working infrastructure candidate with report prefill and Laya
advisory off by default. Required product extraction remains outstanding. Normal
admin review/correction must remain available. Neither flag changes approval
policy. An explicitly authorized later revalidation can enable the adapters;
there is no permanent hardcoded policy that removes the accepted feature.

## Evaluation protocol and sources

[Acceptance](acceptance.md) fixed the tasks, gates and split before inference.
Inputs are synthetic, nonpublic-at-evaluation fixtures, not real report uploads
or precise location traces. No search, retrieval, model tools or expected answers
were sent to either model. No hints were used during inference. The coding agent
read primary upstream code to build the runtime; that is distinct from the models'
closed-input evaluation. No field outputs from one model were passed through the
other. Laya questions are versioned once in `services/api/ai/questions.json`.

Selection used 18 authored development examples, six per Laya task. Held-out
quality used 36 different examples, twelve per task, without prompt or checkpoint
changes afterwards. Scores are counts of exact labels. Small confidence intervals
are not narrow enough for production or cross-model ranking claims.

| Development checkpoint | Tags | Moderation | Category | Overall |
| --- | --- | --- | --- | --- |
| English | 5/6 | 2/6 | 4/6 | 11/18 |
| Multilingual | 5/6 | 3/6 | 5/6 | 13/18 |
| Typed-decisions | 6/6 | 4/6 | 4/6 | 14/18 |

Typed-decisions was selected from these app examples. Its one-case margin over
multilingual is not reliable evidence of superiority. It subsequently failed
all three held-out task gates; it remains a pinned runtime for revalidation.
Native latency did not justify an MLX port, and no fine tuning was attempted.

| Laya held-out language | Correct/total | 95% Wilson interval |
| --- | --- | --- |
| English | 17/21 | 60.0–92.3% |
| Mandarin | 3/5 | 23.1–88.2% |
| Malay | 3/5 | 23.1–88.2% |
| Tamil | 2/5 | 11.8–76.9% |

Failures included an embedded instruction changing a question tag to activity,
negated harassment flagged as harmful, benign Mandarin safety content flagged,
Malay/Tamil privacy-abuse requests missed, and Mandarin emissions classified as
water. Confidence values did not establish correctness and were not used to
rescue labels or permit automation. Upstream also warned about one out-of-range
English calibration temperature; the package clamped it. No accuracy claim rests
on confidence calibration.

## Luna semantic diagnosis and the single bounded correction

Original report exact failures mixed benign name/period segmentation with real
problems. `Annual water use` versus `water use` is source-supported wording.
`50%` with a null separate unit loses a requested field. A Tamil quoted metric
phrase was not a target/result/annual/cumulative/estimate cue, despite having a
valid source span. One expected metric returned unavailable. The original runner
retained that status but not its reason; the exact cause is unverified, not claimed
to be source-span rejection. New runs record only the sanitized failure reason.

Version 2 narrows `meaning` to known literal cues in English, Mandarin, Malay and
Tamil. Each must still occur in the evidence quote. A regression first showed
that arbitrary quoted `water use` was accepted as meaning, then passed after the
schema fix. This is conservative vocabulary validation, not full semantic or
negation understanding. The report feature names no mandatory languages; English
source probes are primary, and each non-English report sample is exploratory.

The fresh 15-case holdout was defined before its one run, including permitted
name/period variants. No expected values or alternatives changed after inference.
It yielded 11/15 semantic cases (English 9/12, Mandarin 0/1, Malay 1/1, Tamil 1/1).
The sample is too small to claim language support. Two cases returned unavailable,
one omitted a candidate whose value was missing, and the Mandarin period included
an annual qualifier outside its predefined period alternatives. Nine returned
metrics had source-supported values and units; the original arbitrary Tamil
meaning failure was not repeated. Partial-field omissions still fail accepted
extraction behavior. No further prompt tuning was performed.

Both runs preserve their original exact scores. The fresh semantic score is
separate from the post-run v1 diagnosis; it is not a retroactive passing grade.
Report prefill defaults off until a new scoped, representative permitted-report
evaluation satisfies its gates and the full admin workflow is verified.

## Measured runtime and provider work

The host is Apple Silicon, 32 GiB, Python 3.12.14, PyTorch 2.14.0, Laya source
commit `4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`. An unrelated xcodebuild and
simulators/T3 were active. Ops approved a bounded run after fresh 59–60% free
memory observations. Latencies are observations under concurrent host load,
not isolated benchmark rankings. One checkpoint was loaded at a time.

| Runtime | Cached load | First measured request | Median requests | Max request | Peak sampled RSS |
| --- | --- | --- | --- | --- | --- |
| English development | 5.274 s | 2015.86 ms | 49.82 ms | 2015.86 ms | 2.944 GB |
| Multilingual development | 2.941 s | 668.67 ms | 24.95 ms | 668.67 ms | 2.760 GB |
| Typed development | 2.410 s | 161.06 ms | 48.51 ms | 161.06 ms | 2.912 GB |
| Typed held-out, already warm | same process | 88.91 ms | 48.28 ms | 167.97 ms | 2.912 GB |

RSS uses decimal GB in this table and a 100 ms process sampler. It is not a full
unified-GPU/driver memory account or an OS hard limit. The four Laya runs made 90
classification requests, with no HTTP failures. Each development run sent 8,906
body bytes and received 5,557/5,534/5,630 bytes respectively. Held-out sent 18,156
and received 11,256 bytes. No latency SLO or paid-cloud cost claim is made.

Luna v1 made 16 requests (12 reports, 4 routes), median 4,326 ms, maximum 10,974 ms;
one returned unavailable. Fresh v2 made 15 requests, median 2,872 ms, maximum
9,134 ms; two returned unavailable. These mixed workloads are not an improvement
comparison. Each invocation permits one request and zero retries. Provider token
and byte totals were not captured for these two runs and remain unmeasured. The
separate tiny connectivity check returned exact model `gpt-6-luna`, HTTP 200,
2.345 s and reported 312 tokens. No provider or proxy configuration changed.

## Evidence and remaining proof

Private raw evidence is under `.evidence/local-ai/`: `english-selection.json`,
`multilingual-selection.json`, `typed-selection.json`, `laya-held-out.json`,
`luna-held-out.json`, `luna-fresh-held-out.json`, and the focused test logs.
The repository keeps synthetic fixtures and this summary, not raw private logs.

The English, multilingual and typed process exits were observed, and port 55434
was confirmed closed/free before the next load and after final shutdown. Both
evaluation leases were released. A final single offline-cache startup/schema
smoke used a renewed lease and passed. Its final memory precheck observed
10.79 GB available and 60% free pressure. Own process termination/wait succeeded;
a naive bind check hit TCP TIME_WAIT, then targeted listener inspection and
connection refusal confirmed shutdown. That final smoke did not retain its PID
or health metrics because the bind exception interrupted evidence serialization;
no second model was started. The earlier evaluation measurements remain intact. The shared pinned cache remains for tomorrow; no
runtime credential/config file was created. No device or app-install session
was used. No cloud, account, balance or approval policy was changed.

Still pending: a representative authorized report and transfer decision, upload
formats/limits/storage, persistent statuses, assigned-admin review/approval,
end-to-end failure preservation of existing official records, feature UI proof,
and later extraction-quality validation. Tests prove these adapters have no
storage writer; they do not claim database preservation or complete product flow.

Written by gpt-6-astra through Codex (T3 Code).
