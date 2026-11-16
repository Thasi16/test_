param([Parameter(Mandatory=$true)][string]$ModelRoot, [string]$Python='python')
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $repo
try {
    & $Python -B -m ai_inference.deploy.compare_parity .runtime/parity/windows .runtime/parity/linux --output ai_inference/reports/vercel-parity.json
    if ($LASTEXITCODE -ne 0) { throw 'Preview release blocked: original pipeline parity has not passed.' }
    if (-not (Test-Path -LiteralPath '.vercel/project.json')) { throw 'The existing Vercel project must be linked before deploying.' }
    & $Python -B -m ai_inference.deploy.package_service --model-root $ModelRoot
    if ($LASTEXITCODE -ne 0) { throw 'Private model packaging failed.' }
    & npx --yes vercel@65.16.0 deploy --yes --archive=tgz
    if ($LASTEXITCODE -ne 0) { throw 'Preview deployment failed. Production has not been promoted.' }
} finally { Pop-Location }
