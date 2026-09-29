# Azure staging package

This package prepares the API for the selected Azure staging target. It does
not create resources or deploy code by itself. An authorized deployment created
the staging target in `southeastasia`, using the existing ACR
`amrfanstaging044956` in `rg-amr-fan-staging` and the Entra External ID values
recorded in [`auth-staging.md`](auth-staging.md).

The running API image is from `36996ec95b1cc62a3c1ef583e1e30714a814efe0`.
PR #67 currently ends at `c2aba734e0d8036fb4f83a738354ee49722ba11e`; that head
has not been deployed, so this package does not claim that its later code is
live. Its new migrations `0018_activity_rewards_no_daily_cap.sql` and
`0019_activity_journey_link.sql` are not applied to the running database.

The Bicep template creates a VNet with separate delegated subnets, a private
PostgreSQL Flexible Server, its private DNS zone/link, a Key Vault, a user
assigned managed identity, Log Analytics, and a Consumption Container Apps
environment. PostgreSQL public network access is disabled and TLS is required.
The API identity receives only ACR pull and Key Vault secret read roles. The
API image is a digest reference; mutable tags are not accepted by the template.

The API image is built from the repository root with
`services/api/Dockerfile.azure`. The existing `services/api/api/Dockerfile`
remains the local DAST fixture and is not a release image. The image starts
`services/api/api/start.ts` on port 8080. The approved build path is the pinned
GitHub Actions workflow [`azure-image.yml`](../../.github/workflows/azure-image.yml),
which uses GitHub OIDC and the scoped ACR push identity, then publishes only an
immutable digest artifact. `build-image.ps1` remains a local archive-based ACR
Tasks fallback; the selected subscription rejected that path with
`TasksOperationsNotAllowed`.

## Controlled order

1. Obtain the resource-group deployment scope and create the resource group in
   the selected region. Keep `deployApi=false` in the first deployment.
2. Build the image with an approved builder and record its `sha256:` digest.
3. Deploy `main.bicep` using a private parameter file. Do not commit that file;
   `parameters.example.json` contains placeholders only. The admin password is
   supplied only to PostgreSQL provisioning. No Luna or route-provider secret
   is part of this package.
4. Run the controlled, one-shot migration operation from a worker that can
   reach the private PostgreSQL subnet:

   ```powershell
   .\deploy\azure\scripts\migrate.ps1 -ConfigPath C:\private\amr-azure-db.json
   ```

   The private JSON file has `migrationDatabaseUrl` for the Azure bootstrap
   administrator `amr_staging_admin` and a random `runtimePassword` (48–128
   URL-safe characters). It must be outside the repository. The operation
   refuses non-Azure/local URLs, query parameters, the runtime login, unsafe
   role flags, and absent or changed migration history. It applies migrations
   twice through the checksum ledger, creates the restricted `amr_api` login,
   and proves normal account/profile/session writes work while schema, role,
   migration-ledger and admin-field writes fail. The bootstrap administrator
   never becomes the API runtime identity.

5. After that reviewed migration operation creates and grants the runtime
   login, store its TLS URL as Key Vault secret `database-url`. The value is
   never written to this repository or printed.
6. Redeploy the same Bicep parameters with `deployApi=true` and
   `minReplicas=1`. The Container App reads the secret through its managed
   identity and uses `/health` for liveness and `/ready` for database readiness.
7. Verify the endpoint and authenticated API flows before connecting the Swift
   app. Keep `ACTIVITY_ASSESSMENT_ENABLED=false`; the activity provider and Luna
   remain disabled until a separate provider/privacy review supplies credentials.

Do not run migrations from API startup, and do not put the migration URL,
runtime password, OIDC client secret or Luna key in `EXPO_PUBLIC_*`, Bicep
source, image layers, logs or deployment output. Live mobile authentication and
protected feature flows remain unverified.
