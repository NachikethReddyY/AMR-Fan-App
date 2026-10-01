# Swift staging integration

Full feature URLs, methods and availability: [staging endpoint directory](../../docs/operations/staging-endpoints.md).

The running deployment is source `36996ec95b1cc62a3c1ef583e1e30714a814efe0`.
PR #67 head `c2aba734e0d8036fb4f83a738354ee49722ba11e` is newer and remains
un-deployed.

API base URL:

`https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io`

Verified on 29 September 2026: `/health` returns 200, `/ready` returns 200
with database `ok`, protected activity availability rejects anonymous requests
with 401, and `/v1/dev/session` returns 404. The private PostgreSQL migration
job succeeded. No live end-user Entra sign-in has been performed by the agent;
complete that test in the Swift client before treating sign-in as verified.

## Identity

| Setting            | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| External ID tenant | `9dcdff78-04a7-49fc-90bd-e9c7b76e4774`                                       |
| Swift client ID    | `616286cc-a22b-49a2-b5a3-27011fd615a1`                                       |
| Authority          | `https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774` |
| Bundle ID          | `com.amr.fanapp`                                                             |
| Redirect URI       | `msauth.com.amr.fanapp://auth`                                               |
| API scope          | `api://f278be1f-21a5-455b-bb14-b2fc60373939/account.access`                  |

Use native authorization code flow with PKCE. The email/password customer
flow is attached to this public client; no client secret belongs in the app.
Send the API access token as `Authorization: Bearer <access-token>` to
`POST /v1/session`, then use the returned backend session token for protected
API calls. See [auth metadata](auth-staging.md) for issuer and JWKS details.

## Photo contract

Use `/v1/profiles/{profileId}/activity-submissions/availability` to check
availability. Luna is disabled: expect an unavailable response and no image
recognition or AI rewards. The old `/activity/photos` Swift fixture route is
not the hosted multi-photo contract.

When enabled, `POST /v1/profiles/{profileId}/activity-submissions` accepts:

```json
{
  "requestId": "a UUID generated once for this submission",
  "description": "I travelled by public transport",
  "photos": [{ "mime": "image/jpeg", "base64": "..." }],
  "missionId": null,
  "journeyId": null
}
```

Recover a submission using `GET` on the same path plus `/{requestId}`.

## Deployment evidence

- Resource group: `rg-amr-fan-staging`, Southeast Asia.
- App: `amr-fan-api-x324zttj6p6tg`, HTTPS only, one replica.
- Deployed source: `36996ec95b1cc62a3c1ef583e1e30714a814efe0`.
- Deployed image digest: `sha256:944c93fec2249ff034fbccde18bf3d5e011cc7d9e36c7d69810b4c76aaf53fc2`.
- Migration execution: `amr-db-migrate-ymhj2sw`, succeeded before API deployment.
- Temporary job was removed and its two Key Vault secrets soft-deleted.
- API identity can read only `database-url` and pull the ACR image; migration
  administrator credentials are not present in the API configuration.
- Later branch commits refine migration tooling/tests; they do not change the
  currently running API revision automatically.
