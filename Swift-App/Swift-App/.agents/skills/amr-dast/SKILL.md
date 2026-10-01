---
name: amr-dast
description: Run or configure AMR HTTP security scans using the local isolated ZAP workflow. Use for DAST or a new admin/API HTTP target; not for mobile-only UI validation.
---

# amr-dast

Resolve repository paths from the Git root. Read the canonical skill through
.agents/skills even if discovered through a Claude link.

1. Read AGENTS.md and docs/operations/security-testing.md. Inspect
   security/dast-target.json and identify whether a real application target exists.
2. Run pnpm security:dast for an implemented target, or report not applicable
   when the configuration says no HTTP app exists. Never substitute Metro or the
   scanner fixture and call it an application pass.
3. Use pnpm security:dast:self-test when changing scanner configuration. It must
   accept the safe fixture, reject the unsafe fixture and clean up containers.
4. The normal runner uses an isolated Docker network, synthetic data and HTTP-only
   crawling. Browser/Ajax scanning needs explicit consent. Remote or active scans
   require separate scope and target authorization; do not improvise them here.
5. Inspect actual report sites, alert IDs, risk and route coverage. Missing reports,
   startup failures and scanner errors fail the check. Passive scanning cannot
   prove authorization or points invariants; run those behavior tests separately.
6. Record scope, tool/image version, reachable routes, alerts, fixes and gaps.
   Keep raw reports in ignored .evidence and review them before any authorized upload.

Stop after relevant findings are resolved or evidence-backed residual risk is
recorded and the affected scan is repeated. State not applicable or unverified
instead of a pass when there is no valid target or the scan failed.

Written by gpt-6-astra through Codex (T3 Code).
