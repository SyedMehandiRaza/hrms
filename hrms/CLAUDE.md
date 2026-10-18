# UI rules (React + Vite)

## API
- All API calls live in `src/api/` — one file per resource (e.g. `src/api/employees.js`).
- Use the shared axios instance in `src/api/client.js`.
  - baseURL = `import.meta.env.VITE_API_URL`
  - attaches the access token; on 401 tries refresh once, then redirects to /login.
- Never call fetch/axios directly inside components.

## Screens
- Keep the existing design, layout and components. Replace static/mock data only.
- Every API-driven screen has: loading state, empty state, error state.
- Show server error messages to the user exactly as returned (`message` field).
- Disable submit buttons while a request is in flight (no double submit).
- Client-side validation must match the server rules (same messages).
- Protect routes by role; hide actions the current role can't perform.

## Done means
- `npm run lint` passes.
- The `ui-tester` agent reports PASS for every flow of the ticket.
