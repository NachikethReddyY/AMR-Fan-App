---
name: amr-security-specialist
description: Test-backed security review of AMR application trust boundaries, including authentication, data access, uploads, AI/provider calls, accounting, ESG reports, CI and future deployments. Use for planning or reviewing a security-sensitive change; do not use as permission to implement, deploy or scan a live target.
---

# AMR security specialist

Use this reusable workflow for future feature and application reviews. Read `AGENTS.md`, `SECURITY.md`, `docs/internals/security.md`, and the owning feature spec/status. Keep review separate from implementation authority: raw programmers (Luna xhigh) implement only root-approved decisions; security, UX and quality reviewers (Astra medium) review; the singleton Astra low test engineer researches and writes requested tests. Do not add app code, dependencies, commits, pushes, deployments, browser/live-provider actions, remote scans or subagents during a review unless separately authorized.

## Review and evidence

1. Record branch/commit, dirty paths, entry point, actors, assets, data stores, provider destinations, exposure and exact claim. Distinguish running code, proposed design, synthetic fixtures and unavailable production proof.
2. Trace authenticated identity through validation, authorization, decoding, provider spend, persistence, output, logs and cleanup. Inspect callers and SQL, but label SQL inspection as source evidence; it is not proof of a real database transaction, grants, migration or concurrency behavior when no live/test database is available.
3. Run the smallest meaningful local fixture test exercising the boundary. Use synthetic data and focused existing tests; do not rerun broad AI suites without a reason. Record command, environment, pass/fail count and limits.
4. Report each finding with severity/status, affected path, condition, evidence, confidence, owner, mitigation and revisit trigger. End with concrete acceptance tests and unresolved design questions. Never call a provider, send real media, contact a remote service or claim model accuracy from unit fixtures.

## Invariants to check

- Server-derived identity, role, ownership, eligibility, policy version, points, impact factors and approval status are authoritative. Test anonymous, fan A, fan B, admin, revoked and forged-role calls. Authenticated fans may **GET** `/v1/impact/official`; admin authorization is required for source mutation and review operations.
- For uploads, enforce request/image/decoded-pixel bounds, signature and decoded format checks, still/single-frame policy, metadata stripping, no arbitrary URLs, bounded concurrency/deadlines/retries, and cleanup on success, error, timeout, cancellation and recovery. Hashes detect byte/pixel reuse only and must not expose an owner through global lookup.
- Treat image/OCR/description/provider text as untrusted data. Keep tools off or allowlisted, separate instructions from data, reject unknown authority fields, bound strings/observations and score/confidence, and fail closed on malformed, uncertain or unavailable results. Deterministic policy owns points, missions, duplicate checks and impact accounting.
- Recheck eligibility and ownership in the transaction immediately before a claim. A unique operation/request key makes concurrent retries one mutation. A same-key, same-payload replay returns the **stored receipt**; a same-key different payload is rejected. Do not infer this from mocked arrays.
- Keep personal participation, measured/estimated fan impact, community totals and official Aston Martin metrics distinct. Retain provenance (source, revision, parser/model and reviewer metadata) for audit; do not claim it is cryptographically signed when there is no signing service. A global image hash may serialize duplicate checks but must never reveal its account owner.
- Before Azure activation, prove shared admission/cost limits, TLS database, managed identity or Key Vault secret isolation, approved egress, redacted telemetry, bounded storage/lifecycle deletion, migration/grant ordering and dependency readiness. `/health` liveness is not readiness.

## Primary guidance consulted

Read the focused excerpts in [references/official-guidance.md](references/official-guidance.md) when reviewing uploads, prompt injection or Azure identity. It records exact URLs, access date (2026-09-28), and decisions applied here; it is not a copy of the source manuals.

## Stop condition

Stop when the requested boundary has focused evidence, confirmed residual risks have owners and revisit triggers, and plan questions are explicit. Do not treat the current photo endpoint, phase scope or draft plan as approved future behavior.
