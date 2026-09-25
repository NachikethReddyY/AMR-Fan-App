# Working on AMR Fan App

This is the canonical project instruction file for every agent. `CLAUDE.md`
imports it. Read linked guidance when its condition applies; another agent's
personal setup is not a prerequisite. Human task instructions control scope
within the agent's higher-priority system and developer constraints.
This project contract takes precedence over imported skill defaults, including
their commit, publication, browser and PR steps. Use the `amr-*` workflows for
app development and `file-pr` for PR work, within the same scope and authority.

## Note from Nachiketh

I like building ambitious ideas, simple designs, and software that feels obvious.
Do not preserve complexity just because it already exists. Do not introduce
machinery because it looks architecturally impressive. Understand the real
constraint and fight for the smallest model that makes correct behavior
unsurprising. Measure twice, cut once, and apply YAGNI. Fight scope creep while
honoring developer intent in a minimal, realistic way. These instructions are
good defaults; explicit authority boundaries and data protections still apply.

## Product and priorities

An Aston Martin Formula One fan app for the Make a Mark hackathon: fans use the
React Native phone app; admins will use a separate web app. Sustainable travel,
fan engagement, rewards and sourced ESG information define the product. Read
[CONTEXT.md](CONTEXT.md) for domain terms and the
[specification](docs/fan-app-specification.md) for accepted behavior and open choices.

The repository currently contains an Expo starter, not the planned product.
[Architecture and implementation status](docs/internals/architecture.md) separates
running code from proposals. Do not build deferred features merely to satisfy a checklist.

- Keep code, roadmap and durable decisions open when publication is authorized.
  Preserve repository visibility; remove secrets and private evidence before sharing.
- Measure performance: request count, bytes, latency, memory, rendering and provider
  cost where the change affects them. Follow [performance](docs/operations/performance.md).
- Minimize data and provider spend. Validate AI results as untrusted input.
- Apply security in proportion to exposure and impact. Maintainer-only local tools
  do not need production infrastructure; real credentials, user data and roles still matter.

## Working loop

For implementation or mutation, use [amr-sdlc](.agents/skills/amr-sdlc/SKILL.md).
Simple questions need answers, not edits. Before editing, confirm the repository,
branch, worktree and existing changes. Preserve work owned by another task.

1. State exactly five Markdown lines with bold field names: **Outcome:**,
   **Allowed changes:**, **Protected behavior:**, **Proof:**, **Stop when:**.
2. Read the owning issue/specification, affected callers, `bug.md` and relevant
   active entries in `work.md`. Resolve only product or architecture choices that
   block the task; continue independent work. Do not invent identities or services.
3. Write observable acceptance cases before implementation. For behavior changes,
   write a focused failing test when there is a practical local target. Scale
   verification to the claim; trivial documentation edits need link/content checks.
4. Implement the smallest complete change. Keep validation and external I/O at
   adapter boundaries, calculations and policy pure, and UI faithful to `DESIGN.md`.
   Keep related backend logic together. Prefer idiomatic, strict TypeScript,
   discriminated unions and validated external inputs over casts and extra layers.
5. Run focused proof and the applicable checks in
   [verification](docs/operations/verification.md). Fix failures and repeat affected
   checks. Update durable docs, `bug.md` and `work.md`; compare evidence with the
   stop condition before claiming completion.

For a bug or large task, maintain a thread-specific heading in the existing local
`TODO.md`; preserve earlier entries. Keep new detailed plans, raw research and
scratch files in an OS temporary directory. `TODO.md` is historical tracked local
planning: leave new task plans unstaged. Durable summaries belong in `work.md`.

Record each new actionable steering request in [bug.md](bug.md), including requests
that are not defects. This is a triage inbox, not automatic authorization to fix
unrelated bugs. Link maintainer work to its GitHub issue/project item when one
exists; ask for tracker-write authority when missing, and record `unlinked` locally.

