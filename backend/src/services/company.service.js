const { Employer, IndustryType, CompanyTimeSetting, Country } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const storage = require("./storage.service");
const { IMAGE_MAX_BYTES, imageExtension, toUploadUrl, toStoragePath } = require("../utils/imageFile");

// Company profile and logo (D27–D29). Always the caller's own company: the
// employer id comes from the access token.

// employers.company_logo holds the public URL of the file ("/uploads/logos/<uuid>.png"),
// relative to the API origin; the file itself is storage path "logos/<uuid>.png".
const LOGO_FOLDER = "logos";
const toLogoUrl = toUploadUrl;

// Body field → employers column, for PUT /company and the change log.
const PROFILE_FIELDS = {
  companyName: "company_name",
  industryTypeId: "industry_type_id",
  email: "company_email",
  phone: "company_phone_number",
  phoneCountry: "phone_country",
  address: "address",
};

const findCompany = async (employerId) => {
  const employer = await Employer.findByPk(employerId, {
    include: [
      { model: IndustryType, as: "industryType", attributes: ["id", "industry_name"] },
      { model: CompanyTimeSetting, as: "companyTimeSetting", attributes: ["timezone"] },
      { model: Country, as: "country", attributes: ["id", "iso2", "name", "calling_code"] },
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
  // E.164 with its phone country (countries-cities-phones D15–D19).
  company_phone_number: employer.company_phone_number,
  phone_country: employer.phone_country || null,
  address: employer.address,
  company_logo: employer.company_logo || null,
  created_at: employer.createdAt,
  timezone: employer.companyTimeSetting ? employer.companyTimeSetting.timezone : null,
  currency: "SAR",
  // The company country (D11), not editable yet.
  country: employer.country
    ? { id: employer.country.id, iso2: employer.country.iso2, name: employer.country.name, callingCode: employer.country.calling_code }
    : null,
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

// JPG/PNG up to 2 MB, recognised by their first bytes (D29; utils/imageFile.js).
const LOGO_MAX_BYTES = IMAGE_MAX_BYTES;

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
  const ext = imageExtension(buffer);
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
