# Issue #1 setup verification

Verified on 25 September 2026. All repository-foundation acceptance criteria pass
locally. This is starter/tooling evidence, not product behavior coverage.

| Criterion | Status / sample | Method and evidence | Confidence / limits |
| --- | --- | --- | --- |
| Reproducible install | Pass; 1 fresh source copy | Copied 30 tracked and non-ignored source files into a new temporary directory, without `node_modules`, `.expo`, or private environment files. `pnpm install --frozen-lockfile` exited 0 and installed 874 packages. | High for the verified macOS toolchain; used pnpm's cached package store. No commit/checkout was created. |
| Documented checks | Pass; 1 fresh-copy run of each | `pnpm check`: typecheck, ESLint, Prettier, and test command all exited 0. | High for this source state. No feature coverage implied. |
| Test tooling | Pass; 0 permanent tests; 1 temporary tooling probe | The repository command reports “No tests found, exiting with code 0”. In the isolated copy, a temporary `.test.tsx` imported `App` and confirmed it was a function; `pnpm test --runInBand` passed. Fixture removed afterward. | Confirms the Expo Jest preset, TypeScript transform, and React Native imports load. Does not test fan behavior or rendering. |
| iOS launch | Pass; 1 iPhone 17 Pro simulator, iOS 26.5 | T3 installed Expo Go 57.0.9; opened the local Metro project. After dismissing Expo onboarding, `agent-device wait text 'Development starter' 10000` exited 0. [Screenshot](ios-starter.png) inspected. | High for development launch on this simulator. No physical-device or native IPA build claim. |
| Android launch | Pass; 1 Pixel 10 emulator, Android 16 / API 36 | T3 installed Expo Go 57.0.9; opened the local Metro project. After dismissing Expo onboarding, the same text wait exited 0. [Screenshot](android-starter.png) inspected. | High for development launch on this emulator. No physical-device or native APK build claim. |
| Bundle builds | Pass; 2 platforms in 1 fresh-copy export | `pnpm exec expo export --platform all` exited 0; generated iOS and Android Hermes bundles plus metadata. | High for JS/Hermes export; not native compilation. |
| Ignore rules and secrets | Pass; 11 representative ignored paths and 32 candidate files inspected | `.env`, `.env.local`, `.env.production`, dependencies, Expo cache, output, coverage, generated native directories, and signing-key samples are ignored. `.env.example` is not ignored. No private-key, GitHub-token, AWS-access-key, or API-key patterns found in candidate files. | Pattern checks are limited to the named formats; configuration/source was also read. No real credentials were added. |
| Planning and documentation | Pass; 9 tracked planning files and 1 restored specification | Existing `docs/`, `.scratch/` and glossary files are byte-identical to HEAD. The missing specification was copied byte-for-byte from the main worktree. All README local links resolve. | High for preservation and local links. Open product decisions remain untouched. |
| Scope boundary | Pass; 1 starter component | `index.ts` registers `src/App.tsx`. It displays only “AMR Fan App” and “Development starter”. Convex directory contains documentation only. | No auth, schema, connection, routing, points, challenge, store, or tree behavior exists in this setup. |

## Toolchain and repeatable checks

- Node.js 24.20.0; pnpm 12.6.0.
- Expo 57.0.25; React Native 0.86.3; React 19.2.3.
- Local Metro started with `pnpm start --port 8081`.
- Both screenshots show the expected neutral screen without an error overlay.
  The floating gear belongs to Expo Go's development tools.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm exec expo export --platform all
pnpm start
# Press i/a, or open the displayed project URL in Expo Go.
```

The full specification, glossary, team brief, research, and unselected screen
proposals remain planning material. The future authenticated Convex boundary,
controlled time/Maps/location testing, and physical-device tracking checks are
documented in the README and `convex/README.md`; none are implemented here.

## Verification scope

This report records setup verification before PR preparation. Delivery is tracked
in the branch and PR history. No deployment or live backend provisioning was
performed. Native binary builds and physical-device behavior are outside issue
#1's development-launch acceptance criteria and remain unverified.
