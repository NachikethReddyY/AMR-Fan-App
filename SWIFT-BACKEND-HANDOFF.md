# Swift backend integration handoff

## Starting state

- Repository: `AMR-Fan-App-swift`
- Source branch: `main`
- Handoff branch: `handoff/swift-backend-integration`
- Worktree: `/Users/nr/.T3-V2/worktrees/AMR-Fan-App-swift/swift-backend-handoff`
- This worktree starts clean from `main`.
- The original worktree at `/Users/nr/Developer/AMR-Fan-App-swift` contains uncommitted implementation edits. Do not assume those edits exist here; inspect or port them deliberately.

## Backend contract

API base:

`https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io`

Public checks observed on 2026-09-30:

- `GET /health` returns `200` with `{"status":"ok"}`.
- `GET /ready` returns `200` with database status `ok`.
- `POST /v1/dev/session` is production-disabled and returns `404`.

Authentication:

1. Use native authorization-code + PKCE against Entra External ID.
2. Authority: `https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774`
3. Issuer: `https://9dcdff78-04a7-49fc-90bd-e9c7b76e4774.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774/v2.0`
4. Native client ID: `616286cc-a22b-49a2-b5a3-27011fd615a1`
5. Bundle ID: `com.amr.fanapp`
6. Redirect URI: `msauth.com.amr.fanapp://auth`
7. Requested API scope: `api://f278be1f-21a5-455b-bb14-b2fc60373939/account.access`
8. Send the provider access token to `POST /v1/session` as `Authorization: Bearer <provider-token>`.
9. Persist the returned opaque AMR session token in Keychain and use it for protected API requests.

The deployed server’s exact `AUTH_AUDIENCE` and `AUTH_REQUIRED_SCOPE` must still be confirmed from deployment configuration. Do not invent either value. The supplied JWKS host and the OIDC discovery JWKS host differ; verify the deployed `AUTH_JWKS_URL` intentionally before live auth acceptance.

Important fan endpoints:

- `GET /v1/me`
- `DELETE /v1/session`
- `GET/PATCH /v1/profiles/{profileId}`
- `POST /v1/routes/query` (currently provider-disabled in staging)
- `GET /v1/profiles/{profileId}/activity-submissions/availability` (currently disabled)
- `POST /v1/profiles/{profileId}/activity-submissions` (currently returns unavailable/503)
- `GET /v1/impact/overview?profileId={profileId}`
- `GET /v1/profiles/{profileId}/points/history`
- `GET /v1/profiles/{profileId}/journeys`

Do not use the legacy activity paths `/activity/availability` or `/activity/photos` for new code.

## Swift state found

Primary files:

- `Swift-App/Swift-App/BackendClient.swift`
- `Swift-App/Swift-App/BackendAuth.swift`
- `Swift-App/Swift-App/AccountScreen.swift`
- `Swift-App/Swift-App/ContentView.swift`
- `Swift-App/Swift-App/TravelScreen.swift`
- `Swift-App/Swift-App.xcodeproj/project.pbxproj`
- `Swift-App/Info.plist`

Before this handoff, the app had:

- A `BackendSession` observable object with Keychain storage under `amr.session`.
- `/v1/me`, logout, routes, and legacy photo calls.
- A local synthetic sign-in button in `AccountScreen`.
- No OIDC/PKCE implementation.
- Placeholder bundle ID and no native redirect URL scheme.

## Implementation status in this worktree

The handoff worktree now contains the integration as uncommitted local changes:

- Adds `ASWebAuthenticationSession` and CryptoKit PKCE flow with callback state validation.
- Adds provider-token exchange through `POST /v1/session`.
- Changes the default API URL to the Azure base URL.
- Changes activity calls to the activity-submissions contract.
- Decodes the strict activity result union and nested reward contract used by the backend.
- Changes the account button to live sign-in.
- Sets bundle ID and redirect URL configuration in a checked-in `Info.plist`.
- Adds `Swift-App/Tests/BackendAuthChecks.swift` for deterministic PKCE, URL, form encoding and Keychain checks.
- Passes `BackendSession` explicitly into `ProfileScreen` and `AccountScreen` so account state survives nested sheet presentation without an environment-object precondition failure.
- Adds `Swift-App/Swift-App/PhotoUpload.swift` to downsample and adaptively compress gallery and camera photos below the backend limit.
- Uses file-backed image loading for the camera's library picker to avoid decoding the original full-resolution resource into a `UIImage` first.
- Maps backend 413 image-size responses to the existing unsupported-image UI state.

