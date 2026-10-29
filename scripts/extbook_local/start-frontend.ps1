<#
Local acceptance frontend for the external-booking enhancement: Vite dev server on http://127.0.0.1:8080,
proxying /api to the local acceptance backend on http://127.0.0.1:8000 (see vite.config.ts).

Refuses to start if VITE_API_URL is set (it would bypass the local proxy) or if a .env file in this worktree sets it.
No .env file is created or changed.
#>
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ((Split-Path -Leaf $Root) -ne "wt-fe-extbook") { throw "Refusing to run outside the wt-fe-extbook worktree." }
if ($env:VITE_API_URL) { throw "VITE_API_URL is set in this shell; unset it so the dev proxy to 127.0.0.1:8000 is used." }
foreach ($f in Get-ChildItem -Path $Root -Filter ".env*" -File -Force -ErrorAction SilentlyContinue) {
    if (Select-String -Path $f.FullName -Pattern '^\s*VITE_API_URL\s*=' -Quiet) {
        throw "$($f.Name) sets VITE_API_URL; the acceptance frontend must use the local proxy."
    }
}
Push-Location $Root
try {
    Write-Host "Frontend: http://127.0.0.1:8080  (API proxied to http://127.0.0.1:8000)"
    & npx vite --host 127.0.0.1 --port 8080 --strictPort
}
finally { Pop-Location }
