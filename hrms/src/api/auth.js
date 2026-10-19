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
