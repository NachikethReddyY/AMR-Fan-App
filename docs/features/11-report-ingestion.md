# Report upload, extraction and review

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior. The real API now registers local PDF upload, immutable provenance, manual corrections and assigned-admin approval/replacement. Registered PostgreSQL/parser and browser paths are verified locally. Automatic extraction quality, production identity/retention/provider deployment and fan Impact integration remain pending. See [report operations](../operations/reports.md). Acceptance cases below remain full-product requirements.

## Outcome

An admin uploads a sustainability report, gets its supported details prefilled and approves accurate records for the fan dashboard.

## Accepted behavior

- Report upload and extraction are required in the POC. Replace the earlier manual-only plan while retaining human review.
- Extract all supported structured details: category/name, value, unit, reporting period, source document/page, evidence text and whether a figure is a target, result, annual total, cumulative value or estimate.
- Retain extraction/model version metadata. Missing or unsupported fields stay missing and are flagged for review. Do not invent numbers, provenance, reviewers or approval times.
- An assigned admin reviews and can correct candidates before approving them. Approval identity and time come from that action.
- Pending/rejected candidates cannot appear as official dashboard facts. Failed extraction preserves previously approved data and exposes the failure for admin follow-up.
- Treat report text and model output as untrusted input. Apply the existing [security and privacy requirements](../internals/security.md) to authorized uploads, validated results and provider use.

## Depends on

[Accounts](01-accounts-and-demo.md) with assigned-admin authorization and persistent report/metric records. [Impact](10-impact-dashboard.md) consumes approved records; approval must be verifiable in the admin view before the fan view is built.

## Before implementation

Choose supported report formats, upload limits, extraction schema/provider and storage/retention against a representative report. Use authorized source material and confirm any real provider data transfer before processing. These decisions do not remove the accepted review step.

## Acceptance cases

| Scenario                                                    | Expected observation                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Admin uploads a sustainability report                       | Extract and prefill supported metric values, units, periods and source evidence into reviewable records. |
| A report does not contain a required value or source detail | Leave that field missing and flag it for review; invent no value.                                        |
| Extracted report records await approval                     | Keep them out of the official dashboard until an authorized admin approves them.                         |
| Report extraction fails                                     | Preserve the previously approved dashboard data and expose the failed extraction for admin follow-up.    |
