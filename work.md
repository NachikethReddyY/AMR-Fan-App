# Work record

Keep compact entries: date, issue/inbox ID, maintainer or agent, owned area,
outcome, proof, limits and external actions. Do not paste transcripts, credentials,
raw research or detailed implementation plans. Update after a material change
and before handoff.

## 2026-09-25: portable agent workflow and security setup

- Owner: gpt-6-astra through Codex (T3 Code). Maintainer request: Nachiketh.
- Tracking: AGENT-001 in `bug.md`; unlinked because no issue creation was requested.
- Owned area: root guidance, new documentation/skills, security tooling, GitHub
  templates/workflows and focused check configuration.
- Protected work: design artifacts, product specification, existing glossary
  meanings, historical TODO entries and starter behavior.
- Status: implemented and verified locally. Existing unselected design artifacts
  remain unchanged and are excluded from code formatting. Dependency audit found
  the triaged moderate tooling advisory SEC-001; no advisory is suppressed.
- Initial setup external action: enabled requested GitHub Discussions and read back the Ideas
  category. Repository remains private. No post, issue, PR, commit, push, deployment
  or browser/device verification.
- Correction: licensing scope withdrawn; classified as one-off task scope.
  No license file or package license field was added.
- Correction: the skill-folder criterion is automatic discovery. The user chose
  `.agents` after learning `.agents.local` is not a standard loader path.
  Classification: project guidance. Removed `.agents` ignore rules, retained
  `.agents.local/` for optional personal material, and restored the 38 existing
  skills without overwriting the seven new ones. Claude links cover all 45.
- Proof: `pnpm check` passed, including seven runner tests and 45 skill/link checks.
  Frozen installation and checks passed in a fresh temporary source copy without
  the original dependencies or private config. iOS and Android exports passed.
  Gitleaks found no source secrets; four Semgrep rules found no source findings;
  clean/unsafe scanner fixtures passed, including all four source rules.
  ZAP 2.17.0 accepted the safe HTTP fixture and rejected the unsafe fixture with
  two medium alerts and one explicitly blocking header alert. Resource cleanup
  was checked. Actionlint accepted both workflow files.
- Compatibility proof: Pi 0.84.4 discovered all seven AMR skills through offline
  RPC without a model request. All 45 skill names/descriptions and Claude links
  were validated. Claude CLI behavior remains unverified because it is unavailable.
- Limits: hosted CI awaits an authorized push. Application DAST is not applicable:
  there is no HTTP app, backend or AI pipeline yet. Their security requirements
  are documented, not claimed implemented. Browser/device checks were not requested.
  Existing general skills were preserved, not all behavior-tested.
- Evidence: local `.evidence/agent-workflow/verification.md` and
  `.evidence/agent-workflow/results.json`; raw scanner reports remain ignored.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: focused skills and authorized local delivery

- Owner: gpt-6-astra through Codex (T3 Code). Maintainer request: Nachiketh.
- Tracking: AGENT-005 and AGENT-006; unlinked because no issue creation was requested.
- Correction: preserving every imported skill failed the requested relevance
  criterion. Classified as project guidance. Keep workflows used by this app
  and consolidate overlapping task entry points.
- Changed: added the requested `file-pr` from the installed skill, with project
  contribution rules. Removed 31 unrelated or overlapping skills and their Claude
  links, including duplicate PR, implementation and diagnosis workflows, classroom
  exercises, article writing, personal handoffs and one-time setup. Fifteen skills
  remain. Removed files have a temporary local backup outside the repository.
- Protected: global skills, app code, dependency lockfile, existing design work
  and historical task records. Design references now identify those separate
  uncommitted inputs so the workflow commit does not depend on unstaged files.
- Delivery scope: the user authorized a local commit only. No push or PR.
- Proof: `pnpm check` and `pnpm security:check` passed after cleanup. All 15 skill
  names, descriptions and matching Claude links passed validation; `file-pr`
  passed the skill validator. A fresh snapshot of the staged files passed frozen
  installation and `pnpm check` without the separate design files or local task
  edits. The existing moderate dependency advisory remains tracked as SEC-001.
- Status: verified for the authorized local commit. Git history records delivery;
  hosted CI remains unverified until a separately authorized push.

Edited by gpt-6-astra through Codex (T3 Code).

## 2026-09-25: GitHub delivery authorization

- Owner: gpt-6-astra through Codex (T3 Code). Tracking: AGENT-007; unlinked.
- The user requested committing and pushing the completed setup. Implementation
  commit `82efb87` already exists. This authorization supersedes the earlier
  local-only delivery scope and targets the configured `origin/main` on GitHub.
- Preflight: authenticated GitHub access; remote main is the implementation
  commit's parent. The app and dependency lockfile remain unchanged. Separate
  design files and local `TODO.md` edits are excluded from delivery.
- Proof: the implementation passed local checks, security scanner tests and a
  fresh staged-snapshot install/check. Delivery repeats the applicable local
  gates before pushing; GitHub's branch and Actions runs record the remote result.
- Scope: push the setup and this authorization record. No PR, deployment,
  repository visibility change or browser/device verification was requested.

Edited by gpt-6-astra through Codex (T3 Code).
