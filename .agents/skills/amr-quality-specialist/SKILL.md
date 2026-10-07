---
name: amr-quality-specialist
description: "Audit AMR backend feature work with executable proof, strict TypeScript and PostgreSQL safety checks. Use after a feature programmer reports completion or when reviewing a scoped backend plan; distinguish unit, database, provider, device and Azure evidence, and reject scope creep or unsupported claims."
---

# AMR quality specialist

Use this skill for a focused, read-only review of an AMR backend change or
feature plan. The result is a short evidence-backed verdict for the parent
agent. Do not implement fixes, alter application code, commit, push, deploy,
or silently repair fixtures. Preserve unrelated dirty files.

## Review contract

Before reviewing, record:

- repository, branch, HEAD, dirty paths, and the feature's allowed paths;
- the approved feature contract and protected existing behavior;
- the exact diff (`git diff <base>...HEAD`) and changed migrations/contracts;
- the acceptance cases and the command set that will be run.

Review only the requested feature. Treat existing planning documents as
constraints and context, not as permission to broaden the implementation.

## Evidence first

Run focused checks against the changed path, then the applicable repository
checks from `docs/operations/verification.md` and `package.json`. Record the
exact command, exit code, test count, fixture/provider mode, and limits. Label
each result as one of:

- **synthetic/unit**: pure policy, schema, media, or injected-provider fixture;
- **PostgreSQL**: a real transaction against an isolated database;
- **provider**: an authorized live OneMap/Luna/report provider call;
- **device**: signed iOS/Android behavior and permissions;
- **Azure**: a deployed revision, database, secrets, readiness, rollback, or
  restore check.

Never promote a synthetic pass to live, device, or Azure proof. Report baseline
failures separately from regressions introduced by the diff. If a command is
blocked by Windows symlink, line-ending, Docker, credentials, or device limits,
preserve the exact failure and do not weaken the assertion to make it green.

At minimum inspect `pnpm typecheck`, `pnpm lint`, and the focused feature test
command. For a changed HTTP/data/AI boundary, include the applicable security
checks and a real PostgreSQL test when the repository provides one. A plan
without an executable acceptance case is incomplete.

## AMR feature gates

### Photo evidence and Luna scoring

The current implementation is deliberately unavailable at the HTTP boundary:
`server/activity/http.ts` returns 503 for photo POST. `server/activity/media.ts`
does bounded JPEG/PNG decoding and clears transient bytes. The assessment module
accepts one decoded photo and description, invokes an injected provider, validates
strict observations/decisions, times out/cancels, and returns a candidate with
`requiresEligibilityRecheck`; it does not award or persist. `claims.ts` is
synthetic-test-only and the `0010_photo_activity.sql` table hardcodes one hash,
one claim, and 50 points.

For new work require explicit schemas for a photo series, description, category,
score/explanation, review state, and result version. Keep Luna's output
untrusted: validate it, bound bytes/tokens/time/cost, prevent provider facts from
creating points, recheck ownership/duplicate/eligibility inside one transaction,
and make retries idempotent. Decide whether points are awarded once per activity
or once per mission before changing the ledger. Do not retain originals,
descriptions, prompts, or model output unless the contract and retention policy
say so. Add tests for malformed media, duplicate image/series, replayed request,
provider timeout/invalid output, concurrent claims, low confidence, and
unavailable provider. A score is participation feedback; it is not measured
CO2 or Aston Martin's official ESG metric.

### Race-week missions and personalization

Prefer a small server-owned, versioned mission definition and progress record
over a generic rules engine. Keep eligibility and point policy in pure functions;
persist only the state required for replay-safe progress and an audit receipt.
Use a stable mission id/version, owner scope, explicit start/end, and one
idempotency key per qualifying event. Test boundary dates, duplicate events,
concurrent progress, profile isolation, archived missions, and a changed mission
version. Personal recommendations should be a deterministic bounded projection
of profile choices and available missions; do not introduce embeddings, a
workflow engine, or a separate service for the first slice.

### Two-sided ESG reporting

`GET /v1/impact/official` reads admin-approved, source-backed report metrics.
`GET /v1/profiles/:id/impact` reads owner-scoped estimated journey contribution.
The existing impact contract distinguishes unavailable/empty/available totals and
records factor provenance. Preserve that separation in any combined response:
official Aston Martin values must retain source URL, period, unit, evidence and
approval; fan contribution must retain owner scope, method, assumptions,
validation state and estimate units. Never add fan estimates to company totals,
convert points or photos into measured CO2, or publish unapproved model output.
Test both sides with approved, unapproved, fixture, unavailable, incompatible
unit and empty cases, and assert the response cannot be misread as one total.

## Code and migration review

- Keep existing module seams (`server/activity`, `server/ai`, `server/impact`,
  `server/reports`, `server/points`) unless a concrete caller needs a seam.
  Prefer a deep module with a small interface and pure policy helpers.
- Require strict Zod input/output validation at HTTP and provider seams; avoid
  casts, duplicated schemas, hidden global state, and framework or microservice
  additions.
- New SQL must be additive, numbered, transaction-safe, and included in the
  migration/checksum runner. Inspect constraints, indexes, foreign keys,
  immutable history triggers, lock order, and rollback/read compatibility.
- Prove `(actor, requestId)` replay behavior, resource ownership, duplicate
  evidence, concurrent ledger writes, and no negative balances. A successful
  response without a durable read-back is not proof.
- Check provider-disabled defaults, redacted errors, bounded payloads/timeouts,
  no secret reflection, and explicit cost admission. Azure hosting does not
  remove these gates; keep one Node API and PostgreSQL unless measured need
  justifies more.

## Verdict format

Report findings in severity order with file/line or command evidence. Separate:

1. blocking correctness/security/data-loss issues;
2. missing acceptance proof or migration/replay risk;
3. maintainability/scope observations;
4. baseline failures and unverified environments.

End with `PASS`, `PASS WITH FOLLOW-UP`, or `BLOCKED`, list the exact proof that
supports it, and state what remains unverified. Do not call a feature complete
when a required database, provider, device, or Azure gate was not exercised.

## Sources

Repository sources consulted: `AGENTS.md`, `.agents/skills/amr-sdlc/SKILL.md`,
`.agents/skills/code-review/SKILL.md`, `.agents/skills/codebase-design/SKILL.md`,
`docs/internals/security.md`, `docs/operations/verification.md`,
`server/activity/*`, `server/ai/*`, `server/impact/*`,
`server/database/migrations/0010_photo_activity.sql`, and the v0.2 backend and
POC council plans under `.dev-team/planning/`.

Primary references consulted for review semantics: Node.js test runner
<https://nodejs.org/api/test.html>, PostgreSQL transaction isolation
<https://www.postgresql.org/docs/current/transaction-iso.html>, and TypeScript
strict mode <https://www.typescriptlang.org/tsconfig/strict.html>. These explain
test execution, concurrent transaction behavior, and type-check expectations;
they do not replace this repository's acceptance gates.
