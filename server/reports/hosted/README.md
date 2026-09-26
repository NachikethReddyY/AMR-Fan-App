# Hosted PDF parser candidate

This directory is a review candidate, not a deployed or verified Render service.
The Dockerfile uses the existing pinned Node base and frozen PDF.js dependency.
The final image digest must be recorded after the authorized build. The compiler
packages resolve during that build; no compiler-version reproducibility claim is
made before its exact image is recorded.

The main API retains session/admin checks, report hashes, durable page text and
approval transactions. It holds the Ed25519 signing key. The parser gets only its
public verification key. Do not attach application environment groups, Supabase,
database, model/provider credentials, volumes, Docker socket or a shell endpoint.
The parser never fetches source URLs, persists PDFs, or invokes an AI model.

## Protocol

`GET /health` is liveness only. `GET /ready` returns 503 until local isolation
checks and exact-image supported-host approval both pass. Liveness must never be
used as evidence that PDF processing is ready.

`POST /v1/parse` accepts `application/pdf` with a signed bearer job. The signed
payload binds UUID, audience `amr-report-parser-v1`, SHA-256, byte count and a
maximum 60-second expiry. Signature algorithm is Ed25519. The service verifies
before reading the PDF, rejects used job IDs within their expiry window, and
accepts one active job. The bounded replay map rejects new work at capacity.
Replays after a process restart are possible within the short validity window;
there are no publication or database side effects in this service.

Success returns job ID, input hash, parser version and ordered pages. The API
revalidates association, exact keys, parser version, page numbers and text limits.
It uses a fixed HTTPS origin, rejects redirects, never forwards its own session
or storage credentials, and performs no automatic retry or local fallback.

The child receives PDF stdin and returns bounded JSON stdout. Landlock permits
only the worker, Node, libraries and dependencies. Seccomp denies network,
parent-process access, namespace changes, io_uring and non-thread process
creation. Extra descriptors are closed. Child environment contains PATH, LANG,
NODE_ENV only. The parent caps combined stdout/stderr at 8 MiB and kills/reaps
the process group on deadline/failure before releasing the slot. PDF text and
child diagnostics are never logged. Exact sandbox review and actual AMD64
execution remain required.

## Resource contract

The accepted hard limit is 512 MiB for the entire parser service, including
parent and child, separate from the application API. Startup requires a Linux
AMD64 non-root process, an observable service memory ceiling at or below
536870912 bytes, and CPU quota at or below 0.1 CPU. No measurement here establishes
that every accepted 10 MiB/100-page PDF fits that limit. Each job has a 55-second
whole-job deadline, 100-page and 1,000,000-character bounds, and 128 MiB child V8
old-space. V8 heap limits are not process/service memory limits.

Startup reports observed swap/PID controls. The earlier local 256 MiB per-job,
zero-swap/64-PID Docker result does not establish those controls on Render. The
accepted service-wide memory change does not imply an unobserved no-swap or
64-PID guarantee. The launcher refuses non-thread process creation. It does not use RLIMIT_NPROC:
that limit counts the UID across containers and blocked Node thread startup in
the local probe. Only an observed service cgroup can establish a service PID cap. Actual
values and memory peaks belong in the root's host review before readiness.

## Exact synthetic trial proposal

No creation or deployment is authorized by this file. Root first reviews the
candidate and gets the release owner's zero-spend evidence for the account and
workspace. If free capacity, build/bandwidth limits, payment behavior or overage
prevention cannot establish zero spend, stop before creation. Do not create a
paid resource or enable auto-upgrade/overages.

After root approval, create one temporary Render Free Docker web service from
this reviewed source/image, Linux AMD64, using this Dockerfile and root build
context. Do not attach disks, databases, environment groups or other services.
Use `/health` only as the deployment liveness check. Record the resulting exact
service ID, image digest, source SHA, account boundary and expiry of the trial;
no guessed destination/name or identity is needed before creation.

Configuration contains only `PORT` (host-assigned), `REPORT_PARSER_IMAGE` (exact
image digest), `REPORT_PARSER_PUBLIC_KEY` (fresh trial public key), and
`REPORT_PARSER_TRIAL_ENABLED=true`. Keep `REPORT_PARSER_HOST_VERIFIED_IMAGE`
unset. The private key stays with the authorized probe runner, never the service.
Production `/v1/parse` and `/ready` remain closed throughout the trial.

Trial jobs use `/v1/trial` and distinct audience `amr-report-parser-trial-v1`.
The endpoint is absent unless explicitly enabled and local isolation/resource
checks pass. It accepts only exact hashes and byte sizes in
`trial-fixtures.ts`. The current original fixtures are a two-page Unicode PDF
and a malformed PDF. Their manifest is reproducible locally:

```sh
node --input-type=module -e "import {trialManifest} from './server/reports/hosted/trial-fixtures.ts'; console.log(JSON.stringify(trialManifest))"
```

The same signature, request bounds, replay/busy controls, launcher, parser and
resource path apply. Wrong fixture hashes/sizes fail before reading/processing.
No arbitrary user PDF, diagnostic command or model call is exposed. Additional
boundary/OOM fixtures require a reviewed manifest change and root's exact grant;
the small initial trial cannot prove worst-case memory or full PDF support.

Run a bounded set: readiness false, trial disabled refusal, unauthorized/expired/
wrong-audience/wrong-fixture/hash-mismatch/replay/busy refusal, Unicode success,
malformed failure and subsequent recovery. Startup canaries test denied private
file/proc reads, writes on writable tmp, and loopback socket creation. Capture
only statuses, fixture names/hashes, counts, timings and resource measurements.
Production readiness still needs measured peak service memory, service OOM and
restart behavior, workload/deadline boundaries, descriptor/descendant cleanup,
and independent sandbox review on the exact supported host. The current fixture
set does not yet establish these facts.

After the window, disable trial mode and remove only this exact temporary
service. Read back deletion and billing state through the release owner. Never
prune shared resources. Keep evidence private and synthetic; publish no private
evidence or operational identifiers with the PR.

For a later production candidate, the main API needs `REPORT_PARSER_MODE=hosted`,
`REPORT_PARSER_URL`, `REPORT_PARSER_SIGNING_KEY` and
`REPORT_PARSER_VERIFIED_IMAGE`. The service additionally needs
`REPORT_PARSER_HOST_VERIFIED_IMAGE` matching the actual image. Only the root's
supported-host proof and independent review authorize those approval values.
A configuration value alone is not evidence. Trial mode must be disabled.

Prepared by gpt-6-astra through Codex (T3 Code).
