# Contributing

Read [AGENTS.md](AGENTS.md), the [documentation index](docs/README.md) and
[roadmap](ROADMAP.md). Keep scope small and preserve accepted product behavior.
The repository's visibility is a maintainer decision.

## Proposals, bugs and ownership

External proposals start in
[Ideas](https://github.com/NachikethReddyY/AMR-Fan-App/discussions/categories/ideas):
describe the user problem, smallest useful result, alternatives and acceptance
evidence. Discussion is not implementation approval. Accepted maintainer work
belongs in a GitHub issue or project item with an owner.

Report reproducible non-sensitive bugs using the issue template. Security reports
follow [SECURITY.md](SECURITY.md). Agents capture steering in `bug.md` and durable
work in `work.md`; these do not replace the owning issue. If tracker write
permission is absent, mark the local work unlinked instead of creating an issue.

## Local work

Use pnpm and the versions in `package.json`/`.node-version`. Plan the acceptance
behavior, add a focused test when appropriate, then implement and verify.
Run `pnpm check` and applicable [security checks](docs/operations/security-testing.md)
before any push. UI verification requires explicit consent. Keep plans, raw
research, screenshots and scratch files out of new commits; promote accepted
decisions into maintained docs.

## Pull requests

An agent opens a PR only when the developer explicitly asks. A request to review
or prepare a PR does not authorize opening, pushing, merging or deployment.

- Address one concern. If the description contains an independent "also", split
  the concerns into separate proposed PRs before delivery.
- Use a Conventional Commit title in plain language, for example
  `fix(web): new threads no longer spike CPU`.
- Describe the problem in one or two sentences, the fix, then evidence and limits.
  End with the exact authoring model and harness.
- Link the owning issue. Use a real PR for review when creation is authorized.
  Update against current main before opening; do not overwrite others' work.
- Upload authorized, sanitized screenshots/assets to GitHub and link them in the
  body. Do not commit PR-only assets, raw scanner output or implementation plans.
- Apply one size label using added plus deleted maintained lines:
  `size/XS` at 0–49, `size/S` at 50–199, `size/M` at 200–499,
  `size/L` at 500–999, `size/XL` at 1,000+. Exclude generated files and lockfiles;
  report their size separately. Use existing labels; creating labels needs authority.
- Request the repository owner's review when PR delivery is authorized. Do not
  invent a reviewer or request self-review. If the author is the only known owner,
  ask the maintainer for another eligible reviewer.
- Monitor checks and review bots on the latest commit. Verify findings, fix valid
  issues within authorized scope, and rerun checks after each pushed change.
  Report false positives with evidence. Do not claim completion while checks are
  pending or red. Merge only when explicitly requested.
- In T3 Code, register each worked-on PR with the available linking tool and
  verify the thread's PR list before handoff.

After merge, close/update the owning issue and work record when that action is
authorized. The merged PR is the implementation record, not a new planning document.

Attribution format: `Edited by <exact model ID> through <harness> (<host if known>).`
Use trusted runtime metadata; ask when unknown. A family name such as "GPT-6"
does not identify its variant.

Written by gpt-6-astra through Codex (T3 Code).