The previous form-body compiler error is fixed. The original worktree remains unchanged; this worktree has not been committed or pushed.

## Required implementation sequence

1. Inspect the clean worktree and decide whether to port the attempted changes or reimplement them cleanly.
2. Add a small, testable OIDC configuration/auth adapter using authorization-code + PKCE and `ASWebAuthenticationSession` or an approved dependency.
3. Keep provider credentials separate from the opaque AMR session. Persist only what is required for resume and revocation.
4. Add the `msauth.com.amr.fanapp` URL scheme and set the target bundle ID to `com.amr.fanapp` in both configurations.
5. Replace the Account screen’s local-only action with live sign-in. Keep synthetic sign-in development-only and do not call it against staging.
6. Update activity submission models and paths to `/activity-submissions`; show the staging-disabled response without uploading a photo.
7. Preserve route UI behavior, but handle provider-disabled responses honestly.
8. Add focused tests for URL construction, PKCE verifier/challenge generation, token exchange decoding, session persistence, logout, and error handling where the project’s test setup permits.
9. Run:

```sh
xcodebuild -project Swift-App/Swift-App.xcodeproj \
  -scheme Swift-App \
  -sdk iphonesimulator \
  -configuration Debug \
  CODE_SIGNING_ALLOWED=NO build
```

10. Perform native sign-in/device verification only when a registered client, valid server audience/scope, and a suitable simulator/device environment are available. A successful compile does not prove redirect or live authentication.

## Acceptance criteria

- A release/default build points at the Azure API base.
- The native app can construct the configured PKCE authorize request and handle the registered callback scheme.
- The provider access token is exchanged for an AMR session through `/v1/session`.
- The AMR session is stored in Keychain and resumes through `/v1/me`.
- Logout revokes the AMR session and clears local session state.
- No production flow calls `/v1/dev/session`.
- New photo code uses the activity-submissions endpoint and correctly represents staging unavailability.
- Gallery and camera photo inputs are downsampled to a 1600-pixel long edge and encoded below 1.8 MB before upload.
- Simulator build passes.
- Live provider/device verification is reported separately as verified or unverified; it must not be inferred from compilation.

## Observed verification on 2026-09-30

- `swiftc Swift-App/Swift-App/BackendAuth.swift Swift-App/Tests/BackendAuthChecks.swift` passed deterministic PKCE, authorization URL, form encoding and Keychain persistence checks.
- `GET /health` returned `200` with `{"status":"ok"}`.
- `GET /ready` returned `200` with database status `ok`.
- `POST /v1/dev/session` returned `404` in production.
- Debug and Release simulator builds passed.
- The processed Release `Info.plist` contains bundle ID `com.amr.fanapp` and URL scheme `msauth.com.amr.fanapp`.
- The Release binary excludes the `/v1/dev/session` route string.
- `pnpm agents:check` passed. OrbStack was started and `pnpm security:check` passed its secrets, SAST and fixture self-tests; `pnpm audit --audit-level high` reported one existing moderate advisory.
- The iPhone 17 simulator rendered the profile and account screens, completed the iOS OIDC consent prompt, and rendered the live Entra sign-in form. The account-sheet crash was fixed by explicit session injection and did not recur in the clean rerun.
- Callback completion, authenticated account exchange, `/v1/me`, and logout revocation remain unverified because no registered AMR account credentials were available. Anonymous invalid-token probes returned `401` for `GET /v1/me`, `POST /v1/session`, and `DELETE /v1/session`.
- Follow-up with the supplied test email reached the live provider but returned `We couldn't find an account with this email address.` No password or verification factor was handled. A registered provider account is still required for the callback and authenticated exchange proof.
- Device recording and screenshots are stored under `.evidence/swift-backend-live/`. No commit, push or deployment was performed.
- The oversized-photo regression is covered by `Swift-App/Tests/PhotoUploadChecks.swift`: a synthetic 6000x4000 image went from 25,315,126 bytes at the old fixed-quality path to 970,616 bytes through the bounded encoder. Debug and Release builds passed, and the rebuilt iPhone 17 simulator selected a library photo and reached verification without the resource-size error. Evidence is under `.evidence/swift-photo-upload/`.
- Authenticated photo submission remains unverified because the provider account was not registered and the staging activity endpoint is disabled.

## Source references

- `deploy/azure/swift-integration.md`
- `docs/operations/staging-endpoints.md`
- `docs/operations/accounts.md`
- `docs/operations/phone.md`
- `docs/internals/security.md`
