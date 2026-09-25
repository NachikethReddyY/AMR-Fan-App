# Documentation

| Area | Start here |
| --- | --- |
| Users | [Fan and admin experience](user/README.md) |
| Internals | [Architecture and status](internals/architecture.md), [security and privacy](internals/security.md) |
| Operations | [Setup and maintenance](operations/README.md), [verification](operations/verification.md), [security testing](operations/security-testing.md), [performance](operations/performance.md), [release](operations/release.md) |
| Contributors and agents | [Contributing](../CONTRIBUTING.md), [AGENTS.md](../AGENTS.md), [compatibility](agents/compatibility.md), [collaboration](agents/collaboration.md) |
| Product | [Roadmap](../ROADMAP.md), [specification](fan-app-specification.md), [glossary](../CONTEXT.md) |
| Work | [Steering and bugs](../bug.md), [work record](../work.md), [GitHub Issues](https://github.com/NachikethReddyY/AMR-Fan-App/issues), [Ideas](https://github.com/NachikethReddyY/AMR-Fan-App/discussions/categories/ideas) |

Keep one canonical home for each fact. `CONTEXT.md` defines product terms;
`docs/adr/` holds consequential accepted decisions when needed. Do not create
empty ADRs or duplicate the specification. New user documentation goes in
`docs/user/`, architecture in `docs/internals/`, and procedures in
`docs/operations/`. Existing source/reconciliation documents keep their paths.

Design work is separate and currently uncommitted. When present, consult root
`DESIGN.md` and `docs/agents/apple-hig-findings.md` before UI work. Obtain the
accepted design inputs if they are absent from your checkout.

Plans and raw research are temporary. Promote accepted conclusions and
source-backed decisions into maintained docs. Historical `docs/research/` and
`.scratch/` files are preserved, not a precedent for new scratch commits.

## Workflow vocabulary

| Term | Meaning here |
| --- | --- |
| SDLC | Scope, analyze, design, implement, verify, authorized delivery, maintenance. |
| Agent | The system doing a task with a model and tools. |
| Model | The exact provider model identifier, including its variant. |
| Harness | The program running the agent and its tools, such as Codex, Claude Code or Pi. |
| Host | The surrounding application, such as T3 Code. It does not identify the model. |
| Skill | A portable `SKILL.md` workflow read for a matching task. |
| SAST | Static application security testing of source without running the app. |
| SCA | Dependency analysis against known vulnerability advisories. |
| DAST | Dynamic application security testing against a running HTTP service. |
| Evidence | Observations or test artifacts supporting a specific acceptance claim. |
| Unverified | Required proof was not run or was unavailable. |
| Not applicable | A check has no relevant implemented target, with the reason recorded. |
| Maintainer-only | A local or restricted operation without a public untrusted-user entry point. |

Written by gpt-6-astra through Codex (T3 Code).
