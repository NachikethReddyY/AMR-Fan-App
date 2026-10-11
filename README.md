# AMR Fan App

[Documentation](docs/README.md) · [Roadmap](docs/ROADMAP.md) ·
[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Agent instructions](AGENTS.md)

Native Aston Martin Formula One fan apps (Swift for iOS, Kotlin for Android),
a Node backend API, a static admin dashboard and shared TypeScript packages.
No backend account, credentials, or environment file is required to explore the
code; running the API against a database uses a disposable local PostgreSQL.

## Prerequisites

- Node.js 24 LTS (`.node-version` pins the verified version).
- pnpm 12.6.0 (pinned by `packageManager`); install using the
  [pnpm installation guide](https://pnpm.io/installation).
- iOS: macOS with Xcode, command-line tools, and an installed iOS Simulator runtime.
- Android: Android Studio, an installed Android SDK and emulator, and configured
  `ANDROID_HOME`/platform-tools.
- Docker: required for database-backed tests, the report-parser container check
  and the security scanner suite.

## Install and run

From a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm api:start
```

Build the static admin dashboard:

```sh
pnpm --filter @amr/admin build
```

Run the phone apps natively:

- iOS: open `Swift-App/Swift-App.xcodeproj` in Xcode and run the `Swift-App` scheme.
- Android: open `Kotlin-App` in Android Studio and run the `app` configuration.

See the [1.0 release notes](docs/operations/release-notes-1.0.md) for
app versions, build commands and known limits.

## Checks

```sh
pnpm typecheck
pnpm format:check
pnpm test:tooling
pnpm agents:check
# Unit suites that need no database:
pnpm ai:test && pnpm account:test && pnpm route:test
# Everything above plus all unit suites:
pnpm check
# Database-backed suites need Docker:
pnpm db:up && pnpm db:test
# Docker-backed source/security checks and dependency audit:
pnpm security:check
# Apply formatting to maintained code/configuration:
pnpm format
```

Read the [verification procedure](docs/operations/verification.md) for the full
check matrix and the [security testing procedure](docs/operations/security-testing.md)
for scanner scope and DAST applicability. Browser, computer-use and device
verification require explicit user agreement.

## Structure and configuration

- `Swift-App/`: native iOS phone app (Swift/SwiftUI, Xcode).
- `Kotlin-App/`: native Android phone app (Kotlin/Jetpack Compose).
- `services/api/`: backend API source, migrations and AI/report adapters.
- `apps/admin/`: admin workspace package that builds the static admin artifact.
- `packages/contracts/`: shared wire types.
- `packages/travel-domain/`: pure route and sustainability calculations shared by the API.
- `legacy/react-native/`: archived Expo React fan app. Reference only; it is not
  built, shipped, or checked standalone. See `legacy/README.md`.
- `docs/`: maintained product, architecture and operating documentation.
- `.env.example`: optional future configuration names, with placeholders only.

The phone apps read only public configuration values. Server credentials stay in
the API environment. Hosted services and live authentication remain deployment
gates. Local `.env` files, signing keys, dependency folders, generated native
projects and build output are ignored. Only `.env.example` is intended for
version control.

## Product planning

- [Product specification](docs/fan-app-specification.md) (open decisions preserved)
- [Glossary](CONTEXT.md)
- [Current planning document](docs/poc-plan.md)
- [Team discussion brief](docs/fan-app-team-brief.html)
- [Repository setup issue](https://github.com/NachikethReddyY/AMR-Fan-App/issues/1)

The specification is preserved as written. Its product-feature decisions remain
separate from repository organization.
