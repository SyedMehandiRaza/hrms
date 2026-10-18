require("./config/env");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./routes");
const ErrorHandler = require("./utils/ErrorHandler");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use("/api", routes);

app.use((req, res, next) => next(new ErrorHandler(404, "Route not found")));
app.use(errorHandler);

module.exports = app;
