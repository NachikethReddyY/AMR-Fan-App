# Tasks

## Issue #1 — Expo setup (t3code/implement-issue-one)

Full issue #1 setup verification completed locally at the user's request.

- [x] Add a neutral Expo TypeScript starter and pnpm lockfile; preserve existing planning material.
- [x] Configure and pass type checking, linting, formatting, and test tooling (no feature tests yet).
- [x] Document prerequisites and link the original specification restored unchanged from the main worktree; no backend provisioned.
- [x] Verify frozen-lockfile installation and all documented checks in a fresh source copy without existing dependencies or private environment files.
- [x] Verify production bundle exports for iOS and Android (`pnpm exec expo export --platform all`).
- [x] Launch the starter on iOS and Android through T3 devices and save screenshots and content-check evidence.
- [x] Verify the Jest Expo preset loads TypeScript and React Native imports with a temporary test in the isolated copy; remove that test after the check.
- [x] Review ignore rules, documentation links, and preservation of planning material.
- [x] Update setup verification evidence and README with observed results.

Evidence: [.evidence/issue-1/verification.md](.evidence/issue-1/verification.md).
Native binary compilation and physical-device behavior are outside this setup issue and remain unverified.
Setup verification is complete; delivery is recorded in the branch and PR history. No deployment or live backend provisioning was performed.

## Separate the specification from issue #1

- [x] Read the current issue and preserve its full product requirements in a standalone specification document.
- [x] Draft a replacement issue focused only on repository setup, with implementation still awaiting a separate instruction.
- [x] Update issue #1 and verify its title, setup-only scope and labels.
- [x] Verify that the 69 product stories, 32 acceptance scenarios and open decisions remain in the standalone specification.

Verified [issue #1 — Set up the repository for the Expo/React Native app](https://github.com/NachikethReddyY/AMR-Fan-App/issues/1). It contains setup scope and future acceptance criteria only, preserves the instruction not to start building, and no longer has the `ready-for-agent` label. The [full product specification](docs/fan-app-specification.md) is a local document; it has not been committed or pushed by this task.

Project correction: keep the overall product specification separate from scoped implementation tasks. This does not change agent guidance or authorize repository setup.

## to-spec — publish the core fan-app specification

- [x] Confirm repository, glossary, tracker conventions, authentication, and existing application/test state.
- [x] Synthesize the complete specification with extensive user stories, confirmed decisions, open decisions, and observable acceptance criteria.
- [x] Check the proposed testing boundary with the user as required by the invoked skill.
- [x] Validate the specification against the current brief and protect unresolved decisions from becoming assumed requirements.
- [x] Publish the specification to this repository's GitHub Issues with the `ready-for-agent` label, then read it back to verify the body and label.

Historical result: the full specification was initially published and read back as issue #1, including 69 user stories, 32 acceptance scenarios, seven required sections, approved test seams, and open-decision callouts. The user subsequently requested that issue #1 cover repository setup instead. The product specification is now preserved separately in [the specification document](docs/fan-app-specification.md); the correction above supersedes the original issue purpose. No app implementation or build was started.

The explicit `to-spec` invocation authorizes this specification issue and its required label in the private project tracker. The user confirmed the testing approach and explicitly said not to build anything yet. Do not scaffold or implement the app, run a build, commit, push, or deploy during this task.

## Team discussion HTML — 25 September 2026

- [x] Record the non-refundable 500-point submission fee and accepted daily outbound/return reward limit.
- [x] Create a local HTML brief separating confirmed rules, proposals, open team decisions, and disclosed demo fulfilment.
- [x] Verify local readability, agreement with the plan, internal links, and self-contained markup; report rendered layout separately.

Artifact: [team discussion brief](docs/fan-app-team-brief.html). Verification: [.evidence/team-discussion-html/verification.md](.evidence/team-discussion-html/verification.md). Local content and source checks passed; rendered appearance and interaction remain unverified. Nothing published by this task.

This deliverable is a team discussion document. It does not close unresolved interview questions or authorize app implementation or publication.

## Finish grill-with-docs — resumed interview

- [x] Reconcile the recorded plan with the latest answers and separate UI design from interview completion.
- [ ] Resolve carbon intent, journey evidence/eligibility, challenge lifecycle, coverage, and account/data policy.
- [x] Verify distance-times-mode-factor methodology and unit boundaries against primary sources; production factor selection remains an implementation prerequisite.
- [x] Verify Aston Martin's ESG tree/restoration work and record optional earned-points contributions with clearly disclosed demo fulfilment.
- [x] Record 50 points/kg and a 2,000-point journey cap; check worked examples.
- [x] Record admin-set store/tree prices, no challenge refunds, challenge backlog, and tree assignment to the purchasing account.
- [ ] Resolve rejected challenge handling and confirm final product defaults.
- [x] Record acceptance scenarios for the agreed rules; these are not executed tests.
- [ ] Check the final plan for unresolved implementation-blocking product assumptions.
- [ ] Obtain confirmation of the consolidated core-app plan.

## Fan app core — current build thread

- [x] Record the confirmed travel, admin, store, and points-balance rules.
- [x] Confirm 500 points to submit; contributions start at 10 points and may use the fan's available balance.
- [x] Create three local static UI directions covering travel, challenges, and the store.
- [x] Verify local readability, confirmed challenge rules, navigation anchors, and self-contained structure.
- [ ] Visually verify layouts: preview host became unavailable and computer-use browser inventory was empty. Rendered appearance remains unverified.
- [ ] Obtain design selection before real UI edits.
- [ ] Resolve carbon/points rules and the remaining product decisions needed by each implementation slice.
- [ ] Scaffold the selected Expo/React Native app for iOS and Android.
- [ ] Build and test race planning, route comparison, and outbound/return journey state.
- [ ] Integrate and verify Google routing and native background tracking on both platforms.
- [ ] Build and test provisional points, completion credit, and duplicate-credit prevention.
- [ ] Build and test challenge submission, admin approval, and points-based ranking.
- [ ] Build and test the 10%–60% discount store with clearly labelled sample fulfilment.
- [ ] Build and test individual tree redemptions at admin-set point prices, named dedications, and unfulfilled-request reassignment, with disclosed demo fulfilment.
- [ ] Review the completed core and report local state and remaining unverified checks.

Publishing, deployment, shared tracker writes, commits, and pushes are outside this local-build scope. The user does not want to provide a deadline; do not make it a prerequisite.
