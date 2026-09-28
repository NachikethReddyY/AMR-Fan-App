---
name: amr-debug
description: Diagnose and fix a reproducible AMR defect or regression. Use for broken, failing or slow behavior with a bounded reported symptom.
---

# amr-debug

Resolve repository paths from the Git root. Read the canonical skill through
.agents/skills even if discovered through a Claude link.

1. Read AGENTS.md, bug.md and the named entry point. Record expected/actual
   behavior, environment and smallest reproduction before editing.
2. Form one hypothesis and choose an observation that distinguishes it. Trace
   real calls; broaden the search only when evidence is insufficient.
3. If learning mode was requested, protect the user's hypothesis and first attempt
   using docs/agents/collaboration.md. Otherwise execute the diagnosis.
4. Capture the failure in a focused regression test when a practical local target
   exists. Fix the cause, not a guard that hides the invalid state.
5. Re-run the reproduction and smallest protected-behavior regression. Use
   docs/operations/verification.md for applicable gates. Browser/device reproduction
   still requires explicit consent.
6. Update bug.md and work.md with cause, change, evidence, exact attribution and
   remaining limits. Retry only after changing the hypothesis, inputs or method.

Stop when the reported behavior and protected regression pass. A tool failure is
not automatically an app defect; report unavailable prerequisites explicitly.

Written by gpt-6-astra through Codex (T3 Code).
