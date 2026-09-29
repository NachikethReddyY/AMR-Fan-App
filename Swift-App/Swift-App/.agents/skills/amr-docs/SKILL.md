---
name: amr-docs
description: Maintain AMR product terminology, architecture, operating procedures and agent instructions. Use for durable documentation changes and implementation handoffs.
---

# amr-docs

Resolve repository paths from the Git root. Read the canonical skill through
.agents/skills even if discovered through a Claude link.

1. Read AGENTS.md and docs/README.md. Identify the authoritative fact and its
   current code/spec source. Preserve accepted terms and unresolved decisions.
2. Put product definitions only in CONTEXT.md; architecture/status in
   docs/internals; user behavior in docs/user; procedures in docs/operations.
   Record a consequential accepted tradeoff in docs/adr only when needed.
3. For agent instructions, keep AGENTS.md canonical and CLAUDE.md an import.
   Keep skills under .agents/skills/<name> and Claude links pointing to them.
   Use conditional pointers so detailed security guidance is read when relevant.
4. Distinguish implemented behavior, accepted plans, open decisions and observed
   evidence. Promote durable conclusions, not raw research or temporary plans.
5. Run pnpm agents:check, inspect affected links and reconcile claims with code.
   Update roadmap/work/bug records where their status changed.

Stop when each changed fact has one maintained home, readers can reach it, and
status claims agree with implementation. Do not rewrite unrelated historical
documents or require a paid agent/browser run for a small documentation edit.

Written by gpt-6-astra through Codex (T3 Code).
