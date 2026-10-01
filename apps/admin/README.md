# Admin app

`pages/` owns the static admin interface. The backend serves this exact file
allowlist for local use, and `pnpm --filter @amr/admin build` creates the separate
admin web artifact. Authentication and authorization remain in the API.
