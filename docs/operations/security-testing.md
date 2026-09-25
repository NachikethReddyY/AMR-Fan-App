# Security testing

The checks run locally and in GitHub Actions after authorized delivery.
Docker is required for scanners; no scanner account or production secret is
needed. Image digests are pinned in `security/tools.json`; actions are pinned in
workflow files. Update pins deliberately and re-run positive/negative fixtures.

## Commands and coverage

| Command | Actual check | Failure or limitation |
| --- | --- | --- |
| `pnpm security:secrets` | Gitleaks on tracked and non-ignored new files in a temporary snapshot | Findings fail; ignored local files and Git history are not scanned |
| `pnpm security:sast` | Four project Semgrep rules for dynamic execution, disabled TLS, public provider keys and raw HTML | Matches/parser/config errors fail; this is a focused rule set, not full vulnerability coverage |
| `pnpm security:audit` | pnpm dependency advisories, including tooling dependencies | High/critical findings or registry failure fail; lower severity stays visible for triage |
| `pnpm security:self-test` | Real scanners accept clean input and reject synthetic secrets/unsafe code | Scanner/fixture failure fails; no product behavior is tested |
| `pnpm security:check` | All source/dependency checks above | Requires Docker and registry connectivity |
| `pnpm security:dast` | ZAP against the configured application container | No target reports NOT APPLICABLE with exit 2; never an application pass |
| `pnpm security:dast:self-test` | ZAP accepts a safe synthetic server and rejects an unsafe one | Scanner evidence only, explicitly separate from application DAST |

Scanners receive a read-only temporary snapshot, with no host credentials or
Docker socket. Gitleaks output is redacted. Source scans disable networking and
Semgrep metrics/version checks. The dependency audit sends package/version
metadata to the package registry; it does not send source or user data.

There is currently one triaged moderate tooling advisory in [bug.md](../../bug.md).
No broad advisory ignore list is configured. For release/history cleanup, scan
the relevant Git history separately with Gitleaks and rotate any exposed secret;
a clean working-tree scan says nothing about earlier commits.

## DAST target and isolation

`security/dast-target.json` currently records `not-implemented` because no
HTTP application exists. Do not replace it with Metro or the scanner fixture.

When an accepted admin/API implementation is ready, set `status` to
`implemented` and `target` to its repository-relative `dockerfile` and
integer `port`. The image must start a production-like, self-contained test
service on `0.0.0.0`, with synthetic data and controlled provider adapters.
Example configuration shape, not a current file path:

```json
{
  "status": "implemented",
  "target": { "dockerfile": "web/Dockerfile", "port": 3000 }
}
```

The runner builds from the source snapshot, creates a uniquely named internal
Docker network, waits for HTTP readiness and runs ZAP's traditional spider plus
passive scanner. It publishes no host port and cannot reach the internet from
the scan network. Only the report directory is writable. Containers, image and
network are removed afterward. Build-time dependency downloads still need
network access. No live provider calls or production data belong in this target.

No Ajax/browser scan is used. Browser or device automation needs explicit
consent. Active attack scans and remote/staging targets require a separately
authorized scope and are not supported by this runner.

ZAP configuration promotes selected cookie/header findings to FAIL.
The runner also blocks medium/high risk alerts. Other low/informational findings
remain visible for proportionate triage. Missing/malformed reports, empty sites,
startup errors and scanner failures fail closed. An alert-free unauthenticated
crawl does not prove protected routes, authorization, points integrity or mobile
storage. Add real actor/operation tests for those boundaries.

## CI and evidence

Quality checks run on pull requests and pushes to main. Security checks run there and
weekly, with explicit manual dispatch available. The DAST self-test always proves
scanner behavior; the application job reports not applicable until a real target
is configured. The first application implementation must activate it in the same
change, with its own boundary tests.

CI publishes an explicit applicability summary and skips the application scan
step when no target exists. A green `dast-tooling` job proves the scanner only.
`node scripts/security.mjs dast-status` reports configuration without scanning.

PR jobs use read-only permissions, no project secrets and no
`pull_request_target` execution. CI does not create issues, request reviews,
post comments, push fixes or deploy. Workflows become active only after an
authorized push; adding local YAML does not establish a green hosted run.

Reports go under ignored `.evidence/security/`. CI uploads only synthetic
scanner fixture reports with short retention. Keep application reports local
unless their disclosure is authorized and reviewed. Before a public release,
check the artifact/attachment audience and scrub private URLs or identifiers.

After a finding, reproduce the actual path, fix the cause, run the focused
regression and repeat the relevant scan. Record real scope, routes, findings,
confidence and limits before recommendations. Never label the entire app secure.

Primary references:
[ZAP baseline and exit codes](https://www.zaproxy.org/docs/docker/baseline-scan/),
[local Semgrep rules](https://semgrep.dev/docs/running-rules),
[Gitleaks](https://github.com/gitleaks/gitleaks),
[GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use).
Checked 25 September 2026.

Written by gpt-6-astra through Codex (T3 Code).
