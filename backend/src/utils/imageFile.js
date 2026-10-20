// Uploaded images (company logo, head office and project photos): JPG or PNG, at most 2 MB,
// recognised by their first bytes (the file name and the client's content type aren't trusted).
// Stored through services/storage.service.js; the database keeps the public URL
// ("/uploads/<folder>/<uuid>.<ext>"), the storage the relative path ("<folder>/<uuid>.<ext>").

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const UPLOAD_URL_PREFIX = "/uploads/";

// "png" | "jpg" for an accepted image buffer, otherwise null (also when too big).
const imageExtension = (buffer) => {
  if (!buffer || buffer.length > IMAGE_MAX_BYTES) return null;
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return "png";
  if (buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) return "jpg";
  return null;
};

const toUploadUrl = (relativePath) => `${UPLOAD_URL_PREFIX}${relativePath}`;
const toStoragePath = (url) => (url && url.startsWith(UPLOAD_URL_PREFIX) ? url.slice(UPLOAD_URL_PREFIX.length) : null);

module.exports = { IMAGE_MAX_BYTES, imageExtension, toUploadUrl, toStoragePath };
