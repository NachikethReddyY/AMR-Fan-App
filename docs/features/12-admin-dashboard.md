# Admin web dashboard

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior. The points admin foundation exists. Owned report upload/review/decision assets and tested server operations are prepared separately; shared registration and rendered report-admin verification remain pending. Other controls retain their feature owners. See [report operations](../operations/reports.md). Acceptance cases below remain full-product requirements.

## Outcome

Assigned admins use a separate web app to operate the accepted fan features.

## Accepted controls

| Control                                                                | Rule owner                                                                                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manage reward offers, content and point prices                         | [Points and History](05-points-and-history.md), [trees](07-tree-dedications.md), [content](08-exclusive-content.md), [discounts](09-merchandise-discounts.md) |
| Update earning rules and emissions factors                             | [Points](05-points-and-history.md) and [emissions](03-emissions-estimates.md), preserving journey start versions                                              |
| Add/remove points with a recorded reason                               | [Points and History](05-points-and-history.md)                                                                                                                |
| Moderate submissions, close voting and record fulfilment or release    | [Fan submissions](06-fan-submissions.md)                                                                                                                      |
| Upload reports, correct extracted records and approve team ESG figures | [Report ingestion](11-report-ingestion.md)                                                                                                                    |
| Reset a selected persistent demo profile                               | [Accounts and demo mode](01-accounts-and-demo.md)                                                                                                             |

## Authorization and records

Server-verified assigned roles govern access. A visible Aston Martin admin badge represents the role and does not grant it. Ordinary fans and demo profiles do not acquire admin privileges from client fields. Validate the operation and target ownership at the backend, keep record changes auditable and apply the existing [security requirements](../internals/security.md).

Admin edits must preserve completed purchases, original point records and historical calculation versions. The feature documents above own the detailed behavior; implement each admin control alongside its corresponding fan flow.

## Depends on

Account authorization and persistent data. Start with the smallest admin view needed for point grants, then add controls with their feature slices. Do not make every fan feature wait for a complete admin application.

## Before implementation

Select the admin frontend, Azure services and accepted web design. Feature separation does not select separate packages, services or deployments for each feature. Admin credentials and role assignment must come from an authorized setup.

## Acceptance cases

| Scenario                                                             | Expected observation                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| An ordinary fan accesses administration                              | Protected admin operations remain unavailable.           |
| A fan changes a client badge or supplies another account's record ID | Refuse unauthorized operations without changing records. |
