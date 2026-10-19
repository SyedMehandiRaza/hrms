const { Employer, IndustryType, CompanyTimeSetting } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const storage = require("./storage.service");

// Company profile and logo (D27–D29). Always the caller's own company: the
// employer id comes from the access token.

// employers.company_logo holds the public URL of the file ("/uploads/logos/<uuid>.png"),
// relative to the API origin; the file itself is storage path "logos/<uuid>.png".
const UPLOAD_URL_PREFIX = "/uploads/";
const LOGO_FOLDER = "logos";
const toLogoUrl = (relativePath) => `${UPLOAD_URL_PREFIX}${relativePath}`;
const toStoragePath = (url) => (url && url.startsWith(UPLOAD_URL_PREFIX) ? url.slice(UPLOAD_URL_PREFIX.length) : null);

// Body field → employers column, for PUT /company and the change log.
const PROFILE_FIELDS = {
  companyName: "company_name",
  industryTypeId: "industry_type_id",
  email: "company_email",
  phone: "company_phone_number",
  address: "address",
};

const findCompany = async (employerId) => {
  const employer = await Employer.findByPk(employerId, {
    include: [
      { model: IndustryType, as: "industryType", attributes: ["id", "industry_name"] },
      { model: CompanyTimeSetting, as: "companyTimeSetting", attributes: ["timezone"] },
    ],
  });
  // requireAuth already checked the company is active; this only guards a race.
  if (!employer) throw new ErrorHandler("NOT_FOUND");
  return employer;
};

const toResponse = (employer) => ({
  id: employer.id,
  company_name: employer.company_name,
  industry_type_id: employer.industry_type_id,
  industry_name: employer.industryType ? employer.industryType.industry_name : null,
  company_email: employer.company_email,
  company_phone_number: employer.company_phone_number,
  address: employer.address,
  company_logo: employer.company_logo || null,
  created_at: employer.createdAt,
  timezone: employer.companyTimeSetting ? employer.companyTimeSetting.timezone : null,
  currency: "SAR",
});

// GET /company (any login).
const getCompany = async ({ employerId }) => toResponse(await findCompany(employerId));

// GET /industry-types: the dropdown list, non-deleted only (paranoid model).
const listIndustryTypes = async () => {
  const rows = await IndustryType.findAll({ attributes: ["id", "industry_name"], order: [["industry_name", "ASC"]] });
  return rows.map((row) => ({ id: row.id, name: row.industry_name }));
};

// PUT /company (owner only). Last write wins; changed fields go to the server log.
const updateProfile = async ({ employerId, userId }, body) => {
  const industry = await IndustryType.findByPk(body.industryTypeId, { attributes: ["id"] });
  if (!industry) {
    throw new ErrorHandler("VALIDATION_FAILED", { errors: { industryTypeId: "industryRequired" } });
  }

  const employer = await findCompany(employerId);
  const changed = Object.keys(PROFILE_FIELDS).filter((field) => employer[PROFILE_FIELDS[field]] !== body[field]);
  if (changed.length) {
    await employer.update(Object.fromEntries(changed.map((field) => [PROFILE_FIELDS[field], body[field]])));
    console.info("[company] profile updated", { employerId, userId, fields: changed });
  }

  return getCompany({ employerId });
};

// First bytes of the accepted image types (D29); the file name and the client's
// content type are not trusted.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const logoExtension = (buffer) => {
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return "png";
  if (buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) return "jpg";
  return null;
};

// Removes an old logo file after the database no longer points at it. A failure only
// leaves an orphan file, so it is logged rather than failing the request.
const removeLogoFile = async (url) => {
  const storagePath = toStoragePath(url);
  if (!storagePath) return;
  try {
    await storage.remove(storagePath);
  } catch (err) {
    console.error("[company] could not delete logo file", { path: storagePath, error: err.message });
  }
};

// PUT /company/logo (owner only). `file` is multer's in-memory file (or undefined).
const replaceLogo = async ({ employerId }, file) => {
  const buffer = file && file.buffer;
  const ext = buffer && buffer.length <= LOGO_MAX_BYTES ? logoExtension(buffer) : null;
  if (!ext) throw new ErrorHandler("COMPANY_LOGO_INVALID");

  const employer = await findCompany(employerId);
  const oldUrl = employer.company_logo;
  const storagePath = await storage.save(buffer, LOGO_FOLDER, ext);
  try {
    await employer.update({ company_logo: toLogoUrl(storagePath) });
  } catch (err) {
    await storage.remove(storagePath);
    throw err;
  }
  await removeLogoFile(oldUrl);

  return getCompany({ employerId });
};

// DELETE /company/logo (owner only). 200 even when there is no logo.
const removeLogo = async ({ employerId }) => {
  const employer = await findCompany(employerId);
  const oldUrl = employer.company_logo;
  if (oldUrl) {
    await employer.update({ company_logo: null });
    await removeLogoFile(oldUrl);
  }
  return getCompany({ employerId });
};

module.exports = { LOGO_MAX_BYTES, getCompany, listIndustryTypes, updateProfile, replaceLogo, removeLogo };
