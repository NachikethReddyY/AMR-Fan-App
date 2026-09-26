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
