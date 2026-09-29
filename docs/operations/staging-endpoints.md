# Staging endpoint directory

Base URL: `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io`

This inventory is checked against deployed source `36996ec`. PR #67 currently
ends at `c2aba734e0d8036fb4f83a738354ee49722ba11e`; that newer head is not
deployed, although it keeps the same endpoint shapes. Replace every `{...}`
placeholder with its actual ID.
These are API request URLs: POST/PATCH/PUT/DELETE require the indicated method
and payload, not a browser visit. Feature paths alone do not establish end-to-end
verification.

## Authentication and current limits

- Use native authorization code + PKCE. Exchange the Entra API access token with
  `POST /v1/session` using `Authorization: Bearer <entra-access-token>`.
- That response contains `token`, `expiresAt`, and `account`. Use the returned
  backend `token` in the Bearer header on subsequent protected requests.
- Obtain profile IDs from `account` or `GET /v1/me`; ownership is checked server-side.
- Admin routes require a database-assigned admin role, not an Entra role claim.
- Set `Content-Type: application/json` for JSON bodies. PDF upload is the exception.
- Luna photo scoring, live routes, and report processing are disabled/unconfigured.
  Official metrics remain unavailable until report storage and ingestion are configured.
- Admin HTML is served, but its browser sign-in is not wired for Entra:
  `GET /admin/config` reports `auth.mode: unavailable`.
- Live end-user Entra login and authenticated feature flows have not been verified
  on a Swift device. Health/readiness, public catalogue and anonymous rejection
  checks do not substitute for that test.

## Service and accounts

| Method | Full URL | Purpose | Access/status |
| --- | --- | --- | --- |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/` | Health alias | Public |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/health` | Health | Public; 200 verified |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/ready` | Database readiness | Public; 200 verified |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/session` | Exchange Entra API access token for backend session | Entra access token |
| DELETE | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/session` | Sign out/revoke backend session | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/me` | Account and real/demo profile IDs | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}` | Read owned profile | Session |
| PATCH | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}` | Rename owned profile | Session; JSON displayName |

## Photo sustainability submissions

| Method | Full URL | Purpose | Access/status |
| --- | --- | --- | --- |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/activity-submissions/availability` | Check scoring availability | Session; disabled |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/activity-submissions` | Submit 1–5 photos and description | Session; 503 disabled |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/activity-submissions/{requestId}` | Recover submission result | Session |

## Missions and impact

| Method | Full URL | Purpose | Access/status |
| --- | --- | --- | --- |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/missions?profileId={profileId}` | List missions/progress | Session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/missions/{missionId}/enroll` | Enroll owned profile | Session; body includes profileId |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/impact/overview?profileId={profileId}` | Fan, community and Aston Martin sections | Session; official section unavailable |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/impact` | Fan travel contributions | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/impact/official` | Official Aston Martin report metrics | Session; report storage unconfigured |

## Travel and journey awards

| Method | Full URL | Purpose | Access/status |
| --- | --- | --- | --- |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/routes/query` | Find and compare routes | Session; provider disabled |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/journeys` | List owned journeys | Session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/journeys/prepare` | Prepare journey plan | Session; live routes unavailable |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/journeys/{journeyId}` | Read journey | Session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/journeys/{journeyId}/start` | Start journey | Session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/journeys/{journeyId}/evidence` | Append journey evidence | Session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/journeys/{journeyId}/finish` | Finish journey | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/journeys/{journeyId}/assessment` | Read journey assessment | Session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/journeys/{journeyId}/settlements` | Request journey award settlement | Session; release/eligibility gates |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/journeys/{journeyId}/award` | Read award result | Session |

## Points and rewards

