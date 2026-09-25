# Agent compatibility

All agents start with root `AGENTS.md`; shared skills live in
`.agents/skills/*/SKILL.md`. Six `amr-*` workflows cover the project lifecycle,
security, DAST, debugging, performance and documentation. Nine supporting skills
cover PRs, review, testing, design and agent instructions. No personal
paths, credentials, subscriptions, plugins or T3 services are required by the
project workflow.

| Agent | Instruction entry | Skill discovery |
| --- | --- | --- |
| Codex | Root `AGENTS.md` | `.agents/skills/` |
| Claude Code | `CLAUDE.md` imports `@AGENTS.md` | `.claude/skills/*` links to all canonical skills |
| Pi | Root `AGENTS.md` | Current Pi discovers `.agents/skills/`; older versions can use `--skill .agents/skills/amr-sdlc` |
| Other agents | Explicitly read `AGENTS.md` when discovery is absent | Read its linked skills directly |

Start in the repository, review files before accepting workspace trust, and run
`pnpm agents:check`. If checkout tooling materializes symlinks as text, read the
canonical skills directly or enable Git symlink support. Do not maintain copied
skill bodies. `.agents/` is eligible for version control. `.agents.local/` is
ignored personal material, not an automatically discovered skill location; load
its files explicitly when needed. Shared skill names, descriptions and Claude
links are checked; this does not execute their individual workflows. The project contract overrides
imported skill defaults for consent and authority.
Personal instructions and disabled discovery can still affect agent behavior;
this setup cannot guarantee compliance by every model.

Keep this set focused on work the AMR app needs. Prefer an existing workflow over
another skill for the same task. `file-pr` is the sole PR workflow; `amr-debug`
owns diagnosis and `amr-sdlc` owns implementation. Classroom exercises, article
writing, personal agent handoffs and one-time setup skills are outside this set.

For onboarding, ask the agent to identify the stop condition, browser-consent
rule and applicable skill. Syntax validation does not prove instruction adherence.

## Tools and identity

The baseline is Git, pinned Node/pnpm, shell file access and Docker for scanners.
`gh` is optional for authorized GitHub work. Check binaries, access and
connectivity first. Never infer credentials or invoke a paid model to fill a gap.

T3 Code is optional. With explicit consent, use preview status/open, snapshots
and focused interactions for browsers. For devices, list/open through T3 and
keep the exact session/config flags it returns. Without T3, disclose available
tools and missing proof. No browser, computer use or device automation is implicit.

Use trusted runtime metadata for the exact model and harness.
`gpt-6-astra through Codex (T3 Code)` identifies three different things.
Ask the user if identity is unknown; a family name or previous session is insufficient.

Discovery conventions checked on 25 September 2026:
[Codex](https://developers.openai.com/codex/skills),
[Claude imports](https://code.claude.com/docs/en/memory),
[Claude skills](https://code.claude.com/docs/en/skills),
[Pi skills](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md).
Recheck installed-version behavior when changing adapters. This source check
does not mean a paid agent session was run.

Pi 0.84.4 was also checked through its offline RPC command discovery with an
isolated user configuration before the skill cleanup: all seven original `amr-*`
skills appeared automatically. No model request was sent. Claude's import and
the remaining 15 links were checked on disk;
the Claude CLI was unavailable for an actual loader check.

Written by gpt-6-astra through Codex (T3 Code).
