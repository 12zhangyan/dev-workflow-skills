param(
    [string[]]$Targets,
    [switch]$Status,
    [switch]$MigrateLegacy
)

$ErrorActionPreference = "Stop"
$zipUrl = "https://github.com/12zhangyan/dev-workflow-skills/archive/refs/heads/main.zip"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is required for safe installation and Codex BOM normalization."
}
if (-not $env:USERPROFILE) {
    throw "USERPROFILE is required."
}

$tmpDir = Join-Path $env:TEMP ("dev-workflow-skills-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force $tmpDir | Out-Null

try {
    if ($env:DEV_WORKFLOW_SKILLS_SOURCE) {
        $srcDir = Get-Item -LiteralPath $env:DEV_WORKFLOW_SKILLS_SOURCE
        if (-not (Test-Path (Join-Path $srcDir.FullName "scripts\install-core.js"))) {
            throw "DEV_WORKFLOW_SKILLS_SOURCE does not contain scripts/install-core.js"
        }
    } else {
        $zipPath = Join-Path $tmpDir "repo.zip"
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 60
        Expand-Archive -Path $zipPath -DestinationPath $tmpDir
        $srcDir = Get-ChildItem -Path $tmpDir -Directory |
            Where-Object { Test-Path (Join-Path $_.FullName "scripts\install-core.js") } |
            Select-Object -First 1
    }
    if ($null -eq $srcDir) { throw "repository root not found in downloaded archive" }

    $command = if ($Status) { "status" } else { "install" }
    $arguments = @(
        (Join-Path $srcDir.FullName "scripts\install-core.js"),
        $command,
        "--source", $srcDir.FullName,
        "--home", $env:USERPROFILE
    )
    if ($Targets -and $Targets.Count -gt 0) {
        $arguments += "--targets"
        $arguments += $Targets
    }
    if ($MigrateLegacy) {
        $arguments += "--migrate-legacy"
    }

    & node @arguments
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
