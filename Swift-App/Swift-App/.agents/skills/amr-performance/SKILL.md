---
name: amr-performance
description: Measure and fix AMR latency, rendering, network traffic, bundle growth or AI cost. Use for performance regressions and changes to expensive data flows.
---

# amr-performance

Resolve repository paths from the Git root. Read the canonical skill through
.agents/skills even if discovered through a Claude link.

1. Read AGENTS.md and docs/operations/performance.md. Name the user action,
   comparison baseline, likely bottleneck and accepted performance criterion.
2. Capture comparable before measurements: environment, sample size, cache state,
   duration, bytes, request count and cost where relevant. Do not infer latency
   from source size. Browser/device profiling needs explicit consent.
3. Trace the expensive work through real callers. Change the smallest proven
   cause, preserving correctness, privacy and accepted UI.
4. Repeat the same workload and protected behavior checks. Distinguish warmup,
   noise and synthetic results from a supported improvement claim.
5. Present the scorecard before recommendations; record evidence and limits in
   work.md. Propose budgets with the owning feature rather than inventing SLOs.

Stop when the agreed measurement improves without a behavioral regression, or a
concrete missing measurement environment prevents that claim. Avoid speculative
caches, workers, services or repeated full audits after the focused proof passes.

Written by gpt-6-astra through Codex (T3 Code).
