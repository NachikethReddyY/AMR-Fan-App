---
name: amr-security
description: Review or implement security for AMR authentication, data access, uploads, AI, paid APIs or CI. Use for changed trust boundaries or a requested security review; skip unrelated cosmetic edits.
---

# amr-security

Resolve repository paths from the Git root. Read the canonical skill through
.agents/skills even if discovered through a Claude link.

1. Read AGENTS.md, SECURITY.md and docs/internals/security.md. Identify the real
   entry point, actor, asset, trust boundary and exposure. Separate local
   maintainer tools, synthetic demos and public services.
2. Trace input to authority, storage, output and provider spend. Apply only relevant
   controls from the security matrix. Inspect actual callers before ranking risk.
3. Before a fix, reproduce the behavior with synthetic data. For implemented
   boundaries, test anonymous/cross-account/non-admin access, invalid inputs,
   retries/concurrency and cleanup as applicable. Preserve accepted demo semantics.
4. For AI, test embedded instructions and malicious structured responses.
   Authorization and budgets must be enforced outside the model; a prompt alone
   is insufficient. Verify no raw data reaches storage, logs or evidence.
5. Run pnpm security:check. Use amr-dast for HTTP scanning only when a real target
   exists. Fixture success is scanner proof, not product proof.
6. Report a scorecard before recommendations: finding/status, affected sample,
   method, evidence, exposure, confidence and limits. Log sanitized bugs and
   residual risk with owner/revisit trigger; use private reporting for sensitive details.

Stop when requested boundaries have evidence, confirmed in-scope defects are fixed
and checked, and residual limits are explicit. Do not add speculative infrastructure,
silence broad rules or claim the application is immune to injection.

Written by gpt-6-astra through Codex (T3 Code).
