# Legacy

Retired code kept for reference. It is **not** part of the build, checks,
or Docker images.

| Path | What it was | Status |
| --- | --- | --- |
| `react-native/` | Expo React Native fan app (`@amr/fan`) | Archived 2026-10-11. The phone apps are now native: `Swift-App/` (iOS) and `Kotlin-App/` (Android). |
| `SWIFT-BACKEND-HANDOFF.md` | Swift demo ↔ backend integration state note | Archived 2026-10-11. Superseded by current docs; kept for reference. |

Rules for this folder:

- The package stays a workspace member (`pnpm-workspace.yaml`) only so that
  backend contract tests resolve its client helpers. No root script builds,
  tests, lints or exports it, and no Docker image ships it.
- The backend API keeps a file import of the archived journey/account helpers
  in one database-gated awards test; route-comparison tests import the
  maintained `@amr/travel-domain/comparison` module directly.
- Do not add new code here. Either revive a file into its proper maintained
  location or leave the archive frozen.
