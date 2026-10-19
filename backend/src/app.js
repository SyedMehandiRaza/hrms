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

app.use(language);
app.use(helmet());
// The UI sends the refresh cookie, so CORS must allow credentials for its origin.
app.use(cors({ origin: getCorsOrigin(), credentials: true }));
app.use(express.json({ limit: "1mb" }));
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
