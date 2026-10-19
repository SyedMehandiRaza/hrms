const { resolveLang } = require("../utils/i18n");

// Sets req.lang ("en" | "ar") from the Accept-Language header.
const language = (req, res, next) => {
  req.lang = resolveLang(req.headers["accept-language"]);
  next();
};

module.exports = language;
