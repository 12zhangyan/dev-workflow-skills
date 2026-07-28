param(
    [string[]]$Targets,
    [switch]$Status,
    [switch]$Doctor,
    [switch]$Backups,
    [string]$Restore,
    [switch]$BackupPrune,
    [switch]$DryRun,
    [string]$Skill,
    [Nullable[int]]$Keep,
    [string]$Ref = "main",
    [string]$Sha256,
    [switch]$MigrateLegacy
)

$ErrorActionPreference = "Stop"
$effectiveRef = if ($env:DEV_WORKFLOW_SKILLS_REF) { $env:DEV_WORKFLOW_SKILLS_REF } else { $Ref }
$effectiveSha256 = if ($env:DEV_WORKFLOW_SKILLS_SHA256) { $env:DEV_WORKFLOW_SKILLS_SHA256 } else { $Sha256 }
$zipUrl = if ($env:DEV_WORKFLOW_SKILLS_ZIP) {
    $env:DEV_WORKFLOW_SKILLS_ZIP
} else {
    "https://github.com/12zhangyan/dev-workflow-skills/archive/$effectiveRef.zip"
}

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
        $sourceVersion = $null
        if (-not (Test-Path (Join-Path $srcDir.FullName "scripts\install-core.js"))) {
            throw "DEV_WORKFLOW_SKILLS_SOURCE does not contain scripts/install-core.js"
        }
    } else {
        $sourceVersion = $effectiveRef
        $zipPath = Join-Path $tmpDir "repo.zip"
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 60
        if ($effectiveSha256) {
            $actualSha256 = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
            if ($actualSha256 -ne $effectiveSha256) {
                throw "SHA-256 mismatch: expected $effectiveSha256, got $actualSha256"
            }
        }
        Expand-Archive -Path $zipPath -DestinationPath $tmpDir
        $srcDir = Get-ChildItem -Path $tmpDir -Directory |
            Where-Object { Test-Path (Join-Path $_.FullName "scripts\install-core.js") } |
            Select-Object -First 1
    }
    if ($null -eq $srcDir) { throw "repository root not found in downloaded archive" }

    $commands = @($Status, $Doctor, $Backups, [bool]$Restore, $BackupPrune) |
        Where-Object { $_ }
    if ($commands.Count -gt 1) {
        throw "Choose only one of -Status, -Doctor, -Backups, -Restore, or -BackupPrune."
    }
    $command = if ($Doctor) {
        "doctor"
    } elseif ($Status) {
        "status"
    } elseif ($Backups) {
        "backups"
    } elseif ($Restore) {
        "restore"
    } elseif ($BackupPrune) {
        "backup-prune"
    } else {
        "install"
    }
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
    if ($sourceVersion) {
        $arguments += @("--version", $sourceVersion)
    }
    if ($MigrateLegacy) {
        $arguments += "--migrate-legacy"
    }
    if ($DryRun) {
        $arguments += "--dry-run"
    }
    if ($Restore) {
        $arguments += @("--backup", $Restore)
    }
    if ($Skill) {
        $arguments += @("--skill", $Skill)
    }
    if ($null -ne $Keep) {
        $arguments += @("--keep", $Keep.Value)
    }

    & node @arguments
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
