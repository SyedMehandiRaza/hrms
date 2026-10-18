# Prompt 03 — Build ONE module (repeat per module)

Replace `<Module>` and the page path. Do Auth first, while you watch.
Start a FRESH Claude session for each module (`/clear` or a new chat).

## 1. Discuss — you + Claude (10–30 min, the most important part)
```
/grill-with-docs <Module> module. Screens are listed in docs/ui-map.md
under <Module>. Cover: who can do what (roles), every field validation,
exact error messages, status flows, edge cases, and the QUESTIONS for
this module in docs/ui-map.md. One question at a time.
```
Answer every question. Say "I don't know yet" if needed — it gets recorded.

## 2. Spec
```
/to-spec
```
Read the spec. If something is missing: "grill me more on <topic>", then /to-spec again.

## 3. Tickets
```
/to-tickets Split into small vertical tickets: backend endpoints + tests
first, then one ticket per UI screen to wire it to the API (loading, empty,
error states, validation). Every ticket has acceptance criteria written as
user flows: "When <role> does X → Y happens / message Z shows".
```

## 4. Build — autonomous
Make sure both servers are running (backend :5000, UI :5173) in separate terminals.
```
/goal /implement all open tickets for the <Module> spec, in order.
After each ticket: run backend `npm test` + `npm run lint` and hrms
`npm run lint`; for UI tickets call the ui-tester agent; commit.
Then run /code-review on the whole module and fix blocking issues.
Done when all <Module> tickets are closed, all tests + lint pass,
ui-tester says PASS for every UI ticket, and /code-review has no
blocking issues. If a ticket is unclear, stop and ask me.
```

## 5. You review (don't skip)
- Read the diff (`git log -p` or VS Code source control).
- Click through the screens yourself as 2 different roles.
- Merge / continue to the next module.
