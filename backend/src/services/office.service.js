const { Op } = require("sequelize");
const { sequelize, Office, Project, Country, City } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { saveOrClash } = require("../utils/uniqueClash");
const { imageExtension, toUploadUrl, toStoragePath } = require("../utils/imageFile");
const storage = require("./storage.service");
const { UUID, likePattern, orNull } = require("./department.service");
const { assertCountry, assertCityInCountry, localName } = require("./geo.service");

// Head offices (docs/plans/workforce-and-lifecycle.md D1–D6, ADR 0010). Always the caller's own
// company: the employer id comes from the access token; another company's office answers 404.
// Status is derived: ACTIVE = has a project (at most one), UNASSIGNED = none.

const IMAGE_FOLDER = "offices";

// ACTIVE + IN_NOTICE employees with a current assignment (main or secondary) on the office's
// project, and those of them with employment type CONTRACT (D6).
const EMPLOYEE_COUNT = (contractOnly) =>
  sequelize.literal(
    "(SELECT COUNT(DISTINCT ep.employee_id) FROM `employee_projects` ep " +
      "JOIN `projects` p ON p.id = ep.project_id AND p.deleted_at IS NULL " +
      "JOIN `employees` e ON e.id = ep.employee_id AND e.deleted_at IS NULL " +
      "WHERE p.office_id = `Office`.`id` AND ep.is_active = 1 AND e.employment_status IN ('ACTIVE', 'IN_NOTICE')" +
      (contractOnly ? " AND e.employment_type = 'CONTRACT'" : "") +
      ")"
  );

const ITEM_QUERY = {
  attributes: { include: [[EMPLOYEE_COUNT(false), "employee_count"], [EMPLOYEE_COUNT(true), "contract_employee_count"]] },
  include: [
    { model: Project, as: "project", attributes: ["id", "project_name", "project_code", "status"], required: false },
    { model: Country, as: "country", attributes: ["id", "iso2", "name", "name_ar"], required: false },
    { model: City, as: "city", attributes: ["id", "city_name", "name_ar"], required: false },
  ],
};

const num = (value) => (value === null || value === undefined ? null : Number(value));

const toItem = (office, lang) => ({
  id: office.id,
  name: office.office_name,
  email: office.office_email,
  phone: office.office_phone,
  phone_country: office.phone_country,
  location: office.office_location,
  latitude: num(office.lat),
  longitude: num(office.lng),
  image: office.office_image || null,
  country: office.country ? { id: office.country.id, iso2: office.country.iso2, name: localName(office.country, lang) } : null,
  city: office.city ? { id: office.city.id, name: localName(office.city, lang, "city_name") } : null,
  status: office.project ? "ACTIVE" : "UNASSIGNED",
  project: office.project
    ? { id: office.project.id, name: office.project.project_name, code: office.project.project_code, status: office.project.status }
    : null,
  employee_count: Number(office.get("employee_count") || 0),
  contract_employee_count: Number(office.get("contract_employee_count") || 0),
  created_at: office.createdAt,
  updated_at: office.updatedAt,
});

// The caller's live office, or 404 (also for a malformed id).
const findOffice = async (employerId, id, options = {}) => {
  const office = UUID.test(String(id)) ? await Office.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!office) throw new ErrorHandler("NOT_FOUND");
  return office;
};

// Company-wide stats, whatever the list filters (D6): offices, offices with a project, distinct
// locations (trimmed, any case) and projects.
const companyStats = async (employerId) => {
  const [[row]] = await sequelize.query(
    `SELECT
       (SELECT COUNT(*) FROM offices o WHERE o.employer_id = :e AND o.deleted_at IS NULL) AS total_offices,
       (SELECT COUNT(*) FROM offices o JOIN projects p ON p.office_id = o.id AND p.deleted_at IS NULL
          WHERE o.employer_id = :e AND o.deleted_at IS NULL) AS active_offices,
       (SELECT COUNT(DISTINCT LOWER(TRIM(o.office_location))) FROM offices o
          WHERE o.employer_id = :e AND o.deleted_at IS NULL AND o.office_location IS NOT NULL AND TRIM(o.office_location) <> '') AS total_locations,
       (SELECT COUNT(*) FROM projects p WHERE p.employer_id = :e AND p.deleted_at IS NULL) AS total_projects`,
    { replacements: { e: employerId } }
  );
  return {
    total_offices: Number(row.total_offices),
    active_offices: Number(row.active_offices),
    total_locations: Number(row.total_locations),
    total_projects: Number(row.total_projects),
  };
};

// "Has a live project" as a WHERE condition on the offices table.
const HAS_PROJECT = sequelize.literal(
  "EXISTS (SELECT 1 FROM `projects` p WHERE p.office_id = `Office`.`id` AND p.deleted_at IS NULL)"
);

