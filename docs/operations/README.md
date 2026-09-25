# Setup and maintenance

Use the root [README](../../README.md) for pinned Node/pnpm and Expo setup.
There is no persistent dev service, backend deployment, provider key or admin web
server. Do not provision one as a side effect of checking the repository.

For a new checkout:

1. Confirm the branch and working tree; read `AGENTS.md`.
2. Run `pnpm install --frozen-lockfile`, then `pnpm check`.
3. Start Docker when security scanners are needed; run `pnpm security:check`.
4. Use [verification](verification.md) to select behavior proof for the change.
5. Read [security testing](security-testing.md) before DAST, and
   [release](release.md) before any authorized delivery.

If a prerequisite is missing, report the exact binary, access or service needed.
Do not invent credentials or silently install global services. Scanner images
are downloaded on first use; source scans run locally without source upload.

Dependency maintenance starts with the advisory and real call path. Prefer an
upstream compatible update, check release notes, install with pnpm and re-run the
affected behavior and native exports. Record low-exposure residual findings in
`bug.md`; high/critical dependency advisories fail the automatic gate.

For debugging, use [amr-debug](../../.agents/skills/amr-debug/SKILL.md). Preserve a
reproduction, distinguish app failures from tool/environment failures, and collect
only sanitized evidence under ignored `.evidence/<task>/`.

Written by gpt-6-astra through Codex (T3 Code).
