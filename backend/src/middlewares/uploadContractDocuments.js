const multer = require("multer");
const ErrorHandler = require("../utils/ErrorHandler");

// Reads the multipart field `files` (several PDFs, plan decision 6) into req.files.
// Each file is kept in memory only up to MAX_BYTES; a longer one is drained and marked
// `tooLarge`, so the service can refuse that file alone while still saving the others.
// More than MAX_FILES files → 400 CONTRACT_UPLOAD_LIMIT (nothing is saved); any other
// multipart problem → 400 CONTRACT_DOCUMENT_INVALID.
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;

const cappedMemoryStorage = {
  _handleFile(req, file, cb) {
    const chunks = [];
    let size = 0;
    file.stream.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_BYTES) chunks.push(chunk);
    });
    file.stream.on("error", cb);
    file.stream.on("end", () => {
      const tooLarge = size > MAX_BYTES;
      cb(null, { size, tooLarge, buffer: tooLarge ? null : Buffer.concat(chunks) });
    });
  },
  _removeFile(req, file, cb) {
    file.buffer = null;
    cb(null);
  },
};

const upload = multer({ storage: cappedMemoryStorage, limits: { files: MAX_FILES } }).array("files");

const uploadContractDocuments = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    return next(new ErrorHandler(err.code === "LIMIT_FILE_COUNT" ? "CONTRACT_UPLOAD_LIMIT" : "CONTRACT_DOCUMENT_INVALID"));
  });

module.exports = { uploadContractDocuments, MAX_BYTES, MAX_FILES };
