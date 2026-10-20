require("./config/env");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const routes = require("./routes");
const ErrorHandler = require("./utils/ErrorHandler");
const language = require("./middlewares/language");
const errorHandler = require("./middlewares/errorHandler");
const { getCorsOrigin } = require("./config/auth");
const { getUploadRoot } = require("./services/storage.service");

const app = express();

// Behind a reverse proxy, TRUST_PROXY (hop count, "true", or proxy addresses) makes req.ip
// the client's address: signing evidence and rate limits need it (plan decision 32).
const trustProxy = (value) => {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "true" || value === "false") return value === "true";
  return value;
};
if (process.env.TRUST_PROXY) app.set("trust proxy", trustProxy(process.env.TRUST_PROXY));

app.use(language);
app.use(helmet());
// The UI sends the refresh cookie, so CORS must allow credentials for its origin.
app.use(cors({ origin: getCorsOrigin(), credentials: true }));
// JSON bodies up to 1 MB, except a contract submit with drawn signatures: up to 15 MB
// (plan decision 29). Larger → 413 PAYLOAD_TOO_LARGE.
const jsonDefault = express.json({ limit: "1mb" });
const jsonSubmit = express.json({ limit: "15mb" });
const LARGE_BODY_ROUTE = /^\/api\/my\/contracts\/[^/]+\/submit\/?$/;
app.use((req, res, next) => (LARGE_BODY_ROUTE.test(req.path) ? jsonSubmit : jsonDefault)(req, res, next));
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Uploaded files (e.g. company logos), read-only. No directory listing or index files.
// Helmet's same-origin resource policy would stop the UI (another origin) from
// showing the images, so these responses allow cross-origin embedding.
app.use(
  "/uploads",
  (req, res, next) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(getUploadRoot(), { index: false, redirect: false, dotfiles: "ignore" })
);

app.use("/api", routes);

app.use((req, res, next) => next(new ErrorHandler("NOT_FOUND")));
app.use(errorHandler);

module.exports = app;
