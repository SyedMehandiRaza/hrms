# 22: Active sessions list

**What to build:** A permanent list of the user's sessions with the same checkboxes as the picker: in Settings →
Security & SSO for the Admin panel (only this part of the static tab changes) and as a Profile section for the
Employee and Staffing-company panels (D15). Strings in English and Arabic.

**Blocked by:** 21 Profile → Change password and session picker

**Status:** ready-for-agent

Verified by the ui-tester agent with three browser contexts:

- [ ] The list shows each session's device/browser, IP and last used; the current device is marked "this device"
      and can't be selected.
- [ ] Selecting one other session and ending it → that context is sent to login; the list refreshes; the third
      context stays in.
- [ ] Select all + end → every other context is sent to login.
- [ ] With only the current session → "No other active sessions".
- [ ] Loading state while fetching; error state shows the server message with Retry.
- [ ] Lint passes.
