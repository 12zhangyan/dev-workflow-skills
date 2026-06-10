$ErrorActionPreference = "Stop"

$zipUrl = "https://github.com/12zhangyan/dev-workflow-skills/archive/refs/heads/main.zip"
$skillsDir = "$env:USERPROFILE\.claude\skills"

Write-Host "Installing dev-workflow-skills to $skillsDir..."
Write-Host ""

$tmpDir = Join-Path $env:TEMP ("dev-workflow-skills-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force $tmpDir | Out-Null

try {
    $zipPath = Join-Path $tmpDir "repo.zip"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 60
    Expand-Archive -Path $zipPath -DestinationPath $tmpDir

    $srcDir = Get-ChildItem -Path $tmpDir -Directory |
        Where-Object { Test-Path (Join-Path $_.FullName "skills") } |
        Select-Object -First 1
    if ($null -eq $srcDir) { throw "skills/ directory not found in downloaded archive" }

    New-Item -ItemType Directory -Force $skillsDir | Out-Null
    Get-ChildItem -Path (Join-Path $srcDir.FullName "skills") -Directory | ForEach-Object {
        $dest = Join-Path $skillsDir $_.Name
        if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
        Copy-Item -Recurse $_.FullName $dest
        Write-Host "  OK $($_.Name)"
    }
} finally {
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Done! Restart Claude Code and try /dev-doc, /code-reading or /bug-fix"
