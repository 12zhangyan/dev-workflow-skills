param(
    [string[]]$Targets
)

$ErrorActionPreference = "Stop"

$zipUrl = "https://github.com/12zhangyan/dev-workflow-skills/archive/refs/heads/main.zip"
if ($null -eq $Targets -or $Targets.Count -eq 0) {
    $Targets = @("claude", "cursor", "codex")
}

Write-Host "Installing dev-workflow-skills..."
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

    foreach ($target in $Targets) {
        switch ($target.ToLowerInvariant()) {
            "claude" { $skillsDir = "$env:USERPROFILE\.claude\skills"; $label = "Claude Code" }
            "cursor" { $skillsDir = "$env:USERPROFILE\.cursor\skills"; $label = "Cursor" }
            "codex" { $skillsDir = "$env:USERPROFILE\.codex\skills"; $label = "Codex" }
            default { throw "Unknown target: $target (allowed: claude cursor codex)" }
        }

        Write-Host "==> $label`: $skillsDir"
        New-Item -ItemType Directory -Force $skillsDir | Out-Null
        Get-ChildItem -Path (Join-Path $srcDir.FullName "skills") -Directory | ForEach-Object {
            $dest = Join-Path $skillsDir $_.Name
            if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
            Copy-Item -Recurse $_.FullName $dest
            Write-Host "  OK $($_.Name)"
        }
        Write-Host ""
    }
} finally {
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Done! Restart Claude Code / Cursor / Codex to load the skills."
Write-Host "Claude Code usually uses slash names like /dev-doc; Codex can use `$dev-doc or natural language such as '按 dev-doc 生成开发文档'."
