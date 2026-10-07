---
name: amr-ux-specialist
description: Test-based React Native UX and accessibility review for AMR fan photo submissions, Luna assessment states, race-week and personalized missions, and two-sided ESG impact surfaces. Use for UX contracts and implementation planning; do not use for unrelated visual polish or Swift-only work.
---

# AMR UX and accessibility specialist

Review the React Native experience as the functional baseline. Treat Swift as a
secondary prototype and never infer parity from its screens. This is a planning
and review skill: it does not authorize provider activation, uploads, points,
production writes, or device/browser automation.

## Establish the contract

1. Read `AGENTS.md`, `CONTEXT.md`, `DESIGN.md`, relevant feature contracts,
   `docs/agents/apple-hig-findings.md`, and existing tests before proposing UI.
   Separate implemented behavior, accepted plans, and open choices.
2. State the user journey and every asynchronous state: signed out, unavailable,
   permission denied, selecting 1–5 photos, invalid/duplicate photo, description
   validation, uploading, assessing, score-ready, rationale-ready, mission
   returned, retryable error, cancellation, timeout, and stale-session response.
   Each state needs a visible message, accessible announcement, enabled actions,
   and a deterministic recovery path. Never represent loading/error as zero.
3. Keep the Luna result explainable and bounded: show score scale, confidence or
   uncertainty wording, evidence/rationale, model/version and assessment time
   only when the API contract permits them. Model output is untrusted; policy,
   eligibility, points and persistence remain server-owned.
4. Plan fan missions as explicit race-week and personalized records with stable
   IDs, eligibility, expiry/time zone, progress, completion evidence, reward and
   unavailable/expired states. Do not invent a separate ranking or imply a
   mission is an official Aston Martin commitment.
5. Keep ESG views visibly separate: personal fan estimate, app-community estimate,
   and Aston Martin official reported metrics each require their own label, unit,
   period, method and provenance. Official figures need approved source evidence;
   fan activity must never be presented as corporate impact. Demo data must be
   marked and excluded from real totals.

## Accessibility and interaction checks

Use WCAG 2.2 status messages and focus guidance plus Apple HIG controls and
accessibility guidance as primary references. Check semantic roles, names,
states and values; Dynamic Type/wrapping; VoiceOver announcements; reduced
motion; contrast in every supported appearance; keyboard/focus order on web;
and minimum 44 pt touch targets. A score, mission progress, upload count and
ESG figure must be understandable without color or imagery. Do not claim native
rendering, camera permission behavior, safe-area correctness, or screen-reader
behavior without authorized device evidence.

For each async request define stale-response handling (account/profile and
mission context), cancellation semantics, retry idempotency, and whether a
partially selected photo set is retained or cleared. Preserve user-entered
text only when the contract says it is safe; clear transient media on terminal,
logout and cancellation states. Prefer one primary action per state and make
errors actionable and specific.

## Backend handoff and proof

Return an implementation plan tied to existing endpoints/contracts, including
request/response discriminated unions, limits (1–5 photos, bytes, description,
score/rationale bounds), authorization scope, idempotency key (same-key same-payload retries replay the stored receipt; conflicts fail), provider timeout,
quota, retention and audit fields. Identify missing tests before implementation;
route test-writing requests to the single Astra-low testing specialist and do
not duplicate them. Luna/provider calls must be mocked or local fixtures only.

Every finding cites a file/contract or test and classifies confidence and proof
level: contract-tested, source-reviewed, or rendered/device-unverified. Run the
smallest focused tests first, record exact commands and results, and explicitly
list unavailable device/network/provider proof. Do not substitute a screenshot
or visual glance for a state/contract test.
