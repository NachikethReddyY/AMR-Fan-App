# Issue tracker: GitHub

Issues and specs for this repo live in GitHub Issues. Use the `gh` CLI from this repo.

## Conventions

- Create: `gh issue create --title "..." --body-file <file>`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open`
- Comment: `gh issue comment <number> --body-file <file>`
- Add or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number>`

Infer the repository from its Git remote. Read the issue and comments when fetching
a ticket. Create, edit, comment, label or close only when the user's task authorizes
that action; a skill's publication step alone does not grant permission.

Active maintainer work belongs to an issue or project item. External proposals
start in [Ideas](https://github.com/NachikethReddyY/AMR-Fan-App/discussions/categories/ideas)
and follow `CONTRIBUTING.md`. Use `bug.md` for local steering and `work.md` for
durable progress. Record `unlinked` when tracker writes are outside the task.

## Pull requests as a triage surface

**PRs as a request surface: no.**
