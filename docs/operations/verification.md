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

## Black Box runner pilot

[`black-box-smoke.yml`](../../.github/workflows/black-box-smoke.yml) is a
manual, owner-only pilot for the WSL runner. It runs `pnpm awards:test`: five
existing cases covering award rounding and caps, compatible emissions factors,
assessed travel, limited fallback awards and unavailable evidence. It does not
start PostgreSQL, Docker or an application service.

The job requires `self-hosted`, `linux`, `x64` and `black-box-linux` labels.
It accepts a full `commit_sha`, verifies the checkout matches it, uses the
repository's Node/pnpm versions and frozen lockfile, and caches the pnpm store.
A test failure fails the job. There is no paid provider or fallback; an offline
runner leaves the job queued subject to GitHub's queue limits.

After an authorized delivery adds this workflow to the default branch, the
repository owner can dispatch a reviewed commit through GitHub Actions or:

```sh
gh workflow run black-box-smoke.yml \
  --repo NachikethReddyY/AMR-Fan-App \
  --ref main \
  -f commit_sha=FULL_REVIEWED_COMMIT_SHA
```

Only run trusted commits on the persistent home PC. The workflow uses
`contents: read`, pinned actions and no persisted checkout credentials. Both
the initial dispatcher and a rerun's actor must be the repository owner.
Manual dispatch requires the workflow on the default branch, as described in
[GitHub's manual workflow guide](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

Acceptance: GitHub reports the requested SHA in the run summary, the
`award-policy` job succeeds on `black-box-vbook`, and test failures return a
failed result. Cache reuse requires a second live run. Local test results do
not establish any of these live observations.

This pilot has a separate filename and run name from the Worker's
`black-box-ci.yml` contract. It does not satisfy the Worker's four required
checks or replace its signed-event, D1 queue or check-reporting paths. Existing
workflows and their enable/disable state are preserved. Full migration remains
separate work under the private
[Black Box migration checklist](https://github.com/NachikethReddyY/black-box-ci/blob/main/templates/MIGRATION_CHECKLIST.md).

Written by gpt-6-astra through Codex (T3 Code).
