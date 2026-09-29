param(
  [string]$Registry = 'amrfanstaging044956',
  [string]$Repository = 'amr-api',
  [string]$ResourceGroup = 'rg-amr-fan-staging'
)
$ErrorActionPreference = 'Stop'

$root = (git rev-parse --show-toplevel).Trim()
$sha = (git rev-parse HEAD).Trim()
if (-not $sha -or (git status --porcelain)) {
  throw 'Build requires a clean commit so the image can be traced to one revision.'
}
$az = Get-Command az -ErrorAction SilentlyContinue
if (-not $az) { throw 'Azure CLI is required for an ACR build.' }
$temp = Join-Path ([IO.Path]::GetTempPath()) ("amr-acr-" + [Guid]::NewGuid().ToString('N'))
$archive = "$temp.tar"
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  # Use git archive to send tracked files instead of local node_modules/evidence.
  git -C $root archive --format=tar --output=$archive HEAD
  if ($LASTEXITCODE -ne 0) { throw 'Could not create tracked build archive.' }
  tar -xf $archive -C $temp
  if ($LASTEXITCODE -ne 0) { throw 'Could not unpack tracked build archive.' }
  $tag = "$Repository`:$sha"
  az acr build --registry $Registry --resource-group $ResourceGroup `
    --image $tag --file services/api/Dockerfile.azure $temp
  $digest = (az acr manifest list-metadata --registry $Registry --name $Repository `
    --resource-group $ResourceGroup --query "[?tags[?@ == '$sha']].digest | [0]" -o tsv).Trim()
  if ($digest -notmatch '^sha256:[0-9a-f]{64}$') { throw 'ACR did not return an immutable digest.' }
  "${Registry}.azurecr.io/${Repository}@${digest}"
} finally {
  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
