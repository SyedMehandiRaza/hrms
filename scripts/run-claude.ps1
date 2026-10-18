# run-claude.ps1 — keeps Claude Code working through internet drops and usage limits.
# Usage (from hrms-project):  powershell -ExecutionPolicy Bypass -File .\scripts\run-claude.ps1
# Stop anytime with Ctrl+C. Log: %USERPROFILE%\hrms-claude-runs.log

$repo    = Split-Path -Parent $PSScriptRoot
$log     = Join-Path $env:USERPROFILE "hrms-claude-runs.log"
$maxRuns = 40   # hard cap so a confused loop can't burn your whole weekly limit

$prompt = @"
Read CLAUDE.md and docs/agents/issue-tracker.md. Find the next OPEN ticket in order.
/implement it test-first following the CLAUDE.md files. Run backend npm test + npm run lint
and hrms npm run lint. For UI tickets call the ui-tester agent. Fix until green, close the
ticket, and commit. Do exactly ONE ticket, then stop.
If a ticket is unclear, write the question into the ticket, skip it, and pick the next.
If there are no open tickets left, reply with the single word ALL_DONE.
"@

Set-Location $repo
Write-Host "Supervisor started in $repo. Log: $log" -ForegroundColor Cyan

for ($i = 1; $i -le $maxRuns; $i++) {

    # 1) Wait for internet
    while (-not (Test-NetConnection api.anthropic.com -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue)) {
        Add-Content $log "$(Get-Date)  no internet - retry in 2 min"
        Start-Sleep -Seconds 120
    }

    # 2) One fresh, short run (fresh context = cheaper + better quality than --resume)
    Write-Host "Run $i  $(Get-Date)" -ForegroundColor Yellow
    # Model pinned to Opus on purpose: this project does NOT use the Fable model.
    $out = claude -p $prompt --model opus --permission-mode acceptEdits `
        --allowedTools "Bash(npm *)" "Bash(npx sequelize-cli *)" "Bash(git add *)" "Bash(git commit *)" "Bash(git status)" "Bash(git diff *)" `
        2>&1 | Out-String
    $code = $LASTEXITCODE
    Add-Content $log "`n===== Run $i  $(Get-Date)  exit=$code =====`n$out"

    # 3) Decide next step
    if ($out -match "ALL_DONE") {
        Write-Host "All tickets done." -ForegroundColor Green
        break
    }
    if ($out -match "hit your limit|usage limit|limit reached|resets") {
        Add-Content $log "$(Get-Date)  usage limit - checking again in 30 min"
        Write-Host "Usage limit hit. Waiting 30 min..." -ForegroundColor Magenta
        Start-Sleep -Seconds 1800
        continue
    }
    if ($code -ne 0) {
        Add-Content $log "$(Get-Date)  error exit $code - retry in 2 min"
        Start-Sleep -Seconds 120
        continue
    }
}
Write-Host "Supervisor finished. Review the log and git log." -ForegroundColor Cyan
