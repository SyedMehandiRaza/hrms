# Prompt 04 — Go faster (only after 1–2 modules worked well)

## A. Two modules in parallel (git worktrees)
Only for modules that don't depend on each other (e.g. Departments + Leave).
```powershell
cd hrms-project
git worktree add ../hrms-leave -b feature/leave
git worktree add ../hrms-departments -b feature/departments
```
In EACH new folder:
1. copy `backend/.env` and `hrms/.env` from the main folder
2. `cd backend && npm install` and `cd hrms && npm install`
3. use different ports (e.g. backend 5001 / UI 5174) to avoid clashes
4. open Claude Code there and run Prompt 03 for that module
Remove when merged: `git worktree remove ../hrms-leave`

## B. Control from your phone
Start Claude with Remote Control:
```
claude --rc --model opus
```
Scan the QR code with the Claude mobile app (Code tab). Approve, answer, steer from anywhere.
Your PC must stay ON and AWAKE (see section D).

## C. Lint automatically after every edit (hook)
Add this to `.claude/settings.json` (merge with the existing "permissions" key):
```json
"hooks": {
  "PostToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        { "type": "command", "command": "npm run lint --silent --prefix backend" }
      ]
    }
  ]
}
```

## D. Keep working while you're away + auto-resume after limits
1. Stop Windows sleeping (PowerShell as admin):
   ```
   powercfg /change standby-timeout-ac 0
   powercfg /change hibernate-timeout-ac 0
   ```
   Control Panel → Power Options → "When I close the lid" → Do nothing.
2. Run the supervisor (waits out internet drops and 5-hour/weekly limits, then continues):
   ```
   powershell -ExecutionPolicy Bypass -File .\scripts\run-claude.ps1
   ```
3. Optional: Task Scheduler → run that command "At log on", tick
   "Start only if network available".

## E. PC off? Cloud routine
Push the repo to GitHub, then in Claude Code run `/schedule` and create a
routine every 3 hours:
```
In this repo: find the next open ticket (see docs/agents/issue-tracker.md),
/implement it test-first, run backend tests + lint, commit and push to a
claude/ branch. If no open tickets, report ALL_DONE.
```
Note: cloud runs have no .env and no local DB — use it for backend-only tickets
with a test DB configured in the routine's environment variables.
