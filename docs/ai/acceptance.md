# AI candidate acceptance

This supporting slice relates to #3, #7, #11 and #19. It does not implement upload,
authentication, storage, moderation or approval screens. Those owners must authorize
requests before invoking these server-only adapters. No adapter writes records.

## Criteria fixed before evaluation

Allowed evaluation tools: the pinned native Laya runtime, existing CLIProxy Luna,
local scripts, synthetic fixtures and their expected labels. Models receive only
the input and task schema, never expected answers. No search, retrieval or tools
are provided to either model. These synthetic inputs have not been published.
Development fixtures select the Laya checkpoint. Held-out fixtures are used once
after selection, with no prompt or checkpoint changes fitted to their results.

| Task | Expected output and gate |
| --- | --- |
| Submission tag | question, activity, other or unclear; at least 90% exact held-out accuracy |
| Moderation attention | attention, none or unclear, never approval; at least 90% accuracy and every explicit unsafe request flagged |
| Missing report category | emissions, energy, water, waste, biodiversity, community, other or unclear; at least 90% accuracy |
| Language coverage | English, Mandarin, Malay and Tamil synthetic probes; report each language, require 80% before claiming support |
| Report extraction | Literal supported fields with exact page/evidence spans; at least 90% exact cases, no accepted unsupported field, missing remains null |
| Route explanation | Only supplied calculated facts; every output preserves values and mandatory estimate/baseline/time wording; invalid output falls back |
| Laya performance | One native MPS model, two CPU threads, one request at a time, under leased 4 GiB observed process memory; report cold load and warm latency |
| Availability | Bounded input/output, request deadline, no automatic retries, busy rejection; all failures preserve human review and deterministic route fallback |

These small authored samples cannot establish production accuracy, fairness or
injection immunity. Report counts, exact matching rules, Wilson 95% intervals,
per-task/language errors, latency, bytes, memory and failures before recommendations.
Confidence values are diagnostic only. A failed Laya gate leaves automatic advisory
calls disabled; retain the service and explicit evaluation path. No fine tuning.

## Observable boundary cases

- Reject malformed, extra-key, oversized and unsupported input before any call.
- Reject malformed, truncated, oversized, injected or ungrounded model output.
- Never follow redirects or fetch model-supplied links.
- Preserve supplied source pages and previously validated labels. Skip completed
  classification, combine missing submission questions into one inference call.
- Return a review-needed failure without accepting or replacing official records.
- Build route text from validated fact identifiers, not free model prose.
- Concurrency and slow/failed responses cannot produce retries or an unbounded queue.

Written by gpt-6-astra through Codex (T3 Code).

## One bounded Luna correction and fresh holdout

The original 12 report cases remain scored at 6/12 exact. Post-run semantic
inspection is diagnostic, not a replacement pass: 10/10 returned values were
supported, units were complete in 9/10, periods correct in 10/10, meaning correct
in 9/10 and spans exact in 10/10. One of 11 expected metrics was rejected before
review. Two no-metric/instruction-only cases correctly returned no candidates.

The concrete defect was accepting any quoted phrase as a meaning label. Version 2
accepts only literal known target/result/annual/cumulative/estimate cues and
requires that cue in source evidence. Unsupported vocabulary stays missing or
causes a recoverable rejection. The report specification names no mandatory
languages. English probes are primary; Mandarin/Malay/Tamil remain exploratory.

Before version 2 inference, `luna-fresh-held-out.json` fixes 15 new cases: 12
English and one each Mandarin/Malay/Tamil. The old exact-match metric is retained.
A separate preregistered semantic metric accepts only each expected literal or
its listed prefix/period variants. It does not accept lost units, unsupported
meanings, extra/missing candidates or replacing null with a value. Require at
least 90% semantic cases, zero unsupported accepted fields, and correct missing
and instruction-only cases before calling the new extraction sample validated.
Do not change these fixtures, alternatives, schema or prompt after observing this
run. Any remaining failures go to manual review and future scoped revalidation.
