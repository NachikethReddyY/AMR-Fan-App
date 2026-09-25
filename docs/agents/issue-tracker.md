# Issue tracker: GitHub

Issues and specs for this repo live in GitHub Issues. Use the `gh` CLI from this repo.

## Conventions

- Create: `gh issue create --title "..." --body-file <file>`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open`
- Comment: `gh issue comment <number> --body-file <file>`
- Add or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number>`

Infer the repository from its Git remote. When a skill says to publish to the issue tracker, create a GitHub issue. When it says to fetch a ticket, read the corresponding issue and its comments.

## Pull requests as a triage surface

**PRs as a request surface: no.**
