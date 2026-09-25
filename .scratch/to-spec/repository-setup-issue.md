## Purpose

Set up the repository foundation for the Aston Martin fan app so that later feature work starts from a small, runnable and understandable project.

This issue covers repository setup only. The full product specification is a separate document; race travel, points and fan features belong in later scoped issues.

> [!IMPORTANT]
> **Planning only — do not start setup or build the app yet.** The user has asked for the issue to be corrected, not for its tasks to be executed. Wait for a separate instruction before scaffolding, installing dependencies, provisioning services or implementing anything.

## Current state

- The GitHub repository already exists.
- It contains the project glossary, planning documents, a team discussion brief, agent instructions and static screen-direction proposals.
- There is no implemented mobile app, package manifest, backend or application test suite yet.
- The chosen direction is Expo + React Native for iOS and Android, with Convex as the planned backend. JavaScript/TypeScript package management uses pnpm.
- The full product specification is saved separately as `docs/fan-app-specification.md` in the local workspace. That new document has not been committed or pushed by this task.

## Setup scope

When implementation is explicitly authorized:

- [ ] Create a minimal Expo/React Native project with TypeScript for iOS and Android. Keep the starter screen neutral; do not choose the final product UI or add fan features.
- [ ] Use pnpm, include the lockfile, and document the supported local toolchain and prerequisites.
- [ ] Provide documented commands for starting local development, type checking, linting and formatting.
- [ ] Prepare the test tooling for later behavior tests. Make the current no-feature-tests state explicit; do not claim product coverage from starter checks.
- [ ] Establish a minimal source structure that can accommodate the planned Convex backend without implementing authentication, a schema, business rules or live service connections.
- [ ] Document configuration names and supply example values/placeholders where needed. Keep credentials and private environment files out of version control; do not create accounts or provision a backend.
- [ ] Review ignore rules for dependency folders, generated output, local configuration and secrets without removing existing project material.
- [ ] Expand the README with install/start/check instructions, repository structure, configuration requirements, and links to the specification, glossary and team brief.
- [ ] Preserve the existing requirements, open-decision callouts, domain vocabulary, research notes and unselected screen proposals.

## Acceptance criteria

To be checked only when the setup work is later authorized and performed:

- A clean checkout can follow the documented pnpm setup instructions.
- The minimal starter can launch in development on iOS and Android; record the actual device/simulator evidence and mark unavailable platform checks unverified.
- The documented type-check and lint commands pass, and formatting can be checked consistently.
- The test command is configured and its current coverage/no-tests state is reported honestly.
- No private keys, real credentials or private environment values are committed.
- The README lets another developer start the project without relying on this conversation.
- No race, journey, points, challenge, store or tree behavior has been implemented as part of setup.

## Testing approach

This ticket verifies the development foundation and starter launch only. It does not execute or claim completion of the product acceptance scenarios.

For later feature issues, the approved approach is to test fan/admin workflows through one authenticated Convex application boundary using controlled time, Maps responses and location samples, then verify real background tracking and arrival on physical iOS and Android devices. Keep that future strategy documented without implementing those workflows in this setup task.

## Out of scope

- Creating a replacement GitHub repository or resetting this one.
- Race-calendar ingestion, Maps routing or live location/background tracking.
- Carbon calculations, journey validation, points balances or earning rules.
- Authentication implementation, admin permissions or live Convex provisioning.
- Challenges, voting, rewards-store redemptions or tree-planting requests.
- Final visual design or selection of a screen direction.
- Unrequested CI/deployment infrastructure, pre-commit hooks or repository restructuring.
- App-store release, public hosting, deployment, commits or pushes without separate authorization.

## Completion

This issue is complete only after the setup work is authorized, carried out and checked against the criteria above. Editing this issue does not complete repository setup.
