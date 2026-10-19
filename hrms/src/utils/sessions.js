// Helpers for the sessions lists (components/sessions/*, D15).

// Ids of the sessions that can be ended here: every session except the current one.
export const selectableIds = (sessions) => sessions.filter((s) => !s.current).map((s) => s.id);

// Body for POST /auth/sessions/revoke: { all: true } when every other session is
// selected, else { sessionIds }.
export const revokeBody = (sessions, selected) => {
  const all = selectableIds(sessions);
  const ids = all.filter((id) => selected.has(id));
  return ids.length > 0 && ids.length === all.length ? { all: true } : { sessionIds: ids };
};
