# Report review, retention and hosted parser preparation

The registered API and separate admin page implement the local upload, manual
review, correction and explicit approval path for [#19](https://github.com/NachikethReddyY/AMR-Fan-App/issues/19)
and [#20](https://github.com/NachikethReddyY/AMR-Fan-App/issues/20). Neither issue is
complete: representative extraction quality, production identity/storage policy
and the phone Impact integration remain with their respective owners. Product
rules remain in [report ingestion](../features/11-report-ingestion.md) and
[Impact](../features/10-impact-dashboard.md).

## Source and approval rules

Assigned admins can upload permitted or explicitly labelled synthetic text-layer
PDFs, at most 10 MiB and 100 pages. The server keeps new PDF bytes only in
bounded request memory, then retains SHA-256, original byte count, parser version
and exact page-labelled text after a successful database commit. Malformed/password-protected/image-only PDFs
and exceeded bounds fail explicitly. There is no OCR, URL fetching or silent
truncation. Empty pages in a mixed report remain visible. Text extraction cannot
prove visual completeness or semantic correctness; review the original source.

Candidates retain literal name, value, unit, reporting period, category, meaning,
method, exact quote/page and UTF-16 offsets. Missing data remains null and listed
as missing. Approval requires name, value, unit, period and a literal supported
meaning cue with valid evidence. Category and method may remain explicitly
missing. The specification does not require a closed category set. Values are
never converted to numbers, rounded or summed across units/periods.

Corrections append reasoned revisions. Approval/rejection identifies the exact
current revision. Assigned-admin role and session are locked in PostgreSQL;
expiry is checked with a fresh database clock after the session lock, before
replay/effects, and again before commit. Actor and approval time come from the
server. A replacement names the expected current approval. The predecessor
remains visible until commit and remains in audit history afterwards. Competing
replacements yield one successor. Stale revisions/targets and conflicting
request replays fail. Rejection cannot remove an approved fact. Retrying the
same decision returns its stored outcome without duplicating a figure.

Official reads expose approved snapshots with original unit/period, evidence,
source hash/parser version and reviewer/time. They require an authenticated
fan/admin; retained source text and unpublished review data require assigned-admin access.
Synthetic examples stay labelled. Report operations never write points/balances
or combine official figures with personal/community estimates.

## Parser and supported local runtime

The root dependency is exactly `pdfjs-dist@6.3.289`, Apache-2.0, tested with Node
24.20.0 and pnpm 12.6.0. Its declared Node range is `>=22.13.0 || >=24`.
The frozen root lock also pins optional `@napi-rs/canvas@1.0.9`. Integrity:

```text
sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==
```

`REPORT_PARSER_MODE=docker` runs the actual worker in one disposable Linux child
per API process. `REPORT_PARSER_IMAGE` must be an immutable local `sha256:` image
ID. The adapter never pulls images. The owned Dockerfile reuses the root frozen
lock, disables install scripts, and pins this base:

```text
node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
```

The host API calls its trusted Docker CLI. Each child receives bounded PDF stdin
and returns bounded JSON stdout. It has no network, host mounts, published ports,
credentials or Docker socket. It runs as `node`, with a read-only root, dropped
capabilities, no-new-privileges, a 16 MiB temporary directory and disabled logs.
Limits are 256 MiB kernel memory with no swap, one CPU and 64 PIDs. The parent
limits combined stdout/stderr to 8 MiB, extracted text to 1,000,000 characters,
and parsing to 10 seconds by default. The configurable Docker parsing deadline
is at most 45 seconds; bounded readiness/create/cleanup commands keep the whole
operation within 59 seconds. Containers are created before attach so cleanup can
identify even an interrupted job. Failure to confirm removal keeps the parser
slot closed. Missing image/daemon access returns bounded 503; it never falls
back to unsandboxed parsing. Client input cannot select a runtime or image.

The default `native` mode is macOS-only. `sandbox-exec` denies network and file
writes; the child receives no inherited credentials. It uses 384 MiB V8 old-space,
a 768 MiB RSS stop threshold sampled every 50 ms, the same 8 MiB output limit,
and a 10-second default deadline (maximum 60 seconds). Heap plus sampled RSS is
**not a hard kernel memory ceiling**. A failed RSS measurement fails closed;
a 50 ms grace permits a normal exit notification to arrive before rejection.
Timeout/output/memory failures reap the child before releasing the slot.
Unsupported native platforms return 503.

The host CLI path is verified on the Docker-equipped macOS host. Linux CI is
configured to run the same offline child; its hosted result is not yet observed. The ordinary API Docker image does not get a socket or host credentials;
without a separately approved job controller it cannot launch these children.
Cloud/Azure execution remains unconfigured. Do not infer a deployment architecture
from the local image or enable privileged container access to make it work.

### Observed boundary evidence

The current native run passes 11 tests: five PDF regressions and six controlled
process cases. Timeout, output overflow, RSS overflow and abrupt child exit all
recover to a subsequent real parse. Unsupported platform and failed RSS
measurement refuse. Earlier retained observations recorded 8,585,216 output
bytes at kill and 817,808 KiB RSS against the 768 MiB threshold. Pipe/sampling
overshoot is expected; these are not exact peak bounds.

The earlier offline Linux proof passed seven assertions, including an allocator
bounded to 320 MiB, kernel OOM and recovery. Its actual cgroup values were
`memory.max=268435456`, `memory.swap.max=0`, `pids.max=64` and
`cpu.max="100000 100000"`. SIGKILL occurred after 387 ms; `oom_kill` rose from 0
to 1 and `memory.peak` was 268,435,456 bytes. That historical fixture used separate
read-only synthetic input/output mounts, unlike the current mount-free adapter.

Current container tests inspect an **actual adapter-created parser job** with the
same kernel limits and no mounts/network. They prove real two-page Unicode
extraction, deadline termination/recovery, missing-image refusal, bounded
100-page extraction and removal. Registered HTTP tests and the rendered admin
also prove missing-image failure/recovery without changing approved figures.
The old OOM evidence is retained by commit lineage; it is not presented as a new
OOM invocation through HTTP or evidence that every large PDF fits 256 MiB.

## Storage and retention

New uploads do not call object storage. The request accepts at most 10 MiB, binds
its SHA-256 and byte count to the reservation, parses in memory, then commits all
page text and parser provenance in one PostgreSQL transaction. Parsing failure
leaves no stored PDF; retry requires the same original file. A changed source
requires a new reservation. Failed text persistence rolls back the review/pages
transaction and preserves all prior approvals.

Once pages commit, removal of any pre-upgrade original follows. Removal failures
remain visible and retryable. A completed same-hash upload retry skips the parser,
retries legacy deletion and returns saved pages. A per-document database advisory
lock serializes uploads across API processes; a process-local slot bounds active
uploads without exhausting the database pool. Admin role/session checks remain
inside each authorized database operation. Approval/revision policy is unchanged.

`GET .../:id/source` now returns a UTF-8 plain-text attachment, `.txt`, with title,
document ID, source kind, original hash/byte count, parser version and exact text
under numbered page labels. It reads PostgreSQL, never downloads the PDF. Text
has no HTML interpretation; delivery retains no-store/nosniff and admin guards.
Admin download copy and extension follow this contract. Reviewers can compare
text with their own original file; image-only content remains unsupported.

The existing private local/Supabase storage adapter remains for legacy cleanup.
Its immutable object writes are no longer on the upload path. On report runtime
initialization and each report operation, a bounded sweep deletes originals for
committed review documents. `REPORT_FAILED_UPLOAD_TTL_SECONDS`, with the accepted configurable
24-hour default (86400 seconds), expires remaining legacy objects from their original creation time;
retries never extend it. This is a legacy-only policy chosen by root under the user's no-further-decisions
instruction. Cleanup skips actively locked uploads. An idle-service cleanup schedule
remains a deployment prerequisite, so idle expiry is still unverified. New uploads do not
depend on that duration because they persist no PDF. Storage backups/versioning
and provider deletion guarantees still need the release owner's confirmation.

The local adapter requires a granted absolute real directory, 0700 root and 0600
UUID files. Symlinks and unexpected entries fail closed. Supabase retains its
private bucket validation and exact-project server credential boundary. Inventory
and deletion responses are bounded; deletion is idempotent and confirmed absent.
No migration or new storage bucket is part of this candidate.

## Hosted parser candidate and readiness

Hosted processing is required. `REPORT_PARSER_MODE=hosted` selects the fixed HTTPS
adapter and never falls back to native/Docker/unsandboxed parsing. Missing hosted
configuration fails on parsing, while durable review/approval reads stay usable.
The service receives only a public job-verification key; the API holds the private
signing key. Short-lived signed jobs bind audience, UUID, source hash and bytes.
Both response association and page/text bounds are revalidated by the API.

The [service artifact and exact trial proposal](../../services/api/reports/hosted/README.md)
describe the credential-free Docker service, Landlock/seccomp launcher, strict
readiness checks, default-disabled synthetic-only trial endpoint, and cleanup.
The root must review the exact candidate before cloud creation. Zero spend must
be established by the release owner before creating one temporary Render Free
service. No paid resource, shared environment group or provider inference belongs
to this trial.

The accepted resource ceiling is 512 MiB service-wide, including parser parent
and child. Actual Render AMD64 kernel isolation, service memory peaks, resource
failure/restart behavior and representative format limits are not yet proven.
The earlier local ARM64 probe does not satisfy this gate. Do not set either
host-verified image approval value until the root accepts supported-host evidence
and independent sandbox review. This candidate does not complete hosted report
delivery or the full app.

## Extraction quality remains pending

The route uses the existing `createAi` adapter. Both
`LUNA_REPORT_EXTRACTION_ENABLED` and `LAYA_ADVISORY_ENABLED` remain false. No live
inference, quality rerun, prompt tuning or AI module change belongs to this work.
[Existing evidence](../ai/evaluation.md) remains: Luna fresh semantic 11/15,
exact 6/15; Laya 25/36. Human approval is required even after a future quality gate.

Feature validation retains grounded literal evidence and missing fields; malformed
adapter results become recoverable failures. Selection is at most eight distinct
pages, 12,000 total characters and 24 candidates. Unselected/full source pages
remain available. One extraction is active per process. Completed retries return
before invoking the adapter; there is no automatic retry/background queue.
Disabled extraction persists an honest unavailable result. The manual correction
and approval path remains usable. A crash before the result commits preserves
review/approved state and requires an explicit retry.

Only labelled synthetic test inputs may reach the adapter in this local slice.
Permitted real documents return unavailable without provider transfer, even if
an operator changes the AI flag. Provider permission/retention and representative
quality remain explicit gates; a client source-type field cannot authorize a
remote transfer. Synthetic injected candidates prove the handoff, not model quality.

## Registered API and admin

`services/api/api/app.ts` serves the three allowlisted `/admin/reports/` assets, which
reuse `/admin/style.css`. No shell/navigation or phone changes are required.
It lazily composes the report runtime after existing origin/rate/bearer checks.
An unconfigured report feature returns controlled 503 without breaking unrelated
routes. Each report operation also reauthorizes inside its own transaction.

| Endpoint | Behavior |
| --- | --- |
| `POST /v1/admin/reports` | Reserve source identity with requestId/title/sourceKind |
| `GET /v1/admin/reports?after=UUID` | List up to 50 reports |
| `GET /v1/admin/reports/:id` | Private pages, revisions, decisions, extraction status |
| `PUT /v1/admin/reports/:id/source` | Uploader-owned raw PDF, streamed 10 MiB/type/signature boundary |
| `GET /v1/admin/reports/:id/source` | Assigned-admin page-labelled text and provenance attachment |
| `POST /v1/admin/reports/:id/extractions` | Bounded selection and persistent result |
| `POST /v1/admin/reports/:id/candidates` | Source-backed initial manual revision |
| `POST /v1/admin/report-candidates/:id/revisions` | Append correction with expectedRevisionId |
| `POST /v1/admin/report-candidates/:id/decisions` | Explicit decision with revision/expectedApprovalId/reason |
| `GET /v1/impact/official` | Authenticated approved-only read, up to 100 figures |

JSON retains the API's 4 KiB cap. Quotes plus review fields must fit it; larger
payloads fail explicitly. The PDF reader is separate. Migration discovery loads
`0007_reports.sql`; it adds only report tables/protection functions/triggers.
The existing API Dockerfile already copies `server`, including report assets.

The admin uses the existing synthetic local sign-in and server-assigned roles;
tokens remain in memory. Actual browser proof covers upload, grounded page text,
disabled extraction, incomplete-candidate refusal, correction, explicit approval,
expected replacement, lost-response retry, stale revision, revoked-role denial,
escaped markup and a 390px keyboard-operated layout. A lost decision response
asks the admin to check status; it cannot assert that the server did not commit.
Production browser identity, screen-reader/device acceptance and complete phone
Impact presentation remain unverified.

## Reproduce with granted local resources

Build dependencies with network access separately from offline parsing:

```sh
pnpm install --frozen-lockfile
pnpm reports:parser:build
export REPORT_PARSER_IMAGE="$(docker image inspect amr-report-parser:local --format '{{.Id}}')"
export REPORT_PARSER_MODE=docker
# Set REPORT_STORAGE_ROOT and REPORT_TEST_STORAGE to the allocated dev/test paths.
# Set API_PORT to the leased loopback port; ADMIN_ORIGIN must match it exactly.
pnpm db:run -- node services/api/api/start.ts
```

Use `API_HOST=127.0.0.1`, `AUTH_DEV_ENABLED=true` only for authorized local synthetic
sign-in, and the existing role-assignment procedure. Never put DB credentials in
commands or the repository. Run migrations using the allocated DB wrapper before
startup. CI builds the same child from the root frozen lock and runs serial tests;
it does not mount the host socket into an API container.

```sh
pnpm reports:test
pnpm reports:test:native # macOS native sandbox only
pnpm reports:test:container
pnpm reports:test:database
pnpm check
pnpm security:check
pnpm exec expo export --platform all
```

Before this retention candidate, local counting was 42 distinct tests across four serial groups: 7 pure/AI-off,
11 native, 3 container and 21 storage/PostgreSQL/registered HTTP. Four independent
fixture assertions verify original encrypted/image-only PDFs. Historical 29-test
and seven-assertion Linux evidence are retained, not added again to this total.
The former real `createApi` 404 regression now passes. PostgreSQL/HTTP proof
includes source persistence/restart, immutable history, unchanged approvals on
failure, competing approvals, stale/replay decisions, role/session revocation,
unchanged-row expiry waits and cross-account denial. Source security checks,
frozen install and full local checks passed again after combining the reviewed
rewards base. Serial regression groups passed: accounts/API 10, points 21,
submissions 16, rewards 21, journeys 17 and routes 1, in addition to the report
groups. All-platform exports passed before the combination; report assets and
parser source are unchanged across that rebase.

One final isolated ZAP scan started at `/admin/reports/` and passed policy with
zero blocking findings and informational alert 10109 on that page. The generated
plan still spiders `/`; this is limited unauthenticated page/header coverage,
not authenticated upload or JavaScript workflow coverage. Raw diagnostics retain
failed external telemetry/update DNS attempts under the internal network.
Protected operations are established by the separate HTTP/browser tests. The
scanner, target, image and network were removed. Hosted CI and independent review
remain pending at author handoff.

Primary references: [PDF.js Node example](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs),
[PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html),
[Docker memory/swap limits](https://docs.docker.com/engine/containers/resource_constraints/).

Implemented by gpt-6-astra through Codex (T3 Code).
