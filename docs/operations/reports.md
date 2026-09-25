# Local report review and approval

This owned slice supports [#19](https://github.com/NachikethReddyY/AMR-Fan-App/issues/19)
and [#20](https://github.com/NachikethReddyY/AMR-Fan-App/issues/20). Product rules
remain in [report ingestion](../features/11-report-ingestion.md) and
[Impact](../features/10-impact-dashboard.md). Shared API, root dependency and CI
registration are pending. The prepared admin page has not been observed in a
browser. Neither issue is complete.

## Source and approval rules

The local path accepts labelled synthetic text-layer PDFs, at most 10 MiB and
100 pages. It retains original bytes, SHA-256, parser version and exact page text.
Scans without usable text, malformed/password-protected PDFs and exceeded bounds
fail explicitly. There is no OCR, URL fetching or silent report truncation.
Mixed pages retain empty pages visibly; text extraction cannot prove visual
completeness or semantic correctness. Review the original source before approval.

Candidates retain literal name, value, unit, reporting period, category, meaning,
method, exact quote/page and UTF-16 offsets. Missing data remains null and listed
as missing. Approval requires name, value, unit, period and a literal supported
meaning cue with valid evidence. Category and method may remain explicitly
missing. The source does not require a closed category set. Values are never
converted to numbers, rounded or summed across units/periods.

Manual correction appends a reasoned revision; it cannot rewrite an earlier
revision. Approval/rejection identifies the exact current revision. Current
assigned-admin role and session are locked in the database. Session expiry is
checked with a fresh database clock after acquiring the session lock, before
replay/effects, and again before commit. Client role, actor and approval time
fields are refused. Approval identity/time come from the actual server action.

A replacement names the expected current approval. Its predecessor remains
visible until the transaction commits and remains in audit history afterwards.
Two competing replacements yield one successor; stale revisions/targets and
conflicting request replays fail. Rejection cannot remove an approved fact.
Retries return the stored outcome; repeated approval of an already decided
revision returns its existing decision without duplicating a figure.

Official reads contain approved snapshots only, with original unit/period,
evidence, source hash/parser version and reviewer/time. Synthetic examples remain
labelled and never claim to be Aston Martin facts. Personal/community estimates,
points and History are not read or changed by report operations.

## Parser dependency and limits

The reviewed local dependency is `pdfjs-dist@6.3.289`, Apache-2.0, on Node 24.20.0.
Registry integrity:

```text
sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==
```

It declares Node `>=22.13.0 || >=24` and an optional native canvas dependency;
the isolated install resolved `@napi-rs/canvas@1.0.9`. Lifecycle scripts were
disabled. The isolated dependency audit reported no known vulnerabilities.
Root package/lock changes remain with the shared integration owner. Do not
commit a second dependency installation or private test loader.

`createParser()` runs one child at a time per process. On this local macOS host,
`sandbox-exec` denies networking and file writes. The child receives no inherited
credentials. It reads PDF bytes from stdin and emits only bounded JSON. Limits:
10 seconds by default, at most 60 seconds configured; 384 MiB V8 old-space;
768 MiB sampled RSS stop threshold (50 ms checks); 8 MiB combined stdout/stderr;
1,000,000 parsed characters. RSS sampling is not a hard kernel memory partition
and may miss short peaks. Timeout/output/memory failures kill and wait for the
owned child before releasing the parser slot. Source text is not logged.

The current runner refuses non-macOS hosts. A Linux/Azure network-disabled
runner and cloud resource limits are an explicit deployment integration gate.
It does not silently fall back to unsandboxed parsing. The PDF.js binary-data and
text APIs are documented in the [upstream Node example](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs)
and [API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html).

## Storage and retention

Operations grants an absolute private directory per worktree and environment,
outside the repository/webroot. `createStorage({root})` requires real directories,
0700 root permissions and server-generated UUID keys. Files are 0600, exclusively
created, hash-checked and immutable. Source delivery requires assigned-admin
access and uses attachment/octet-stream, no-store and nosniff. The client title
is metadata, never a path. No original PDF is served inline in the admin origin.

The default local quota is 256 MiB. Quota exhaustion rejects a new source without
deleting old provenance. Only one writer per storage instance/process is allowed;
production multi-process quota coordination is not implemented. Incomplete
`.partial-*` files are removed on normal failure; `cleanupIncomplete()` removes
abandoned partial files older than one minute and never removes committed PDFs.
A committed original whose later DB authorization fails can remain unreferenced;
reconcile it manually, never delete automatically based on a missing DB row.

Retain committed synthetic originals and all approved provenance for this local
namespace's lifetime. Do not reset development storage or delete approved
provenance as a routine cleanup. Real-report retention, backups, account deletion,
public source access and Azure object storage require a separate decision and
configuration. This report-evidence purpose is distinct from transient AI media.

## Extraction remains a required pending capability

Use the existing singleton `createAi` with explicit server configuration.
`LUNA_REPORT_EXTRACTION_ENABLED` and `LAYA_ADVISORY_ENABLED` remain false. The
report slice makes no live inference calls or quality evaluations and changes no
AI module. Existing [quality evidence](../ai/evaluation.md) remains unchanged:
Luna fresh semantic 11/15, exact 6/15; Laya 25/36. Human approval remains required
after any future quality gate passes.

`extractCandidates` validates the existing adapter result again at the feature
boundary. It retains missing fields, versions and grounded evidence; malformed
results become a recoverable failure. Selection is at most 8 distinct pages and
12,000 total characters, with at most 24 candidates. Full source pages remain
available. A selected batch is not whole-report extraction. Completed retries
return before invoking the extractor. One feature extraction is active at a
time; no automatic retries or background queue exists. The default disabled
adapter persists an honest unavailable result. A process crash before an attempt
result commits leaves the source/review state intact; it does not create a
completed extraction record. The admin must retry explicitly.

Local tests use an explicitly labelled synthetic extractor at the injected test
boundary. They do not establish real extraction quality. Real-report upload is
closed by default; real provider transfer remains separately blocked until
permission/retention and quality are accepted. Never use a client permission
field to authorize a remote transfer.

## Shared registration contract

The shared API owner composes:

- `createReports({pool, storage, parser, extractReport})` once per API process.
- `serveReportsAdmin(path,res)` for the three allowlisted `/admin/reports/`
  assets. They reuse `/admin/style.css`; no shell/navigation change is needed.
- `handleReports({req,res,path,token,reports})` after existing origin/rate/bearer
  checks and before fallback 404. It returns false for unowned paths and throws
  `ApiError` for controlled failures. Every report operation reauthorizes itself.

| Endpoint | Behavior |
| --- | --- |
| `POST /v1/admin/reports` | Reserve immutable source identity with requestId/title/sourceKind |
| `GET /v1/admin/reports?after=UUID` | List up to 50 reports |
| `GET /v1/admin/reports/:id` | Admin source pages, revisions, decisions and extraction status |
| `PUT /v1/admin/reports/:id/source` | Uploader-owned raw PDF; streamed 10 MiB limit, exact type/signature |
| `GET /v1/admin/reports/:id/source` | Admin-only original attachment |
| `POST /v1/admin/reports/:id/extractions` | Bounded page selection and persistent result |
| `POST /v1/admin/reports/:id/candidates` | Manual source-backed initial revision |
| `POST /v1/admin/report-candidates/:id/revisions` | Append correction with expectedRevisionId |
| `POST /v1/admin/report-candidates/:id/decisions` | Exact revision, approved/rejected, expectedApprovalId and reason |
| `GET /v1/impact/official` | Authenticated fan/admin approved-only read, up to 100 figures |

JSON bodies retain a 4 KiB limit; PDF upload has its separate bounded reader.
A source quote plus fields must fit that request limit. Larger review payloads
are refused explicitly. The global API JSON reader is unchanged. The shared
owner must register parser storage startup/cleanup, dependency/test scripts and
CI/DAST configuration. Current report detail/history is intended for bounded local
synthetic use; production pagination/retention needs its deployment review.

The prepared admin uses existing synthetic account sign-in and server-assigned
roles. Tokens remain in memory. Real browser identity setup is still pending.
The page supports upload, source inspection/download, candidate entry/correction,
explicit approval/rejection/replacement and labelled approved records. Its visual,
keyboard and complete interaction acceptance is unverified until the real API
and a browser lease are provided.

## Verification and open gates

Run only with the allocated worktree test database/storage. Private isolated test
dependency resolution was used while the root lease was held. After integration,
use normal installed dependencies and the existing `db:run-test` wrapper:

```sh
node --test server/reports/contracts.test.ts server/reports/extraction.test.ts server/reports/disabled.test.ts
node --test --test-concurrency=1 server/reports/parser.test.ts server/reports/storage.test.ts
pnpm db:run-test -- node --test --test-concurrency=1 server/reports/reports.test.ts server/reports/http.test.ts
pnpm db:run-test -- node --test server/reports/registration.test.ts
```

Set `REPORT_TEST_STORAGE` to the exact operations-granted test directory, never a
peer/dev directory. Migration `0007_reports.sql` adds only `app.report_*` tables
and protection functions/triggers. The existing migration loader discovers it;
it does not depend on journeys/submissions/rewards migrations.

Observed local proof covers original table/multiline/Unicode/multiple-page PDFs,
malformed/blank/page/byte/text limits, timeout/busy recovery and actual loopback
network denial. PostgreSQL and HTTP tests cover exact hashes, corrections,
missing-field refusal, rejection, idempotency, concurrent replacement, stale
revisions, role/session revocation, unchanged-row expiry waits, immutable evidence,
source persistence across an actual API process restart and unchanged balances.
The combined owned run passed 28 tests. A later HTTP asset case brought the
distinct passing count to 29; the repeated five-case HTTP run is not five new
tests. Timeout termination and recovery were exercised. The 8 MiB output kill
and sampled 768 MiB RSS kill are implemented but were not forced by these PDF
fixtures. No hard peak-memory bound is claimed.

Root integration needs the exact PDF.js dependency above in `package.json` and
`pnpm-lock.yaml`, with the existing supported Node 24 runtime. Add report unit
and database scripts to the shared check workflow; serialize parser-backed test
files. `.github/workflows/checks.yml` currently runs on Ubuntu, where this local
parser intentionally refuses execution. The integration owner must provide a
network-disabled Linux runner with enforced resource limits, or retain an
explicit platform gate and run real parser acceptance on macOS. Do not mark
Linux upload acceptance green by substituting a fake parser.

`server/api/Dockerfile` already copies `server`, so it includes report assets and
the migration after integration. Its Linux scanner target still needs explicit
private storage provisioning, parser availability policy and cleanup in
`server/api/dast-start.ts`. Migration discovery needs no filename registration.
The shared API composition in `server/api/app.ts`, storage startup configuration
in `server/api/start.ts`, and authenticated report coverage for
`.github/workflows/security.yml`/`security/dast-target.json` remain queued. Source
and dependency security checks, actual upload DAST and the rendered admin flow
must be verified after registration; this slice does not change those files.

`registration.test.ts` deliberately requires the real `createApi` report route.
It currently fails with 404 instead of 200, independently of passing module
HTTP tests. Do not skip it or claim the feature is integrated. Root full checks,
application DAST, rendered admin flow, complete fan Impact integration, live
extraction quality, provider/Azure deployment and phone accessibility remain
unverified or pending their owners. No PR/merge/deployment completion is claimed.

Implemented by gpt-6-astra through Codex (T3 Code).
