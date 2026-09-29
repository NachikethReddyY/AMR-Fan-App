import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const text = async (path) => readFile(new URL(path, root), 'utf8');

test('Azure template keeps the database private and image immutable', async () => {
  const bicep = await text('deploy/azure/main.bicep');
  assert.match(bicep, /publicNetworkAccess:\s*'Disabled'/);
  assert.match(bicep, /privatelink\.postgres\.database\.azure\.com/);
  assert.match(bicep, /imageDigest/);
  assert.match(bicep, /ACTIVITY_ASSESSMENT_ENABLED.*false/);
  assert.match(bicep, /LUNA_REPORT_EXTRACTION_ENABLED.*false/);
  assert.match(bicep, /keyVaultUrl/);
  assert.match(bicep, /Key Vault|keyVault/i);
  assert.match(bicep, /path: '\/health'/);
  assert.match(bicep, /path: '\/ready'/);
  assert.doesNotMatch(bicep, /:latest|value:\s*['"]latest['"]/i);
});

test('production image starts the real API and excludes local material', async () => {
  const dockerfile = await text('services/api/Dockerfile.azure');
  const ignore = await text('.dockerignore');
  assert.match(dockerfile, /services\/api\/api\/start\.ts/);
  assert.doesNotMatch(dockerfile, /dast-start/);
  assert.match(dockerfile, /pnpm install --frozen-lockfile/);
  assert.match(ignore, /node_modules/);
  assert.match(ignore, /\.env/);
  assert.match(ignore, /Swift-App/);
});

test('deployment helpers use private inputs and the reviewed runtime surface', async () => {
  const build = await text('deploy/azure/scripts/build-image.ps1');
  const migrate = await text('deploy/azure/scripts/migrate.ps1');
  const runner = await text('services/api/database/azure-migrate.mjs');
  assert.match(build, /git archive/);
  assert.match(build, /acr manifest list-metadata/);
  assert.match(build, /sha256:\[0-9a-f\]\{64\}/);
  assert.match(migrate, /outside the repository/);
  assert.match(migrate, /Remove-Item Env:AZURE_/);
  assert.match(runner, /amr_staging_admin/);
  assert.match(runner, /CREATE ROLE \$\{RUNTIME\}/);
  assert.match(runner, /GRANT SELECT ON public\.schema_migrations/);
  assert.match(runner, /ON CONFLICT \(issuer, subject\)/);
  assert.match(runner, /SAVEPOINT/);
  assert.match(runner, /inPhase/);
  assert.doesNotMatch(runner, /console\.log\(.*Password/i);
});

test('migration helper refuses before opening a database without credentials', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, ['services/api/database/azure-migrate.mjs'], {
    cwd: new URL('../', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, AZURE_MIGRATION_DATABASE_URL: '', AZURE_RUNTIME_DATABASE_PASSWORD: '' },
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /Migration credentials/);
});
