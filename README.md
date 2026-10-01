# AMR Fan App

[Documentation](docs/README.md) · [Roadmap](ROADMAP.md) ·
[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Agent instructions](AGENTS.md)

A Turbo-managed workspace containing the Expo React fan app, Swift/Xcode phone app, backend API, admin web artifact and shared TypeScript packages. No backend account, credentials, or environment file is
required to run it.

## Prerequisites

- Node.js 24 LTS (`.node-version` pins the verified version).
- pnpm 12.6.0 (pinned by `packageManager`); install using the
  [pnpm installation guide](https://pnpm.io/installation).
- iOS: macOS with Xcode, command-line tools, and an installed iOS Simulator runtime.
- Android: Android Studio, an installed Android SDK and emulator, and configured
  `ANDROID_HOME`/platform-tools. Start an emulator in Device Manager first.
- Expo Go compatible with SDK 57, installed in each simulator/emulator. Expo CLI
  can offer to install it on first launch. A physical Android/iOS device can use
  Expo Go on the same network as the development machine.

Dependency versions follow the official
[Expo blank TypeScript template](https://docs.expo.dev/more/create-expo/).

## Install and run

From a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm ios
# Or, with an Android emulator running:
pnpm android
```

Each platform command starts Metro and opens the app. To use both platforms with
one server, run `pnpm start`, then press `i` and `a` in its terminal. Stop Metro
with Ctrl+C. A successful launch shows **AMR Fan App** and **Development starter**.
On a physical device, scan Metro's QR code using Expo Go. If connectivity fails,
check the shared network/firewall and the displayed Metro address. If port 8081
is occupied, stop the previous server or use `pnpm start --port 8082`.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
# Run all of the above:
pnpm check
# Docker-backed source/security checks and dependency audit:
pnpm security:check
# HTTP scanner self-test; the starter itself has no HTTP application target:
pnpm security:dast:self-test
# Apply formatting to maintained code/configuration:
pnpm format
```

Jest uses the `jest-expo` preset and discovers `apps/fan/src/**/*.test.ts` and
`apps/fan/src/**/*.test.tsx` (also JavaScript equivalents). Fan behavior tests live
alongside the feature modules and under `apps/fan/tests`; `pnpm test:watch` supports
interactive development. Tooling tests cover the security runner, not product
behavior. Formatting excludes
existing planning documents, unselected design work and evidence to preserve them.
Shared instructions, skills and links are checked by `pnpm agents:check`.
Read the [security testing procedure](docs/operations/security-testing.md) for
scanner scope, Docker requirements and DAST applicability. Browser, computer-use
and device verification require explicit user agreement.

Production JavaScript/Hermes bundle check (both platforms):

```sh
pnpm export
```

This passed for iOS and Android. Development launch was also verified through
Expo Go 57.0.9 on an iPhone 17 Pro simulator (iOS 26.5) and Pixel 10 emulator
(Android 16 / API 36). See the [setup evidence](.evidence/issue-1/verification.md)
and screenshots. Native IPA/APK compilation and physical-device behavior were
not tested; they are outside this foundation issue.

## Structure and configuration

- `apps/fan/`: Expo React fan app, assets, tests and native/web configuration.
- `services/api/`: backend API source, migrations and AI/report adapters.
- `apps/admin/`: admin workspace package that builds the static admin artifact.
- `packages/contracts/`: shared wire types.
- `packages/travel-domain/`: pure route and sustainability calculations shared by the fan app and API.
- `Swift-App/`: independent Swift/Xcode phone app.
- `docs/`: maintained product, architecture and operating documentation.
- `.env.example`: optional future configuration names, with placeholders only.
- `docs/`, `CONTEXT.md`, `.scratch/`: preserved planning and screen proposals.

The React app reads only public `EXPO_PUBLIC_*` values. Server credentials stay in the API environment. Hosted services and live authentication remain deployment gates.
`EXPO_PUBLIC_*` values are public in app bundles; never put secrets in them. Local
`.env` files, signing keys, dependency folders, generated native projects and
build output are ignored. Only `.env.example` is intended for version control.

Future fan/admin tests should exercise an authenticated backend application
boundary with controlled time, Maps responses, and location samples. Background
tracking and arrival also require physical iOS and Android verification. Starter
launch checks do not establish any of these product behaviors.

## Product planning

- [Product specification](docs/fan-app-specification.md) (open decisions preserved)
- [Glossary](CONTEXT.md)
- [Current planning document](docs/poc-plan.md)
- [Team discussion brief](docs/fan-app-team-brief.html)
- [Screen direction proposals](.scratch/fan-app-design/README.md) (not selected)
- [Repository setup issue](https://github.com/NachikethReddyY/AMR-Fan-App/issues/1)

The specification is preserved as written. Its product-feature decisions remain
separate from this repository setup.
