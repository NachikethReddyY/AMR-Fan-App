---
name: amr-test-engineer
description: Design and verify behavioral tests for AMR backend and app changes, including authenticated HTTP contracts, AI/adversarial fixtures, PostgreSQL concurrency and accounting, and device-specific UX checks. Use during feature planning, implementation or regression review; do not treat mocks, snapshots or passing unit tests as production proof.
---

# AMR test engineer

Turn an accepted behavior into observable acceptance cases before implementation. Test at public seams: HTTP request/response, authenticated service contracts, durable readback, and user-visible UI semantics. A test should fail when the behavior is absent or unsafe and should survive internal refactors. Keep independent expected values from the implementation; avoid snapshots, private-method assertions, arbitrary coverage targets and tests that only restate mocks.

## Workflow

1. Read `AGENTS.md`, the owning specification, active bug/work entries and `docs/operations/verification.md`. Record revision, runtime, exact command, expected result, observed result and limits in the task evidence ledger.
2. Write the smallest vertical behavioral case first. For a new HTTP feature cover authenticated happy path, malformed/oversized input, wrong owner/admin/demo scope, retry/idempotency and explicit unavailable/uncertain outcomes. Assert status, stable response contract, durable state and ledger effects through public interfaces.
3. For points, mission completion or quotas use disposable PostgreSQL with migrations. Run concurrent requests against the same operation and assert one durable award, replay returns the stored result, ownership and eligibility are rechecked in the transaction, and rollback leaves no partial receipt. Do not replace a race test with an in-memory mock; PostgreSQL transaction behavior is the subject.
4. Keep provider adapters injectable, but treat provider output as hostile input. Use adversarial fixtures for prompt injection, unknown fields, out-of-range scores, fabricated authority/points/URLs, malformed JSON, timeout, cancellation and retry. Assert deterministic server policy owns scoring, points, source approval and mission state. Keep held-out evaluation fixtures distinct from unit mocks and never send real user media or credentials.
5. For multi-photo submissions test 1 and 5 valid images, 0 and 6 images, per-image/total decoded limits, canonical duplicate fingerprints, MIME/decompression attacks, description bounds, idempotency replay and concurrent retry. Prove transient bytes/observations are cleared on success, rejection, timeout and cancellation.
6. For ESG test personal, app-community and approved Aston Martin metrics as separate typed records with units, period, method and provenance. Assert demo/legacy/unassessed rows are excluded, superseded/unapproved reports are not exposed, and unavailable is not converted to zero.
7. UI tests should use Testing Library queries and user-observable states (roles, labels, status messages, focus/keyboard semantics). Jest/web tests do not prove native camera permissions, VoiceOver, Dynamic Type, safe areas or touch targets: schedule separate emulator/device tests with explicit consent. Emulator proof must record platform, build, steps and results and is distinct from physical-device and background-GPS proof. Avoid brittle snapshots.
8. Run focused checks first, then only applicable package gates. Mark Docker, real provider, Azure, browser/device and production database proof as unavailable when not actually exercised. Do not claim model accuracy from mocks; use held-out fixtures/evaluation separately.

## Reusable acceptance matrix

Maintain IDs such as `T-ACT-HTTP-01`, `T-ACT-RACE-01`, `T-AI-ADV-01`, `T-MISSION-01`, `T-ESG-01`, and `T-UX-DEVICE-01`. Each row names seam, setup, action, expected observable result, exact command and evidence path. Link [primary testing references](references/primary-sources.md) when choosing a method.

## Handoff

Report red tests as useful evidence when they demonstrate a missing behavior; report environment failures separately. Consolidate open cases from security, UX and quality audits into the ledger rather than duplicating suites. Do not edit product code while writing a plan or skill.
