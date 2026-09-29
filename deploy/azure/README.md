# Azure staging package

This package prepares the API for the selected Azure staging target. It does
not create resources or deploy code by itself. The approved target is a new
resource group in `southeastasia`, using the existing ACR
`amrfanstaging044956` in `rg-amr-fan-staging` and the Entra External ID values
recorded in [`auth-staging.md`](auth-staging.md).

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
4. Complete and review the runtime table/column ACL plan, then use the
   controlled, one-shot migration operation. The current helper is a
   fail-closed refusal guard and cannot apply schema changes; do not run it as
   a deployment step until the reviewed replacement is committed:

   ```powershell
   .\deploy\azure\scripts\migrate.ps1 -ConfigPath C:\private\amr-azure-db.json
   ```

   The private JSON file has `migrationDatabaseUrl` for the Azure bootstrap
   administrator `amr_staging_admin` and a random `runtimePassword` (48–128
   URL-safe characters). It must be outside the repository. The operation
   refuses local URLs, query parameters, the runtime login, unsafe role flags,
   and absent or changed migration history. The bootstrap administrator is not
   the API runtime role; it creates the restricted `amr_api` login and proves
   the runtime cannot alter schema, roles, migration history or admin fields.
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
source, image layers, logs or deployment output. This package does not claim a
live endpoint, database migration, image build, or mobile integration until
those separately authorized actions have completed.
