param([Parameter(Mandatory = $true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'

$root = (git rev-parse --show-toplevel).Trim()
$resolved = (Resolve-Path -LiteralPath $ConfigPath).Path
if ($resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Migration configuration must be outside the repository.'
}
$config = Get-Content -LiteralPath $resolved -Raw | ConvertFrom-Json
if (-not $config.migrationDatabaseUrl -or -not $config.runtimePassword) {
  throw 'Config requires migrationDatabaseUrl and runtimePassword.'
}
$uri = [Uri]$config.migrationDatabaseUrl
if ($uri.UserInfo -notmatch '^amr_staging_admin:') {
  throw 'migrationDatabaseUrl must use the Azure bootstrap administrator amr_staging_admin.'
}
if ($uri.Host -in @('localhost', '127.0.0.1', '::1')) {
  throw 'Azure migration refuses a local database URL.'
}
if ($config.runtimePassword -notmatch '^[A-Za-z0-9_-]{48,128}$') {
  throw 'runtimePassword must be a random 48-128 character value.'
}
$env:AZURE_MIGRATION_DATABASE_URL = [string]$config.migrationDatabaseUrl
$env:AZURE_RUNTIME_DATABASE_PASSWORD = [string]$config.runtimePassword
try {
  node services/api/database/azure-migrate.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Azure migration failed.' }
} finally {
  Remove-Item Env:AZURE_MIGRATION_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:AZURE_RUNTIME_DATABASE_PASSWORD -ErrorAction SilentlyContinue
}
