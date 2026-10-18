# setup.ps1 — one-time setup for hrms-project.
# Run from inside hrms-project:  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "`n=== HRMS Claude Code setup in $root ===`n" -ForegroundColor Cyan

# ---------- 1. Prerequisites ----------
$missing = @()

if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
    if ($nodeMajor -ge 20) { Write-Host "OK   Node $(node -v)" -ForegroundColor Green }
    else { Write-Host "OLD  Node $(node -v) - need 20+ (nodejs.org)" -ForegroundColor Red; $missing += "node" }
} else { Write-Host "MISSING Node.js - install from https://nodejs.org" -ForegroundColor Red; $missing += "node" }

if (Get-Command git -ErrorAction SilentlyContinue) { Write-Host "OK   $(git --version)" -ForegroundColor Green }
else { Write-Host "MISSING Git - install from https://git-scm.com" -ForegroundColor Red; $missing += "git" }

if (Get-Command claude -ErrorAction SilentlyContinue) { Write-Host "OK   Claude Code $(claude --version)" -ForegroundColor Green }
else { Write-Host "MISSING Claude Code - run:  irm https://claude.ai/install.ps1 | iex" -ForegroundColor Red; $missing += "claude" }

if (Get-Command mysql -ErrorAction SilentlyContinue) { Write-Host "OK   MySQL client found" -ForegroundColor Green }
else { Write-Host "WARN mysql not on PATH - make sure MySQL 8 is installed (dev.mysql.com/downloads/installer)" -ForegroundColor Yellow }

if ($missing.Count -gt 0) {
    Write-Host "`nInstall the missing tools above, open a NEW terminal, and run this script again." -ForegroundColor Red
    exit 1
}

# ---------- 2. Folders ----------
if (-not (Test-Path "hrms")) {
    Write-Host "`nERROR: hrms/ folder not found. Move your React UI folder into $root\hrms" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "hrms\package.json")) {
    Write-Host "WARN hrms\package.json not found - is your React app really inside hrms\?" -ForegroundColor Yellow
}
New-Item -ItemType Directory -Force -Path "backend","docs" | Out-Null
Write-Host "OK   folders hrms/, backend/, docs/" -ForegroundColor Green

# ---------- 3. Git ----------
if (-not (Test-Path ".git")) {
    git init | Out-Null
    git branch -M main
    Write-Host "OK   git initialised (branch main)" -ForegroundColor Green
} else { Write-Host "OK   git already initialised" -ForegroundColor Green }

# ---------- 4. Playwright browser ----------
Write-Host "`nInstalling Playwright Chromium (for the ui-tester agent)..." -ForegroundColor Cyan
npx -y playwright install chromium

# ---------- 5. Matt Pocock skills ----------
Write-Host "`n=== Installing Matt Pocock's skills ===" -ForegroundColor Cyan
Write-Host "When the installer asks, choose Claude Code as the agent and select:" -ForegroundColor Yellow
Write-Host "  setup-matt-pocock-skills, grill-with-docs, grill-me, to-spec, to-tickets," -ForegroundColor Yellow
Write-Host "  implement, code-review, tdd, diagnose, git-guardrails-claude-code" -ForegroundColor Yellow
Write-Host "  (optional: wayfinder, zoom-out, improve-codebase-architecture)`n" -ForegroundColor Yellow
npx skills@latest add mattpocock/skills

# ---------- 6. First commit ----------
git add .
git commit -m "chore: Claude Code setup (rules, agents, skills, prompts)" | Out-Null
Write-Host "OK   first commit created" -ForegroundColor Green

# ---------- Next steps ----------
Write-Host "`n=== DONE. Next steps ===" -ForegroundColor Cyan
Write-Host "1. Open THIS folder in VS Code:  code ."
Write-Host "2. Open Claude Code (or run: claude). Approve the 'playwright' MCP server when asked."
Write-Host "3. Type:  /setup-matt-pocock-skills   (choose: local markdown tickets, single-context docs)"
Write-Host "4. Follow prompts\01-scaffold-backend.md, then 02, then 03 per module."
Write-Host "Full guide: README.md`n"
