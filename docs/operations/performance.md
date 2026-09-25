# Performance and provider cost

Performance is an acceptance property. Measure before changing a hot path, after
adding a provider/data flow, when dependencies affect bundles, and before a release.
Do not claim speed from a typecheck, smaller diff or a simulator impression.

Define the user action and one bottleneck hypothesis first. Use the same build
mode, hardware, dataset, network and cache state before and after. Record sample
count, warmup, median and tail latency when the sample supports it. Mark tiny
samples and simulated networks as limited evidence; do not invent target budgets.

| Area | Measure | Regressions to investigate |
| --- | --- | --- |
| Phone | Startup/interaction duration, JS/UI stalls, memory and battery when relevant | Repeated renders, large lists, leaked subscriptions, continuous effects |
| Network | Requests per action, payload bytes in/out, compression, retry count and latency | Repeated media, N+1 calls, unbounded pages/subscriptions |
| AI | Calls/tokens/bytes, deadline, retries, concurrency and cost per accepted result | Duplicate work, unbounded prompts/outputs, retry storms |
| Backend | Query count, scanned/returned records, transaction latency and conflicts | Missing indexes, fan-out and contention |
| Build | Export duration and output bytes by platform on comparable environments | Dependency/bundle growth |

Keep policy calculations pure and profile before adding caches or workers.
Prefer bounded queries, pagination, cancellation and removing repeated work.
Avoid pulse/shimmer/blur/spinner effects that repaint continuously.

Browser and device profiling require explicit consent. Without it, measure
available command/API paths and mark interaction/frame/battery behavior unverified.
Use synthetic data and aggregate measurements; never log a raw image or journey
trace to count bytes.

For an audit, put the scorecard before recommendations: metric/status, sample
size, counting method, evidence, confidence and limits. Use an empty score when
evidence is insufficient. Record accepted budgets with the owning feature; there
are no measured production budgets for this starter.

## Starter bundle observation

On 25 September 2026, `pnpm exec expo export --platform all` produced one Hermes
bundle per platform: 1,426,557 bytes for iOS and 1,431,623 bytes for Android, using
Node 24.20.0 and pnpm 12.6.0 on macOS. This single cached export is a size reference,
not a startup/latency benchmark or regression budget. Source and lockfile were
unchanged by the agent-workflow task. Re-measure on a comparable build after a
dependency or product change; do not compare cached export timing with CI timing.

Written by gpt-6-astra through Codex (T3 Code).
