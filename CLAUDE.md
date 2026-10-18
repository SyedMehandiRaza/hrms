# HRMS Project

## What this is
- `hrms/`    → React UI (Vite). Design is COMPLETE but static (no functionality yet).
- `backend/` → Node + Express API (built by Claude, see prompts/01-scaffold-backend.md).
- `docs/`    → ui-map.md, test-users.md, CONTEXT.md + adr/ (created by /grill-with-docs).

## Commands
- UI:      `cd hrms && npm run dev` (http://localhost:5173) | `npm run lint`
- Backend: `cd backend && npm run dev` (http://localhost:5000) | `npm test` | `npm run lint`
- Migrations: `cd backend && npx sequelize-cli db:migrate`

## Roles
SUPER_ADMIN, HR, MANAGER, EMPLOYEE

## Workflow rules (always)
- Tests before code. Never delete, skip or weaken a test to make it pass.
- If a requirement is unclear, STOP and ask. Never invent business rules.
- Never read or edit `.env` files. Add new variables to `.env.example` only.
- Don't change the UI design. Only replace static data and wire functionality, unless asked.
- Small commits: one ticket = one commit with a clear message.
- After UI work, use the `ui-tester` agent to verify flows in a real browser.

## Where things live
- Tickets/specs: see `docs/agents/issue-tracker.md` (created by /setup-matt-pocock-skills).
- Domain terms and decisions: `docs/CONTEXT.md`, `docs/adr/`.
- Screen inventory: `docs/ui-map.md`.