| Method | Full URL | Purpose | Access/status |
| --- | --- | --- | --- |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/points/history` | Read points history | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/rewards/offers` | Public reward catalogue | Public; 200 with empty catalogue verified |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/rewards/offers` | Profile reward catalogue | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/rewards/offers/{offerId}` | Reward detail | Session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/rewards/purchases` | Purchase/redeem reward | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/rewards/receipts` | Purchase receipts | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/rewards/content/{offerId}` | Unlocked reward content | Session |

## Fan submissions and participation

| Method | Full URL | Purpose | Access/status |
| --- | --- | --- | --- |
| GET, POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/submissions` | List/create fan ideas, questions and challenges | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/submissions/ranking` | Shared submission ranking | Session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/submission-participation` | Own participation | Session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/submissions/{submissionId}/contributions` | Contribute points to submission | Session |

## Admin API

| Method | Full URL | Purpose | Access/status |
| --- | --- | --- | --- |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/session` | Verify database-assigned admin role | Admin session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/points/profiles` | Find profiles | Admin session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/points/adjustments` | Adjust points with audit record | Admin session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/profiles/{profileId}/points/history` | Read profile history | Admin session |
| GET, POST, PATCH | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/rewards/offers` | List/create/edit offers | Admin session |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/submissions` | Moderation queue | Admin session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/submissions/{submissionId}/decision` | Moderate submission | Admin session |
| GET, POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/submission-sessions` | List/create interaction sessions | Admin session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/submission-sessions/{sessionId}/close` | Close interaction session | Admin session |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/submission-selections/{selectionId}/resolve` | Resolve submission selection | Admin session |

## Report administration (unconfigured in staging)

| Method | Full URL | Purpose | Access/status |
| --- | --- | --- | --- |
| GET, POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/reports` | List/reserve reports | Admin session; report storage unavailable |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/reports/{reportId}` | Report detail | Admin session; unavailable |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/reports/{reportId}/source` | Download extracted source text | Admin session; unavailable |
| PUT | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/reports/{reportId}/source` | Upload source PDF | Admin session; application/pdf; unavailable |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/reports/{reportId}/candidates` | Add metric candidate | Admin session; unavailable |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/reports/{reportId}/extractions` | Request AI extraction | Admin session; Luna/storage unavailable |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/report-candidates/{candidateId}/revisions` | Revise candidate | Admin session; unavailable |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/admin/report-candidates/{candidateId}/decisions` | Accept/reject candidate | Admin session; unavailable |

## Legacy and development routes (do not use for new Swift integration)

| Method | Full URL | Purpose | Access/status |
| --- | --- | --- | --- |
| GET | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/activity/availability` | Old single-photo fixture availability | Session; unavailable |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/profiles/{profileId}/activity/photos` | Old single-photo fixture submission | Session; 503 disabled |
| POST | `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/v1/dev/session` | Local synthetic sign-in | 404 in production |

## Admin pages and static assets

All entries below use GET. Pages are reachable; Entra browser sign-in remains unavailable.

- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/submissions/`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/participation/`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/rewards/`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/reports/`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/config`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/auth/admin.js`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/app.js`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/style.css`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/submissions/app.js`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/participation/app.js`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/participation/style.css`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/rewards/app.js`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/reports/app.js`
- `https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/admin/reports/style.css`

## Entra External ID URLs

- Authority: `https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774`
- Discovery: `https://amrfancustomers.ciamlogin.com/amrfancustomers.onmicrosoft.com/v2.0/.well-known/openid-configuration`
- Authorize: `https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774/oauth2/v2.0/authorize`
- Token: `https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774/oauth2/v2.0/token`
- Logout: `https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774/oauth2/v2.0/logout`
- Issuer: `https://9dcdff78-04a7-49fc-90bd-e9c7b76e4774.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774/v2.0`
- JWKS: `https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774/discovery/v2.0/keys`
- Swift redirect: `msauth.com.amr.fanapp://auth`
- Scope: `api://f278be1f-21a5-455b-bb14-b2fc60373939/account.access`

Client/tenant IDs and deployment evidence: [Swift integration](../../deploy/azure/swift-integration.md).

## News RSS and build workflow

- Published RSS: https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml
- Image builds: https://github.com/NachikethReddyY/AMR-Fan-App/actions/workflows/azure-image.yml

RSS is hosted separately; there is no RSS/news endpoint on this API. No Swagger,
OpenAPI, generic image-recognition endpoint or database HTTP endpoint is registered.
The PostgreSQL host is private and is not a URL for the Swift app.
