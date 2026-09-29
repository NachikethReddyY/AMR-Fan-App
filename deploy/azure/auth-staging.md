# Azure External ID staging auth metadata

Provisioned in customer tenant `9dcdff78-04a7-49fc-90bd-e9c7b76e4774` (`amrFanCustomers.onmicrosoft.com`). This file contains identifiers and public endpoints only; it contains no client secret or token.

| Item                                   | Value                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| API application (client) ID            | `f278be1f-21a5-455b-bb14-b2fc60373939`                                                                 |
| API service principal object ID        | `7c97bc6a-398f-4f75-b631-526c566022b3`                                                                 |
| Native iOS application (client) ID     | `616286cc-a22b-49a2-b5a3-27011fd615a1`                                                                 |
| Native iOS service principal object ID | `0518d93c-ce70-4795-a773-91c48451f884`                                                                 |
| API delegated scope                    | `account.access`                                                                                       |
| iOS bundle ID                          | `com.amr.fanapp`                                                                                       |
| Redirect URI                           | `msauth.com.amr.fanapp://auth`                                                                         |
| OIDC issuer                            | `https://9dcdff78-04a7-49fc-90bd-e9c7b76e4774.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774/v2.0` |
| OIDC JWKS                              | `https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774/discovery/v2.0/keys`       |
| API audience                           | `f278be1f-21a5-455b-bb14-b2fc60373939`                                                                 |

The native app has delegated `account.access` permission and tenant-wide admin consent (`AllPrincipals`) through the customer-tenant service principals. No client secret was created.

The customer tenant has an External ID email/password sign-up and sign-in flow attached to the native application. Microsoft documents this flow model at https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-user-flow-sign-up-sign-in-customers.

## User flow

- Graph flow ID: c05a2de2-bdbf-4870-acfa-ec2ded2e1357
- Display name: AMR Fan Sign Up
- Type: externalUsersSelfServiceSignUpEventsFlow
- Provider: EmailPassword-OAUTH (email/password)
- Sign-up allowed: true
- Attached application: native client 616286cc-a22b-49a2-b5a3-27011fd615a1
- Verified by GET /identity/authenticationEventsFlows; no secrets or tokens stored.
