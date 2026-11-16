param([Parameter(Mandatory=$true)][string]$ModelRoot, [string]$Python='python')
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $repo
try {
    & $Python -B -m ai_inference.deploy.compare_parity .runtime/parity/windows-v2 .runtime/parity/linux-compatible --output ai_inference/reports/vercel-parity-compatible.json
    if ($LASTEXITCODE -ne 0) { throw 'Preview release blocked: original pipeline parity has not passed.' }
    $memory=Get-Content ai_inference/reports/vercel-memory-compatible.json -Raw | ConvertFrom-Json
    if($memory.compatible_peak_cgroup_bytes -gt 0.8*$memory.memory_limit_bytes -or $memory.compatible_events.oom_kill -ne 0) { throw 'Preview blocked: memory headroom gate failed.' }
    $blob=Get-Content ai_inference/reports/vercel-blob-cleanup-compatible.json -Raw | ConvertFrom-Json
    if($blob.rows.Count -ne 3 -or @($blob.rows | Where-Object {-not $_.deleted}).Count -gt 0) { throw 'Preview blocked: real Blob cleanup evidence required.' }
    $redis=Get-Content ai_inference/reports/vercel-cloud-redis-replay.json -Raw | ConvertFrom-Json
    if((@($redis.rows.status | Sort-Object) -join ',') -ne '200,401') { throw 'Preview blocked: shared cloud replay protection failed.' }
    $tests=Get-Content ai_inference/reports/vercel-regression-compatible.json -Raw | ConvertFrom-Json
    if(-not $tests.passed) { throw 'Preview blocked: regression checks incomplete.' }
    if (-not (Test-Path -LiteralPath '.vercel/project.json')) { throw 'The existing Vercel project must be linked before deploying.' }
    & $Python -B -m ai_inference.deploy.package_service --model-root $ModelRoot
    if ($LASTEXITCODE -ne 0) { throw 'Private model packaging failed.' }
    # Explicit path/project/environment avoids the common Git worktree root.
    & npx --yes vercel@65.16.0 deploy --yes --archive=tgz --environment preview --project prj_wtJlUbLLBMgSXUpA0dyMYOjRHxpo --scope thasi1 --cwd $repo
    if ($LASTEXITCODE -ne 0) { throw 'Preview deployment failed. Production has not been promoted.' }
} finally { Pop-Location }
