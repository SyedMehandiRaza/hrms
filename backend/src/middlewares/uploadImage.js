const multer = require("multer");
const ErrorHandler = require("../utils/ErrorHandler");
const { IMAGE_MAX_BYTES } = require("../utils/imageFile");

// uploadImage("image", "OFFICE_IMAGE_INVALID"): reads one multipart file field into memory
// (req.file.buffer). The limit is one byte over 2 MB so an exactly-2 MB file still arrives; the
// service checks size and type. Any upload problem (too big, wrong field, several files, not
// parsable) → 400 with the given code. A missing file leaves req.file undefined.
const uploadImage = (field, errorCode) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: IMAGE_MAX_BYTES + 1, files: 1 },
  }).single(field);
  return (req, res, next) => upload(req, res, (err) => (err ? next(new ErrorHandler(errorCode)) : next()));
};

module.exports = uploadImage;
