import client, { refreshAccessToken } from "./client";

// Auth endpoints (backend/src/routes/auth.routes.js). Each returns the
// response's `data` (or the whole body when there is no `data`). Errors are
// axios errors: read them with utils/apiError.js / utils/applyFieldErrors.js.

// { accessToken, mustChangePassword }
export const login = ({ email, password }) =>
  client.post("/auth/login", { email, password }).then((res) => res.data.data);

// The new access token (string). Shared single-flight with the 401 interceptor.
export const refresh = () => refreshAccessToken();

// { success: true } — always succeeds server-side.
export const logout = () => client.post("/auth/logout").then((res) => res.data);

// { user, account: { id, access_level, panel }, company: { id, name, logo, timezone, currency },
//   mustChangePassword, permissions: { module: { read, create, update, delete } } }
export const me = () => client.get("/auth/me").then((res) => res.data.data);

// POST /auth/signup → { accessToken, mustChangePassword, me } (the refresh cookie is set too).
// Body: { companyName, name, email, phone?, password, confirmPassword }.
export const signup = (body) => client.post("/auth/signup", body).then((res) => res.data.data);

// POST /auth/forgot-password → the whole body { success, code: "AUTH_RESET_SENT", message }
// (the same answer whether or not the email is known). Also used to resend a code.
export const forgotPassword = ({ email }) =>
  client.post("/auth/forgot-password", { email }).then((res) => res.data);

// POST /auth/verify-otp → { resetToken } (single use, 15 minutes).
export const verifyOtp = ({ email, otp }) =>
  client.post("/auth/verify-otp", { email, otp }).then((res) => res.data.data);

// POST /auth/reset-password → { success: true }. Ends every session of the person.
export const resetPassword = ({ resetToken, newPassword, confirmPassword }) =>
  client.post("/auth/reset-password", { resetToken, newPassword, confirmPassword }).then((res) => res.data);

// POST /auth/setup-password (welcome email's setup link) → { accessToken, mustChangePassword }
// (logged in: the refresh cookie is set too).
export const setupPassword = ({ token, newPassword, confirmPassword }) =>
  client.post("/auth/setup-password", { token, newPassword, confirmPassword }).then((res) => res.data.data);

// POST /auth/change-password → { success: true }. Sessions stay; the UI then offers the
// session picker (D15, D24). Errors: AUTH_CURRENT_PASSWORD_WRONG (errors.currentPassword),
// AUTH_PASSWORD_SAME (errors.newPassword), 423 AUTH_ACCOUNT_LOCKED (the session was ended).
export const changePassword = ({ currentPassword, newPassword, confirmPassword }) =>
  client.post("/auth/change-password", { currentPassword, newPassword, confirmPassword }).then((res) => res.data);

// GET /auth/sessions → [{ id, device, ip, created_at, last_used_at, current }], newest use first.
export const listSessions = () => client.get("/auth/sessions").then((res) => res.data.data);

// POST /auth/sessions/revoke → { revoked }. Pass { sessionIds: [...] } or { all: true }
// (every other session); the current session can't be ended here.
export const revokeSessions = ({ sessionIds, all } = {}) =>
  client
    .post("/auth/sessions/revoke", all ? { all: true } : { sessionIds })
    .then((res) => res.data.data);
