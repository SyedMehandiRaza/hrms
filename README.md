# HRMS + Claude Code — Setup From Zero

This kit turns your static React HRMS UI into a working app using Claude Code,
with Matt Pocock's skills for the process and a browser-testing agent for quality.

> ⚠️ **Model rule for this project: do NOT use the Fable model.**
> Use **Opus** (main work) and **Sonnet** (agents). `.claude/settings.json` sets
> `"model": "opus"`, the ui-tester agent uses `sonnet`, and the scripts pass
> `--model opus`. Never pick Fable in `/model` or the model dropdown.
> Check anytime by typing `/model` in Claude Code.

**Stack (defaults):** React + Vite + axios · Node + Express · MySQL 8 + Sequelize ·
Joi · JWT · Jest + supertest. Change them in the `CLAUDE.md` files if yours differ.

---

## 0. What's in this kit

```
hrms-project/
├── README.md                    ← this guide
├── CLAUDE.md                    ← project rules (Claude reads every session)
├── .gitignore
├── .mcp.json                    ← Playwright browser tool (for ui-tester)
├── .claude/
│   ├── settings.json            ← model = opus, safe permissions, blocks .env
│   └── agents/ui-tester.md      ← tests flows in a real browser
├── hrms/
│   ├── CLAUDE.md                ← React rules   (merge into YOUR hrms folder)
│   └── .env.example
├── backend/
│   ├── CLAUDE.md                ← backend rules
│   └── .env.example
├── docs/test-users.md           ← test logins per role
├── prompts/                     ← copy-paste prompts, in order 01 → 04
└── scripts/
    ├── setup.ps1                ← one-time setup
    └── run-claude.ps1           ← auto-resume supervisor
```

| Piece | Who provides it |
|---|---|
| Process: interview → spec → tickets → build → review | **Matt Pocock's skills** |
| Your stack + rules | **CLAUDE.md files** (this kit) |
| Real browser testing | **ui-tester agent + Playwright** (this kit) |
| Safety + model choice | **.claude/settings.json** (this kit) |

---

## 1. Install tools (once per PC)

1. **Node.js 20+** → https://nodejs.org  (check: `node -v`)
2. **Git** → https://git-scm.com  (check: `git --version`)
3. **MySQL 8** → https://dev.mysql.com/downloads/installer/  (choose MySQL Server + Workbench; remember the root password)
4. **Claude Code** (PowerShell):
   ```powershell
   irm https://claude.ai/install.ps1 | iex
   claude --version
   ```
5. **VS Code** + the **Claude Code** extension.
6. Log in once: run `claude` in a terminal and follow the login.

---

## 2. Put the kit and your UI together

1. Unzip this kit → you get `hrms-project/`.
2. **Copy your existing React folder's contents into `hrms-project/hrms/`**
   (keep the `CLAUDE.md` and `.env.example` that are already there).
3. Your old empty `backend` folder isn't needed — the kit has one.

Result:
```
hrms-project/hrms/package.json   ← your React app
hrms-project/hrms/src/...        ← your screens
hrms-project/hrms/CLAUDE.md      ← from the kit
```

---

## 3. Run the setup script

```powershell
cd hrms-project
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

It will:
- check Node, Git, Claude Code, MySQL
- create git (`main` branch)
- install the Playwright browser
- run `npx skills@latest add mattpocock/skills` → **when asked, pick Claude Code and select:**
  `setup-matt-pocock-skills, grill-with-docs, grill-me, to-spec, to-tickets,
  implement, code-review, tdd, diagnose, git-guardrails-claude-code`
- make the first commit

---

## 4. First Claude Code session (configure)

1. `code .` → open Claude Code in VS Code (or run `claude` in the terminal).
2. When asked to approve the **playwright** MCP server → approve.
3. Type `/model` → confirm it's **Opus** (not Fable).
4. Type `/mcp` → `playwright` should show connected.
5. Run:
   ```
   /setup-matt-pocock-skills
   ```
   Answer:
   - **Issue tracker:** local markdown files (simplest; switch to GitHub Issues later if you want)
   - **Triage labels:** defaults
   - **Domain docs:** single-context
6. Type `/` → you should see `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/implement`, `/code-review`.

---

## 5. Build the backend skeleton → `prompts/01-scaffold-backend.md`

- Plan mode (Shift+Tab) → paste prompt A → read plan → approve.
- Paste the `/goal` (prompt B) → Claude builds until tests + lint pass.
- **You:** create `backend/.env` and `hrms/.env` from the examples,
  create DBs `hrms_dev` + `hrms_test`, run migrate + seed, open
  http://localhost:5000/api/health.

---

## 6. Map your UI → `prompts/02-ui-map.md`

Claude reads all your screens and writes `docs/ui-map.md`:
routes, data per screen, forms, actions, modules in build order, and QUESTIONS.
**Read it and correct it.**

---

## 7. Build each module → `prompts/03-build-one-module.md`

```
/grill-with-docs  →  /to-spec  →  /to-tickets  →  /goal (/implement + ui-tester + /code-review)  →  YOU review
```

- **Auth first, while you watch.** Fix any rule Claude gets wrong in the CLAUDE.md files.
- Then Dashboard, Employees, Departments, Attendance, Leave, Payroll… (order from ui-map).
- **New session per module** (`/clear`), so context stays clean.
- Keep two terminals running: `cd backend && npm run dev` and `cd hrms && npm run dev`.

---

## 8. Go faster → `prompts/04-advanced-speed.md`

Only after 1–2 modules worked well:
- **Parallel modules** with git worktrees
- **Phone control:** `claude --rc --model opus`
- **Lint hook** after every edit
- **Auto-resume** through internet drops + usage limits: `scripts\run-claude.ps1`
- **Cloud routine** when the PC is off

---

## 9. Daily routine

| When | What |
|---|---|
| Morning | `git log` + review what ran overnight; answer open questions in tickets |
| Day | `/grill-with-docs` the next module (your thinking time), then `/goal` it |
| Evening | Review diffs, click through screens as 2 roles, commit/merge |
| Night | `run-claude.ps1` works the open tickets |
| Weekly | Every repeated mistake → a new line in the right CLAUDE.md |

---

## 10. Golden rules

1. **No Fable model.** Opus for work, Sonnet for agents.
2. **Measurable goals only** ("tests pass", "ui-tester PASS"), never "make it good".
3. **Tests before code.** Never let Claude weaken or delete a test.
4. **Never put secrets in prompts.** `.env` is blocked from Claude by design.
5. **Fresh session per module.**
6. **You review every diff before merging.**
7. **Dev/test database only** for Claude and the ui-tester.

## Troubleshooting

| Problem | Fix |
|---|---|
| Skills don't show after `/` | Restart Claude Code; check `.claude/skills/` exists; re-run the installer |
| `playwright` not connected | `/mcp` → reconnect; run `npx playwright install chromium` |
| ui-tester says "servers not running" | Start backend (5000) and UI (5173) in separate terminals |
| Model shows Fable | `/model` → choose Opus; confirm `"model": "opus"` in `.claude/settings.json` |
| Claude asks permission too often | Add the safe command to `permissions.allow` in settings.json |
| Hit usage limit | Wait for reset, or run `scripts\run-claude.ps1` to auto-continue |
