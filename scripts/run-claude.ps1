# run-claude.ps1 — works through open tickets by itself, unattended.
#  - keeps Windows AWAKE while it runs (no sleep), restores normal sleep when it stops
#  - waits when the internet is down, continues automatically when it's back
#  - waits out the 5-hour AND weekly usage limits, then restarts automatically
#  - only one copy can run at a time (safe to auto-start at logon)
#  - sends phone/email notifications via scripts\notify.ps1 (optional, see its notes)
#
# Usage (from hrms-project):  powershell -ExecutionPolicy Bypass -File .\scripts\run-claude.ps1
# Stop anytime with Ctrl+C. Log: %USERPROFILE%\hrms-claude-runs.log

$repo        = Split-Path -Parent $PSScriptRoot
$log         = Join-Path $env:USERPROFILE "hrms-claude-runs.log"
$notify      = Join-Path $PSScriptRoot "notify.ps1"
$maxTickets  = 40    # cost safety: max successful runs (limit/internet waits don't count)
$maxErrors   = 10    # stop after this many non-network errors in a row
$limitCheck  = 1800  # seconds between checks while a usage limit is active (30 min)
$netCheck    = 60    # seconds between internet checks while offline

$prompt = @"
Read CLAUDE.md and docs/agents/issue-tracker.md. Find the next OPEN ticket in order.
/implement it test-first following the CLAUDE.md files. Run backend npm test + npm run lint
and hrms npm run lint. For UI tickets call the ui-tester agent. Fix until green, close the
ticket, and commit. Do exactly ONE ticket, then stop.
If a ticket is unclear, write the question into the ticket, skip it, and pick the next.
At the end print one line: TICKET_DONE: <ticket title>
If there are no open tickets left, reply with the single word ALL_DONE.
"@

# ---------- only one supervisor at a time ----------
$mutex = New-Object System.Threading.Mutex($false, "Global\HRMSClaudeSupervisor")
if (-not $mutex.WaitOne(0)) {
    Write-Host "Supervisor already running - exiting." -ForegroundColor Yellow
    exit 0
}

# ---------- keep Windows awake while this script runs ----------
Add-Type -Namespace Win32 -Name Power -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern uint SetThreadExecutionState(uint esFlags);
'@
$ES_CONTINUOUS        = [uint32]2147483648   # 0x80000000
$ES_SYSTEM_REQUIRED   = [uint32]1            # 0x00000001
$KEEP_AWAKE           = [uint32]($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
function Stay-Awake { [Win32.Power]::SetThreadExecutionState($KEEP_AWAKE) | Out-Null }

function Send-Note($msg) {
    Add-Content $log "$(Get-Date)  NOTIFY: $msg"
    if (Test-Path $notify) { & powershell -ExecutionPolicy Bypass -File $notify $msg "HRMS Claude" | Out-Null }
}

function Test-Internet {
    try { return Test-NetConnection api.anthropic.com -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue }
    catch { return $false }
}

Set-Location $repo
$done = 0; $errors = 0; $inLimit = $false

try {
    Stay-Awake
    Write-Host "Supervisor started in $repo (PC will NOT sleep while this runs). Log: $log" -ForegroundColor Cyan
    Send-Note "Supervisor started - working on open tickets"

    while ($done -lt $maxTickets) {
        Stay-Awake

        # 1) Internet down? Wait here, then continue automatically when it's back.
        if (-not (Test-Internet)) {
            Send-Note "Internet down - waiting, will continue automatically"
            Write-Host "No internet. Waiting..." -ForegroundColor DarkYellow
            while (-not (Test-Internet)) { Stay-Awake; Start-Sleep -Seconds $netCheck }
            Write-Host "Internet back. Continuing." -ForegroundColor Green
            Send-Note "Internet back - continuing"
        }

        # 2) One fresh, short run. Model pinned to Opus: this project does NOT use the Fable model.
        Write-Host "Run $($done + 1)  $(Get-Date)" -ForegroundColor Yellow
        $out = claude -p $prompt --model opus --permission-mode acceptEdits `
            --allowedTools "Bash(npm *)" "Bash(npx sequelize-cli *)" "Bash(npx cross-env *)" "Bash(git add *)" "Bash(git commit *)" "Bash(git status)" "Bash(git diff *)" "Bash(git log *)" `
            2>&1 | Out-String
        $code = $LASTEXITCODE
        Add-Content $log "`n===== $(Get-Date)  exit=$code =====`n$out"

        # 3) Usage limit (5-hour or weekly): wait and retry; doesn't count as a run
        if ($out -match "hit your limit|usage limit|limit reached|rate limit|resets") {
            if (-not $inLimit) {
                $inLimit = $true
                Send-Note "Usage limit reached - will resume automatically when it resets"
            }
            Write-Host "Usage limit active. Checking again in $($limitCheck/60) min..." -ForegroundColor Magenta
            Start-Sleep -Seconds $limitCheck
            continue
        }
        if ($inLimit) { $inLimit = $false; Send-Note "Limit reset - Claude resumed work" }

        # 4) Finished everything
        if ($out -match "ALL_DONE") {
            Send-Note "ALL tickets done ($done this session). Please review git log."
            Write-Host "All tickets done." -ForegroundColor Green
            break
        }

        # 5) Errors: if the internet dropped mid-run, just loop (step 1 waits). Otherwise count it.
        if ($code -ne 0) {
            if (-not (Test-Internet)) { continue }
            $errors++
            if ($errors -ge $maxErrors) { Send-Note "Stopped: $errors errors in a row. Check the log."; break }
            Start-Sleep -Seconds 120
            continue
        }

        # 6) A ticket finished
        $errors = 0
        $done++
        if ($out -match "TICKET_DONE:\s*(.+)") { Send-Note "Done: $($Matches[1].Trim())" }
    }

    if ($done -ge $maxTickets) { Send-Note "Stopped at safety cap of $maxTickets tickets. Review and restart." }
}
finally {
    # restore normal Windows sleep behaviour and release the lock
    [Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS) | Out-Null
    $mutex.ReleaseMutex() | Out-Null
    Write-Host "Supervisor finished. Normal sleep restored. Review the log and git log." -ForegroundColor Cyan
}
