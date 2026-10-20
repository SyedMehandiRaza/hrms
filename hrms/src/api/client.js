import axios from "axios";
import { sessionStore } from "../data/sessionStore";

// The one axios instance every src/api/* file uses. Components never call
// axios/fetch directly.
//
// - baseURL from VITE_API_URL (default http://localhost:5000/api).
// - withCredentials: the refresh token is an httpOnly cookie scoped to /api/auth.
// - Sends Accept-Language (localStorage.lang) so server messages come back in
//   the UI language, and the in-memory access token as a Bearer header.
// - 401 AUTH_TOKEN_EXPIRED (or AUTH_REQUIRED while we held a token) → one shared
//   POST /auth/refresh → the original request is retried once. Refresh failure
//   → session cleared → /login.
// - 403 AUTH_ACCOUNT_INACTIVE / AUTH_COMPANY_INACTIVE → session cleared →
//   /access-ended (the server message is passed along).
// - 403 AUTH_PASSWORD_CHANGE_REQUIRED → sessionStore.mustChangePassword = true.

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

// "http://localhost:5000" — files the API serves (e.g. the company logo
// "/uploads/logos/x.png") are relative to the API origin, not the UI's.
export const apiOrigin = (() => {
  try {
    return new URL(API_URL).origin;
  } catch {
    return "";
  }
})();

// "/uploads/logos/x.png" → "http://localhost:5000/uploads/logos/x.png".
// Absolute URLs, data:/blob: URLs and empty values pass through unchanged.
export const assetUrl = (path) => {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${apiOrigin}${path.startsWith("/") ? "" : "/"}${path}`;
};

export const currentLang = () => {
  try {
    return localStorage.getItem("lang") === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
};

// Navigation from outside React. App registers react-router's navigate on
// mount; before that (or in tests) a full page load is used.
let navigator = null;
export const setNavigator = (fn) => {
  navigator = fn;
};
const goTo = (path, state) => {
  if (typeof window !== "undefined" && window.location.pathname === path) return;
  if (navigator) navigator(path, { replace: true, state });
  else if (typeof window !== "undefined") window.location.assign(path);
};

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

client.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  // A call may ask for a specific language (e.g. a lookup cached per language); otherwise the UI's.
  if (!config.headers["Accept-Language"]) config.headers["Accept-Language"] = currentLang();
  const token = sessionStore.getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// These answer for themselves: never refresh-and-retry them.
const NO_REFRESH = /\/auth\/(login|refresh|logout)\/?$/;
const isNoRefreshCall = (config) => NO_REFRESH.test((config?.url || "").split("?")[0]);

const INACTIVE_CODES = new Set(["AUTH_ACCOUNT_INACTIVE", "AUTH_COMPANY_INACTIVE"]);

const endAccess = (message) => {
  sessionStore.endAccess(message || null);
  goTo("/access-ended", { message: message || null });
};

// Single flight: concurrent 401s share one refresh call (the refresh token
// rotates, so a second parallel refresh would count as reuse).
let refreshPromise = null;
export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = client
      .post("/auth/refresh")
      .then((res) => {
        const token = res.data?.data?.accessToken;
        sessionStore.setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const data = error.response?.data || {};

    if (!config || isNoRefreshCall(config)) return Promise.reject(error);

    if (status === 401) {
      const sentToken = !!config.headers?.Authorization;
      const canRefresh =
        data.code === "AUTH_TOKEN_EXPIRED" || (data.code === "AUTH_REQUIRED" && sentToken);
      if (canRefresh && !config._retried) {
        config._retried = true;
        try {
          const token = await refreshAccessToken();
          config.headers.Authorization = `Bearer ${token}`;
          return client(config);
        } catch (refreshError) {
          const code = refreshError.response?.data?.code;
          if (INACTIVE_CODES.has(code)) {
            endAccess(refreshError.response.data.message);
          } else {
            sessionStore.clear();
            goTo("/login");
          }
          return Promise.reject(error);
        }
      }
      if (canRefresh) {
        // Still 401 after the retry: the session is gone.
        sessionStore.clear();
        goTo("/login");
      }
      return Promise.reject(error);
    }

    if (status === 403) {
      if (INACTIVE_CODES.has(data.code)) endAccess(data.message);
      else if (data.code === "AUTH_PASSWORD_CHANGE_REQUIRED") sessionStore.setMustChangePassword(true);
    }
    return Promise.reject(error);
  },
);

export default client;
