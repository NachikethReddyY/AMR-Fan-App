# PR46: accepted exception for ZAP 10202

Status: user accepted this narrow delivery exception on 26 September 2026.
The failed DAST result remains failed. No scanner rule, threshold or global
security policy is changed, and no CSRF-specific code fix is justified by this
independently reviewed heuristic finding.

## Exact scope

PR: [#46](https://github.com/NachikethReddyY/AMR-Fan-App/pull/46).
Refreshed code candidate: `8a0b54fe99556fe066c8124218db1e5514d2511b`, based on
`026b4d70f9ab1eb4ef2b1731db88e1162feda1fb`. The documentation-only commit recording this decision
must preserve the source hashes below. Other future candidates are not covered
merely because they use the same branch or PR number.

Only alert **10202, Absence of Anti-CSRF Tokens**, on the password sign-in forms
at these three paths is excepted:

- `/admin/participation/`
- `/admin/reports/`
- `/admin/submissions/`

The retained scan observed the forms in GET responses and classified the alert
as medium risk, low confidence. Its exact original candidate is
`e71e2aa9ce391efb5a6bf9c81a927c50e716be08`; the later source-only review at
`30a8dc4fb35128baa812e64a02278d04047d006c` found no actionable integration issue.
These results do not claim execution of the refreshed candidate.

## Basis and boundaries

Authentication uses explicit bearer headers and `credentials: 'omit'`, with no
cookie authority. The server accepts only either configured exact browser origin
and still enforces session validity and assigned roles. The login helper sends
credentials to the fixed Supabase provider and keeps the app token in memory.

The forms use POST and retain input IDs/autocomplete, but email/password have no
native successful-control names. Observed keyboard Enter succeeds with the
handler; with its listener removed, FormData is empty and the native same-page
POST is rejected without credentials in the URL or body. There is no native
login handler. These facts support the independent false-positive disposition.

This exception permits consideration of PR46 delivery despite these three
instances only. It does not make DAST green, suppress 10202 elsewhere, cover any
other finding, authorize role grants or remove normal verification. Affected
independent review and scheduled full/security/DAST/browser gates remain pending
for the refreshed integration. Any changed form, authentication, origin or proxy
behavior requires a new assessment. No repeat user approval is needed while the
accepted exact scope and unchanged rationale are verified.

The root owns final review, merge and the deployment window. This record does
not authorize Render setting changes or deployment outside that window. Hosted
assigned-admin reads remain unverified without legitimate access.

## Source identity and retained evidence

| Source | SHA-256 |
| --- | --- |
| `server/submissions/participation/admin/index.html` | `c129921b3f534cf175c56e990f70f488234e1b7a991b5dbb5a13d6787f57d652` |
| `server/reports/admin/index.html` | `7e75f634112f06a9f143e8682b1f2e31b747f07fc264b4b805a5b49a2810196f` |
| `server/submissions/admin/index.html` | `51be36a220eab2fa252d93d23624857b14a73389b52f3f5a820f843ec71ccae1` |
| `server/auth/admin.js` | `37de50089ba8a0f43d564763ae00ecb508726a3b8a29c9a3ace75bba27522f5c` |
| `server/api/app.ts` | `1b84221a9c15c6233a3e25e76440a38fd360bba2d8fca645e64d135c44f50787` |
| `server/points/admin.ts` | `0e710fea2c546c1579d1bf7a2d97ff2189c4ae48cd79c05e9ed6d155e2490602` |
| `scripts/build-admin.mjs` | `3b2cca0eb1a79b09d7855bcb8b8b43a67ad8634c231fff80ef642e803b820b52` |

Original private evidence is retained unchanged at
`.evidence/security/application/zap.json`,
`.evidence/admin-vercel/dast.log`,
`.evidence/admin-vercel/dast-alerts.json` and
`.evidence/admin-vercel/browser-proof.md`. The original upload manifest contains
15 public files, 77,977 bytes; all 14 browser assets and the build script remain
byte-identical in this refresh. Raw evidence is not published with this record.
New gate results must be stored separately and identify their exact candidate.

Recorded by gpt-6-astra through Codex (T3 Code).


## Reports delivery: two additional reviewed instances

On 26 September 2026, root accepted two additional technical false positives
under the user's explicit overnight decision delegation, after independent
review by `pr42_standards`. This disposition covers only 10202 on `/admin/` and
`/admin/rewards/` for the report text-retention candidate identified below.
It is separate from the original three-form user exception. All five observed
10202 instances remain recorded as a failed scan, with informational 10031 on
the unchanged points input. No scanner rule, threshold or application CSRF code
was changed. No new browser execution is claimed.

The independently checked basis is unchanged: explicit bearer authority, no
ambient cookie authority, unnamed native POST credential controls, the fixed
provider endpoint and `credentials: 'omit'`. The report HTML changes only its
download button label. The other four forms, authentication helper, API and
session implementation are byte-identical to main `e2f95534`.

The actual scan began at `/admin/reports/` and followed navigation to all five
forms. ZAP 2.17.0 returned exit 2, 59 rule passes and two alert types. The scanned
image was `sha256:ec023447d5669ea10679c96234ec3e03fb71f42d77594084399da32b1d599b9d`.
After cleanup, the original retained Docker build record supplied its exact
image index, manifest and source COPY blobs. Every blob digest was verified and
all nine source hashes below matched the delivery worktree. This was extraction
from the original cached artifact, not a reconstruction or scan rerun.

This disposition applies only while the final PR candidate has these exact
source hashes and unchanged authentication/origin/proxy behavior. The PR records
the final commit after rebasing. Any relevant change requires reassessment.

| Source | SHA-256 |
| --- | --- |
| `server/api/app.ts` | `1b84221a9c15c6233a3e25e76440a38fd360bba2d8fca645e64d135c44f50787` |
| `server/auth/admin.js` | `37de50089ba8a0f43d564763ae00ecb508726a3b8a29c9a3ace75bba27522f5c` |
| `server/auth/session.ts` | `7c9db0e7799671d0500af83975ae6c71709db1b5725219b4b143334a15e3428b` |
| `server/points/admin.ts` | `0e710fea2c546c1579d1bf7a2d97ff2189c4ae48cd79c05e9ed6d155e2490602` |
| `server/points/admin/index.html` | `10e7fde74ae1e3be2ee5163c18c3689279ffa178fc5b4cab8b0f775b44bd6c91` |
| `server/reports/admin/index.html` | `4ae42d5883db7cb1afe1fe333672f68ec2c408d2fd12cab4c358cf32f694bb5a` |
| `server/rewards/admin/index.html` | `f701e483368ef298340862fe9edb5dfded5dbb05646ab8d55047f5622d9b571a` |
| `server/submissions/admin/index.html` | `51be36a220eab2fa252d93d23624857b14a73389b52f3f5a820f843ec71ccae1` |
| `server/submissions/participation/admin/index.html` | `c129921b3f534cf175c56e990f70f488234e1b7a991b5dbb5a13d6787f57d652` |


Private reports and source reconciliation remain under
`.evidence/hosted-report-text-retention/`, including `dast-admin/zap.json` and
`dast-source-reconciliation.json`. They are not published with the PR. The
parser's separate anonymous scan returned zero alerts; it does not change this
admin scan's failed status or establish hosted parser readiness.

Recorded by gpt-6-astra through Codex (T3 Code).
