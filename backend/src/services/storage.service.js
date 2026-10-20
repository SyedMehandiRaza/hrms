const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

// Local file storage for uploads (D29). Files live under UPLOAD_DIR (default
// "uploads", resolved relative to the backend folder; an absolute path is used as is)
// and are served read-only at /uploads/<relative path> by app.js.
// Callers only ever see relative paths ("logos/<uuid>.png"), so the storage can move
// (e.g. to object storage) without touching them.
//
// Contract Studio files (documents, signature images, final PDFs) live in a second,
// PRIVATE root, CONTRACT_STORAGE_DIR (default "storage/contracts"), that nothing serves
// statically; only authenticated endpoints read it (plan decision 8).

const BACKEND_DIR = path.resolve(__dirname, "../..");

const getUploadRoot = () => path.resolve(BACKEND_DIR, process.env.UPLOAD_DIR || "uploads");
const getContractRoot = () => path.resolve(BACKEND_DIR, process.env.CONTRACT_STORAGE_DIR || "storage/contracts");

// Absolute path for a relative one; refuses anything that escapes the root.
const resolveIn = (root, relativePath) => {
  const full = path.resolve(root, relativePath);
  if (!full.startsWith(root + path.sep)) {
    throw new Error(`storage: path outside the storage directory: ${relativePath}`);
  }
  return full;
};
const resolveInRoot = (relativePath) => resolveIn(getUploadRoot(), relativePath);

const isInside = (child, parent) => child === parent || child.startsWith(parent + path.sep);

// Called at server start: the private root must never be reachable through /uploads.
const assertContractRootPrivate = () => {
  const contracts = getContractRoot();
  const uploads = getUploadRoot();
  if (isInside(contracts, uploads)) {
    throw new Error(`storage: CONTRACT_STORAGE_DIR (${contracts}) must not be inside UPLOAD_DIR (${uploads})`);
  }
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

// ---------- private contract storage ----------

// Writes at an exact relative path ("<employer_id>/documents/<uuid>.pdf"). Refuses to
// overwrite: contract files are written once under a new name and never replaced.
const savePrivate = async (buffer, relativePath) => {
  const full = resolveIn(getContractRoot(), relativePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer, { flag: "wx" });
  return relativePath;
};

const readPrivate = (relativePath) => fs.readFile(resolveIn(getContractRoot(), relativePath));

const removePrivate = async (relativePath) => {
  try {
    await fs.unlink(resolveIn(getContractRoot(), relativePath));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
};

const existsPrivate = async (relativePath) => {
  try {
    await fs.access(resolveIn(getContractRoot(), relativePath));
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  getUploadRoot,
  getContractRoot,
  assertContractRootPrivate,
  save,
  remove,
  savePrivate,
  readPrivate,
  removePrivate,
  existsPrivate,
};
