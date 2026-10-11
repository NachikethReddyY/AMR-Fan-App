# Release 1.0 — draft (not tagged, not published)

This is a **draft**. No git tag was created, nothing was pushed, and nothing
was uploaded to any store. Creating the tag and publishing require explicit
authorization per [delivery and release](release.md).

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

## Known limits

- The iPhone-target build is an unsigned compile artifact until an Apple
  development team and provisioning profile are configured.
- The Android artifact is a debug APK, not a signed release bundle.
- Physical-device sign-in, background tracking, arrival validation and
  store publication are unverified and out of scope for this draft.
- Aston Martin names, logos, photos and ESG reports are third-party material;
  this release implies no ownership or endorsement.

## Next step (requires authorization)

1. Run `pnpm check` plus the applicable database/container suites from a clean
   checkout and record the results.
2. Create and push the tag (e.g. `v1.0.0`) and open the release notes from
   this draft.
3. Publish only to explicitly approved destinations with signing credentials,
   rollback plan and observability per [release](release.md).
