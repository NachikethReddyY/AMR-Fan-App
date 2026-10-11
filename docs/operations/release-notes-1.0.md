# Release 1.0 — 2026-10-11 (`v1.0.0`)

Finalizes the [1.0 draft](release-notes-1.0-draft.md). Tag `v1.0.0` on `main`.
Nothing is uploaded to any store; store publication remains out of scope.

## Versions

| App | Version | Build |
| --- | --- | --- |
| iOS (`Swift-App`, `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`) | 1.0 | 1 |
| Android (`Kotlin-App`, `versionName` / `versionCode`) | 1.0 | 1 |

Backend and admin dashboard are unversioned workspace packages deployed from
source; the API reports its own `/health` and `/ready`.

## What is in this release

- Native iOS fan app: Home, Rewards, Impact, Travel, onboarding, account
  sign-in (CIAM/Entra External ID), photo activity submission, journey
  recording against the backend API.
- Native Android fan app: matching fan flows in Kotlin/Jetpack Compose.
- Backend API with PostgreSQL migrations, points ledger, journeys, rewards,
  submissions, reports, admin endpoints and the static admin dashboard.
- The retired Expo React app is archived under `legacy/react-native/` and is
  not part of this release.

## Changes since the Android test build (`android-test-20261007`)

- `d52730a` fix(admin): points adjustment survives non-secure contexts.
- `b0c809b` chore: backup local changes 2026-10-09.
- `5415334` / `be4b73b` chore: repository cleanup (retired app archived to
  `legacy/react-native/`, design docs consolidated under `docs/`).
- Prettier formatting across admin and API sources (no behavior change).

## How to build locally

```sh
# iOS simulator (signed local build):
xcodebuild -project Swift-App/Swift-App.xcodeproj -scheme Swift-App \
  -sdk iphonesimulator -configuration Debug \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build

# Android debug APK:
cd Kotlin-App && ./gradlew :app:assembleDebug --no-daemon
```

## How to point the apps at a backend

Both apps take a configurable API base URL (local loopback default in source).
Point them at the reachable staging host before sign-in, travel search or
photo submission can work end to end. Live provider credentials and the
OneMap/AI keys stay outside the checkout (mode 600); see
[local development](local-development.md) and [staging endpoints](staging-endpoints.md).

## Verification for this tag

- `pnpm check` (typecheck, Prettier, tooling, agents, unit suites) passes on
  the tagged revision; database/container suites run in CI.
- The secrets scan requires Docker, which is unavailable on this host, so it
  was not run locally; no secrets or credentials are added by this release
  (formatting plus the four listed commits).

## Known limits

- The iPhone-target build is an unsigned compile artifact until an Apple
  development team and provisioning profile are configured.
- The Android artifact is a debug APK, not a signed release bundle.
- Physical-device sign-in, background tracking, arrival validation and
  store publication are unverified and out of scope for this release.
- Aston Martin names, logos, photos and ESG reports are third-party material;
  this release implies no ownership or endorsement.
