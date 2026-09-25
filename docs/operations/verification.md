# Verification

Run local checks before an authorized push. CI repeats them after delivery; it
does not substitute for the first local run. Commands are defined in `package.json`.

| Change | Minimum relevant proof |
| --- | --- |
| Instructions/docs | `pnpm agents:check`, read affected links and check statements against code |
| Tooling/scripts | `pnpm test:tooling`, actual success and failure invocations, cleanup checks |
| TypeScript behavior | Focused behavior test, `pnpm check` and regression of protected state |
| Dependencies/native config | Frozen install, local checks and Expo iOS/Android exports |
| Auth/data/AI/public boundary | Applicable security matrix plus `pnpm security:check` |
| HTTP application | Real local production-like target plus `pnpm security:dast`; authenticated business tests separately |
| UI/interaction | Explicit user consent, then browser/device observation and focused tests |
| Performance | Comparable before/after measurements of the changed path |

`pnpm check` includes typecheck, lint, formatting, Jest, tooling tests and agent
structure validation. Jest's `--passWithNoTests` describes the starter's lack of
feature tests; tooling tests do not create product coverage. Historical planning
and unselected design artifacts are outside the formatting gate.

Without browser/computer/device consent, do not run those tools, including
headless browser automation or an Ajax spider. Record UI proof as unverified.
A typecheck cannot establish rendered behavior. HTTP-only local scanner requests
and container fixture tests are separate from browser automation.

Evidence records task, revision/worktree state, exact command or manual action,
environment, expected/observed result and limits. Keep raw logs/screenshots in
ignored `.evidence/<task>/`; retain a concise sanitized summary in `work.md`.
Never commit new PR screenshots or raw reports. Upload authorized, redacted PR
assets through GitHub and link them from the PR. Check attachment access first.

Stop when the acceptance evidence and applicable gates pass. Do not repeat broad
checks without a new change, failure or unresolved concern. Report unavailable
checks and baseline failures accurately.

Written by gpt-6-astra through Codex (T3 Code).
