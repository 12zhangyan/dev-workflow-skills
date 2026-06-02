$ErrorActionPreference = "Stop"

$repo = "https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main"
$skillsDir = "$env:USERPROFILE\.claude\skills"

$files = @(
    "dev-doc/SKILL.md",
    "dev-doc/reference.md",
    "dev-doc/examples.md",
    "code-reading/SKILL.md",
    "code-reading/reference.md"
)

Write-Host "Installing dev-workflow-skills to $skillsDir..."
Write-Host ""

foreach ($file in $files) {
    $dir = Join-Path $skillsDir (Split-Path $file -Parent)
    New-Item -ItemType Directory -Force $dir | Out-Null
    $dest = Join-Path $skillsDir $file
    try {
        Invoke-WebRequest -Uri "$repo/skills/$file" -OutFile $dest -UseBasicParsing -TimeoutSec 30
        Write-Host "  OK $file"
    } catch {
        Write-Error "  Failed to download ${file}: $_"
        exit 1
    }
}

Write-Host ""
Write-Host "Done! Restart Claude Code and try /dev-doc or /code-reading"
