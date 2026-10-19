const multer = require("multer");
const ErrorHandler = require("../utils/ErrorHandler");
const { LOGO_MAX_BYTES } = require("../services/company.service");

// Reads the multipart field `logo` into memory (req.file.buffer). The limit is one byte
// over 2 MB so an exactly-2 MB file still arrives; the service checks size and type.
// Any upload problem (too big, wrong field, several files, not multipart-parsable)
// → 400 COMPANY_LOGO_INVALID. A missing file leaves req.file undefined.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES + 1, files: 1 },
}).single("logo");

const uploadLogo = (req, res, next) =>
  upload(req, res, (err) => (err ? next(new ErrorHandler("COMPANY_LOGO_INVALID")) : next()));

module.exports = uploadLogo;
