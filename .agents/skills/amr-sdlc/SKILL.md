---
name: amr-sdlc
description: Deliver an accepted AMR feature or repository change through scope, implementation, verification and handoff. Use for implementation; skip simple questions.
---

# amr-sdlc

Resolve repository paths from the Git root. Read the canonical skill through
.agents/skills even if discovered through a Claude link.

1. Read root AGENTS.md, bug.md, active work.md entries and the owning issue/spec.
   Confirm branch, dirty files, owned paths, available commands and authority.
2. State the five-line contract. Define inputs, success, error states and protected
   invariants. Ask only for blocking product choices. Keep deferred features deferred.
3. Choose the smallest structure consistent with existing callers and docs/DESIGN.md.
   Use docs/internals/security.md for changed trust boundaries. Obtain design
   selection before substantial new UI; this does not grant browser consent.
4. Write observable acceptance cases and a focused failing behavior test when a
   practical local target exists. Implement one complete slice and preserve
   unrelated work. Keep external validation/I/O at boundaries and policy pure.
5. Run relevant proof from docs/operations/verification.md. Fix actual failures,
   repeat affected checks, and inspect the final diff. Record unavailable proof.
6. Update durable docs, bug.md and work.md with exact attribution. Deliver only
   explicitly authorized external actions, following CONTRIBUTING.md.

Stop when the contract's acceptance evidence is satisfied and records match the
observed state. A plan, passing typecheck or synthetic scanner fixture alone
cannot complete a product feature. Report concrete blockers without broadening scope.

Written by gpt-6-astra through Codex (T3 Code).
