# notify.ps1 — sends a push notification to your phone (and optionally an email)
# using ntfy (free, no account needed).
#
# ONE-TIME SETUP
# 1. Install the "ntfy" app on your phone (Play Store / App Store).
# 2. In the app tap "+" and subscribe to a SECRET topic name you invent,
#    e.g. hrms-ravi-7f3k9q   (anyone who knows the name can read it, so make it random)
# 3. In PowerShell (once), then open a NEW terminal:
#      setx HRMS_NTFY_TOPIC "hrms-ravi-7f3k9q"
#      setx HRMS_NOTIFY_EMAIL "you@example.com"     # optional: also send an email
# 4. Test:
#      powershell -ExecutionPolicy Bypass -File scripts\notify.ps1 "Hello from HRMS"
#
# USAGE
#   powershell -ExecutionPolicy Bypass -File scripts\notify.ps1 "message" "optional title"

param(
    [string]$Message = "HRMS update",
    [string]$Title   = "HRMS Claude"
)

$topic = $env:HRMS_NTFY_TOPIC
$email = $env:HRMS_NOTIFY_EMAIL

if (-not $topic) {
    Write-Host "HRMS_NTFY_TOPIC not set - see setup notes at the top of scripts\notify.ps1" -ForegroundColor Yellow
    exit 0
}

$headers = @{ "Title" = $Title }
if ($email) { $headers["Email"] = $email }   # ntfy forwards the message to this address

try {
    Invoke-RestMethod -Method Post -Uri "https://ntfy.sh/$topic" -Body $Message -Headers $headers | Out-Null
    Write-Host "Notification sent: $Message" -ForegroundColor Green
} catch {
    Write-Host "Notification failed: $($_.Exception.Message)" -ForegroundColor Red
}