After a material correction, state the failed criterion, update the contract and
classify the lesson as one-off, project, shared or skill guidance. Propose reusable
guidance changes; edit it only when authorized. Keep learning mode off unless
explicitly requested; see [collaboration](docs/agents/collaboration.md).

## Authority and verification

- Create/switch branches, commit, push, open/merge PRs, publish, deploy, change shared
  settings or message others only when the user explicitly authorizes that action.
  Permission for a skill or review is not blanket permission for external actions.
- Run local checks before an authorized push. Never use CI as the first test run.
  No persistent dev service is provided; start only the local process a task needs.
- Do not verify with browsers, computer use or device automation unless the user
  explicitly agrees or requests it. Reuse consent within its stated scope. Without
  it, run non-UI checks and mark rendered/interactive behavior unverified.
- When authorized and available, prefer T3 Code preview/device tools. Otherwise
  use the available tools and disclose missing infrastructure. See
  [agent compatibility](docs/agents/compatibility.md). Do not assume T3 exists elsewhere.
- Do not send app data to a model, publish evidence, or scan remote systems as an
  incidental check. Local isolated fixture scans are documented in the DAST workflow.

## Task-specific guidance

| When | Read and use |
| --- | --- |
| Implementing an accepted feature or coordinating an SDLC task | [amr-sdlc](.agents/skills/amr-sdlc/SKILL.md) |
| Changing auth, data access, uploads, AI, costs, public endpoints or CI | [security requirements](docs/internals/security.md), then [amr-security](.agents/skills/amr-security/SKILL.md) |
| Running or configuring HTTP security scans | [amr-dast](.agents/skills/amr-dast/SKILL.md) |
| Investigating latency, rendering, traffic or cost | [amr-performance](.agents/skills/amr-performance/SKILL.md) |
| Diagnosing a defect or regression | [amr-debug](.agents/skills/amr-debug/SKILL.md) |
| Changing terminology, architecture or maintained documentation | [amr-docs](.agents/skills/amr-docs/SKILL.md) |
| Preparing, reviewing or explicitly delivering a PR | [file-pr](.agents/skills/file-pr/SKILL.md), [CONTRIBUTING.md](CONTRIBUTING.md) |
| Touching iOS navigation, controls, layout, permissions or accessibility | `docs/agents/apple-hig-findings.md` and `DESIGN.md`, when available; see the design status below |
| Working with issues, triage or domain decisions | [issue tracker](docs/agents/issue-tracker.md), [labels](docs/agents/triage-labels.md), [domain docs](docs/agents/domain.md) |

For new substantial UI directions, obtain a design selection before real components.
Use local static alternatives when needed; preserve accepted geometry for narrow
corrections. Do not add decorative branding, copy, menus or continuous repaint animations.
Match proof to the requested experience while honoring the consent rule above.

For phone UI implementation, use the installed gluestack UI components with
NativeWind v5 when a shared control is useful. Use Reanimated for custom motion;
keep motion task-driven and honor reduced-motion settings. The styling stack is
pre-release, so prove a component on both native platforms before relying on it
for product screens. Library setup does not select a final visual direction.

The design documents are currently separate, uncommitted work. Read them when
present. If absent from a checkout, obtain the accepted design inputs before UI
implementation; do not invent replacements or treat draft directions as approved.

## Attribution and handoff

Record work in [work.md](work.md). End agent-authored issue/PR comments, PR bodies
and work entries with `<Action> by <exact model ID> through <harness> (<host if known>).`
For example: `Edited by gpt-6-astra through Codex (T3 Code).` Use trusted runtime
metadata; ask if identity is unknown. Never infer a model variant from the app name.
Do not add attribution noise to every source-code comment.

Report observed states only: local changes, executed proof, failures, unverified
checks and external actions. Use `Outcome`, `Changed`, `Verified`, and
`External action` when applicable; add `Next` only when user action is needed.
