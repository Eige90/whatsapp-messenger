$ErrorActionPreference = "Stop"
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Project

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    $portable = Get-ChildItem "$env:USERPROFILE\Tools\nodejs\node-v*-win-x64\node.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
    if ($portable) {
        $env:Path = "$(Split-Path $portable.FullName -Parent);$env:Path"
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js was not found. Install Node.js 24+ or add it to PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    & npm.cmd install
}

& npm.cmd start