// GET /offices. Query is validated: { page, limit, search, status }. Newest first.
const listOffices = async ({ employerId }, { page, limit, search, status }, lang) => {
  const where = { employer_id: employerId };
  const and = [];
  if (search) {
    const pattern = likePattern(search);
    and.push({ [Op.or]: [{ office_name: { [Op.like]: pattern } }, { office_location: { [Op.like]: pattern } }] });
  }
  if (status === "ACTIVE") and.push(HAS_PROJECT);
  if (status === "UNASSIGNED") and.push(sequelize.where(HAS_PROJECT, false));
  if (and.length) where[Op.and] = and;

  const [total, rows, stats] = await Promise.all([
    Office.count({ where }),
    Office.findAll({
      ...ITEM_QUERY,
      where,
      order: [
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: (page - 1) * limit,
    }),
    companyStats(employerId),
  ]);
  return { items: rows.map((o) => toItem(o, lang)), total, page, limit, stats };
};

// GET /offices/:id.
const getOffice = async ({ employerId }, id, lang) => toItem(await findOffice(employerId, id, ITEM_QUERY), lang);

const UNIQUE_KEY_CODES = { uq_offices_employer_id_office_name_live_key: "OFFICE_NAME_TAKEN" };

// Live names are unique per company, case-insensitively (the column collation compares that way).
const assertNameFree = async (employerId, name, exceptId) => {
  const where = { employer_id: employerId, office_name: name };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  if (await Office.findOne({ where, attributes: ["id"] })) throw new ErrorHandler("OFFICE_NAME_TAKEN");
};

// Country (required) and city (optional, in that country): field errors, both at once.
const checkPlace = async (countryId, cityId) => {
  const errors = {};
  let country = null;
  try {
    country = await assertCountry(countryId, "countryId");
  } catch (err) {
    Object.assign(errors, err.errors);
  }
  if (country) {
    try {
      await assertCityInCountry(cityId, country.id, "cityId");
    } catch (err) {
      Object.assign(errors, err.errors);
    }
  }
  if (Object.keys(errors).length) throw new ErrorHandler("VALIDATION_FAILED", { errors });
};

// "" and null both mean "none" for lat/lng.
const coord = (value) => (value === "" || value === null || value === undefined ? null : value);

// POST /offices. Body is validated (trimmed, email lowercased, phone in E.164).
const createOffice = async ({ employerId }, body, lang) => {
  await checkPlace(body.countryId, body.cityId);
  await assertNameFree(employerId, body.name);
  const office = await saveOrClash(
    () =>
      Office.create({
        employer_id: employerId,
        office_name: body.name,
        office_email: body.email,
        office_phone: body.phone,
        phone_country: body.phoneCountry,
        office_location: body.location,
        lat: coord(body.latitude),
        lng: coord(body.longitude),
        country_id: body.countryId,
        city_id: orNull(body.cityId ?? null),
      }),
    UNIQUE_KEY_CODES
  );
  return getOffice({ employerId }, office.id, lang);
};

// PUT /offices/:id. Required fields always; omitted optional ones keep their values.
const updateOffice = async ({ employerId }, id, body, lang) => {
  const office = await findOffice(employerId, id);
  const cityId = body.cityId !== undefined ? orNull(body.cityId) : office.city_id;
  await checkPlace(body.countryId, cityId);
  await assertNameFree(employerId, body.name, office.id);

  const changes = {
    office_name: body.name,
    office_email: body.email,
    office_phone: body.phone,
    phone_country: body.phoneCountry,
    office_location: body.location,
    country_id: body.countryId,
    city_id: cityId,
  };
  if (body.latitude !== undefined) changes.lat = coord(body.latitude);
  if (body.longitude !== undefined) changes.lng = coord(body.longitude);
  await saveOrClash(() => office.update(changes), UNIQUE_KEY_CODES);
  return getOffice({ employerId }, office.id, lang);
};

// DELETE /offices/:id. Only while Unassigned (D4): soft delete, the name becomes reusable.
const deleteOffice = async ({ employerId }, id) =>
  sequelize.transaction(async (transaction) => {
    const office = await findOffice(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (await Project.count({ where: { office_id: office.id }, transaction })) throw new ErrorHandler("OFFICE_IN_USE");
    await office.destroy({ transaction });
    return { id: office.id };
  });

// Removes an old image file after the database no longer points at it. A failure only leaves
// an orphan file, so it's logged rather than failing the request.
const removeImageFile = async (url) => {
  const storagePath = toStoragePath(url);
  if (!storagePath) return;
  try {
    await storage.remove(storagePath);
  } catch (err) {
    console.error("[offices] could not delete image file", { path: storagePath, error: err.message });
  }
};

// PUT /offices/:id/image. `file` is multer's in-memory file (or undefined).
const replaceImage = async ({ employerId }, id, file, lang) => {
  const office = await findOffice(employerId, id);
  const ext = imageExtension(file && file.buffer);
  if (!ext) throw new ErrorHandler("OFFICE_IMAGE_INVALID");
  const oldUrl = office.office_image;
  const storagePath = await storage.save(file.buffer, IMAGE_FOLDER, ext);
  try {
    await office.update({ office_image: toUploadUrl(storagePath) });
  } catch (err) {
    await storage.remove(storagePath);
    throw err;
  }
  await removeImageFile(oldUrl);
  return getOffice({ employerId }, office.id, lang);
};

// DELETE /offices/:id/image. 200 even when there is no image.
const removeImage = async ({ employerId }, id, lang) => {
  const office = await findOffice(employerId, id);
  const oldUrl = office.office_image;
  if (oldUrl) {
    await office.update({ office_image: null });
    await removeImageFile(oldUrl);
  }
  return getOffice({ employerId }, office.id, lang);
};

module.exports = {
  listOffices,
  getOffice,
  createOffice,
  updateOffice,
  deleteOffice,
  replaceImage,
  removeImage,
  // Shared with the projects service.
  findOffice,
  checkPlace,
  removeImageFile,
};
