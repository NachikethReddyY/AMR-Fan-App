# Steering and bug inbox

Record every actionable request, correction or reproducible finding here.
Read open entries at task start. Keep stable IDs and link the owning issue when
available. An entry does not authorize unrelated work. Sensitive findings follow
[SECURITY.md](SECURITY.md), with only a sanitized reference here.

| ID        | Kind and source                     | Acceptance criterion                                                                                   | Owner / tracker                               | Status                                                   |
| --------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------- |
| AGENT-001 | Repository setup, 2026-09-25        | Canonical instructions, portable skills, SDLC docs and local/CI security checks with accurate coverage | gpt-6-astra through Codex (T3 Code); unlinked | Verified locally; hosted CI pending delivery             |
| AGENT-002 | Verification constraint, 2026-09-25 | Browser/computer/device use requires consent; security proportional to exposure                        | AGENT-001                                     | Verified in guidance; no UI automation used              |
| AGENT-003 | Licensing correction, 2026-09-25    | No licensing addition; remove any task-added MIT license                                               | AGENT-001                                     | Honored; no license was added                            |
| AGENT-004 | Skill-folder correction, 2026-09-25 | Keep skills discoverable in `.agents`; remove its Git ignore rule; ignore optional `.agents.local/`    | AGENT-001                                     | Verified; final skill set follows AGENT-006              |
| AGENT-005 | Local delivery, 2026-09-25          | Commit the verified setup without unrelated design work, temporary plans or a push                     | gpt-6-astra through Codex (T3 Code); unlinked | Verified for local commit; no push authorized            |
| AGENT-006 | Skill cleanup, 2026-09-25           | Add `file-pr`; remove unrelated and redundant skills, repair references and Claude links               | AGENT-005                                     | Verified: 15 skills and matching Claude links            |
| AGENT-007 | GitHub delivery, 2026-09-25         | Commit and push the verified setup to `origin/main`; preserve separate design work and local plans     | gpt-6-astra through Codex (T3 Code); unlinked | Push authorized; supersedes AGENT-005's local-only scope |
| SEC-001   | Dependency audit, 2026-09-25        | Reassess UUID advisory when Expo/xcode or affected callers change                                      | Unassigned; local tracking                    | Triaged; moderate build-tool dependency                  |

## SEC-001: UUID in Xcode tooling

`pnpm audit` reports [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
for `uuid@7.0.3` through Expo's `xcode` dependency. Affected methods are
`v3`, `v5` and `v6` with caller-supplied buffers. The installed Xcode caller
uses `uuid.v4()` without a buffer. No app call to affected APIs exists in the
starter. The advisory remains visible, with no global suppression.
Recheck when dependencies or callers change. High/critical advisories fail the
automated gate; lower severities need exposure-based triage, not blind upgrades.

Edited by gpt-6-astra through Codex (T3 Code).
