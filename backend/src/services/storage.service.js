const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

// Local file storage for uploads (D29). Files live under UPLOAD_DIR (default
// "uploads", resolved relative to the backend folder; an absolute path is used as is)
// and are served read-only at /uploads/<relative path> by app.js.
// Callers only ever see relative paths ("logos/<uuid>.png"), so the storage can move
// (e.g. to object storage) without touching them.

const getUploadRoot = () => path.resolve(__dirname, "../..", process.env.UPLOAD_DIR || "uploads");

// Absolute path for a relative one; refuses anything that escapes the upload root.
const resolveInRoot = (relativePath) => {
  const root = getUploadRoot();
  const full = path.resolve(root, relativePath);
  if (!full.startsWith(root + path.sep)) {
    throw new Error(`storage: path outside the upload directory: ${relativePath}`);
  }
  return full;
};

// save(buffer, "logos", "png") → "logos/<uuid>.png"
const save = async (buffer, folder, ext) => {
  const relativePath = `${folder}/${crypto.randomUUID()}.${ext}`;
  const full = resolveInRoot(relativePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return relativePath;
};

// Deletes a stored file; a file that is already gone is not an error.
const remove = async (relativePath) => {
  try {
    await fs.unlink(resolveInRoot(relativePath));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
};

module.exports = { getUploadRoot, save, remove };
