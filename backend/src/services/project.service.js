const { Op } = require("sequelize");
const {
  sequelize,
  Project,
  Office,
  Country,
  City,
  EmployeeProject,
  EmployeeProjectHistory,
  NumberSequence,
} = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { saveOrClash } = require("../utils/uniqueClash");
const { imageExtension, toUploadUrl } = require("../utils/imageFile");
const { clock } = require("../utils/clock");
const storage = require("./storage.service");
const { UUID, likePattern, orNull } = require("./department.service");
const { localName } = require("./geo.service");
const { checkPlace, removeImageFile } = require("./office.service");
const { companyToday, financialYearOn } = require("./companyTime.service");

// Projects (docs/plans/workforce-and-lifecycle.md D7–D12, D16, ADR 0010). Always the caller's own
// company; another company's project answers 404. Every project has exactly one head office and
// a head office at most one project. project:read sees all of the company's projects.

const IMAGE_FOLDER = "projects";

// D7: allowed status changes.
const TRANSITIONS = { ACTIVE: ["ON_HOLD", "COMPLETED"], ON_HOLD: ["ACTIVE", "COMPLETED"], COMPLETED: ["ACTIVE"] };

// ACTIVE + IN_NOTICE employees with a current assignment (main or secondary) on the project, and
// those of them with employment type CONTRACT (D6).
const EMPLOYEE_COUNT = (contractOnly) =>
  sequelize.literal(
    "(SELECT COUNT(DISTINCT ep.employee_id) FROM `employee_projects` ep " +
      "JOIN `employees` e ON e.id = ep.employee_id AND e.deleted_at IS NULL " +
      "WHERE ep.project_id = `Project`.`id` AND ep.is_active = 1 AND e.employment_status IN ('ACTIVE', 'IN_NOTICE')" +
      (contractOnly ? " AND e.employment_type = 'CONTRACT'" : "") +
      ")"
  );

const ITEM_QUERY = {
  attributes: { include: [[EMPLOYEE_COUNT(false), "employee_count"], [EMPLOYEE_COUNT(true), "contract_employee_count"]] },
  include: [
    { model: Office, as: "office", attributes: ["id", "office_name", "office_location"], required: false },
    { model: Country, as: "country", attributes: ["id", "iso2", "name", "name_ar"], required: false },
    { model: City, as: "city", attributes: ["id", "city_name", "name_ar"], required: false },
  ],
};

const num = (value) => (value === null || value === undefined ? null : Number(value));

const toItem = (p, lang) => ({
  id: p.id,
  name: p.project_name,
  code: p.project_code,
  description: p.description ?? null,
  location: p.project_location,
  latitude: num(p.lat),
  longitude: num(p.lng),
  radius: p.radius_meters,
  allow_offline_attendance: Boolean(p.allow_offline_attendance),
  start_date: p.start_date,
  end_date: p.end_date,
  status: p.status,
  photo: p.photo_url || null,
  office: p.office ? { id: p.office.id, name: p.office.office_name, location: p.office.office_location } : null,
  country: p.country ? { id: p.country.id, iso2: p.country.iso2, name: localName(p.country, lang) } : null,
  city: p.city ? { id: p.city.id, name: localName(p.city, lang, "city_name") } : null,
  employee_count: Number(p.get("employee_count") || 0),
  contract_employee_count: Number(p.get("contract_employee_count") || 0),
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

// The caller's live project, or 404 (also for a malformed id).
const findProject = async (employerId, id, options = {}) => {
  const project = UUID.test(String(id)) ? await Project.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!project) throw new ErrorHandler("NOT_FOUND");
  return project;
};

// Company-wide stats, whatever the list filters (D15): projects by status, and the ACTIVE +
// IN_NOTICE employees with a current assignment on any of them.
const companyStats = async (employerId) => {
  const [[row]] = await sequelize.query(
    `SELECT
       (SELECT COUNT(*) FROM projects p WHERE p.employer_id = :e AND p.deleted_at IS NULL) AS total_projects,
       (SELECT COUNT(*) FROM projects p WHERE p.employer_id = :e AND p.deleted_at IS NULL AND p.status = 'ACTIVE') AS active_projects,
       (SELECT COUNT(*) FROM projects p WHERE p.employer_id = :e AND p.deleted_at IS NULL AND p.status = 'ON_HOLD') AS on_hold_projects,
       (SELECT COUNT(*) FROM projects p WHERE p.employer_id = :e AND p.deleted_at IS NULL AND p.status = 'COMPLETED') AS completed_projects,
       (SELECT COUNT(DISTINCT ep.employee_id) FROM employee_projects ep
          JOIN projects p ON p.id = ep.project_id AND p.deleted_at IS NULL
          JOIN employees e ON e.id = ep.employee_id AND e.deleted_at IS NULL
          WHERE p.employer_id = :e AND ep.is_active = 1 AND e.employment_status IN ('ACTIVE', 'IN_NOTICE')) AS total_employees`,
    { replacements: { e: employerId } }
  );
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
};

// GET /projects. Query is validated: { page, limit, search, status }. Newest first.
const listProjects = async ({ employerId }, { page, limit, search, status }, lang) => {
  const where = { employer_id: employerId };
  if (status) where.status = status;
  if (search) {
    const pattern = likePattern(search);
    where[Op.or] = [
      { project_name: { [Op.like]: pattern } },
      { project_code: { [Op.like]: pattern } },
      { project_location: { [Op.like]: pattern } },
    ];
  }
  const [total, rows, stats] = await Promise.all([
    Project.count({ where }),
    Project.findAll({
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
  return { items: rows.map((p) => toItem(p, lang)), total, page, limit, stats };
};

// GET /projects/:id (includes the head office).
const getProject = async ({ employerId }, id, lang) => toItem(await findProject(employerId, id, ITEM_QUERY), lang);

// GET /projects/office-options?projectId=: Unassigned head offices, plus the project's own one
// when editing (D12).
const officeOptions = async ({ employerId }, { projectId }) => {
  let current = null;
  if (projectId) current = await findProject(employerId, projectId, { attributes: ["id", "office_id"] });
  const offices = await Office.findAll({
    where: {
      employer_id: employerId,
      [Op.or]: [
        sequelize.literal("NOT EXISTS (SELECT 1 FROM `projects` p WHERE p.office_id = `Office`.`id`)"),
        ...(current ? [{ id: current.office_id }] : []),
      ],
    },
    attributes: ["id", "office_name", "office_location"],
    order: [["office_name", "ASC"]],
  });
  return offices.map((o) => ({ id: o.id, name: o.office_name, location: o.office_location }));
};

// The next free code for a project created today: PRJ-FY{yy}-{NNNN}, sequential per company per
// financial year (D10); yy = the last two digits of that FY's start year. The sequence row is
// locked for the transaction; a code already used (e.g. imported) is skipped.
const nextProjectCode = async (employerId, transaction) => {
  const today = await companyToday(employerId, { transaction });
  const fy = await financialYearOn(employerId, today, { transaction });
  if (!fy) throw new Error(`no financial year contains ${today} for company ${employerId}`);
  await sequelize.query(
    `INSERT IGNORE INTO hrms_number_sequences (id, employer_id, doc_type, financial_year_id, last_no, created_at, updated_at)
     VALUES (UUID(), ?, 'PROJECT', ?, 0, NOW(), NOW())`,
    { replacements: [employerId, fy.id], transaction }
  );
  const seq = await NumberSequence.findOne({
    where: { employer_id: employerId, doc_type: "PROJECT", financial_year_id: fy.id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const yy = String(fy.year_key).slice(-2);
  let n = seq.last_no;
  let code;
  do {
    n += 1;
    code = `PRJ-FY${yy}-${String(n).padStart(4, "0")}`;
  } while (await Project.findOne({ where: { employer_id: employerId, project_code: code }, paranoid: false, attributes: ["id"], transaction }));
  await seq.update({ last_no: n }, { transaction });
  return code;
};

const UNIQUE_KEY_CODES = {
  uq_projects_employer_id_project_name_live_key: "PROJECT_NAME_TAKEN",
  uq_projects_office_id: "PROJECT_OFFICE_TAKEN",
};

// The office must be a live office of the company (else the officeId field error) and have no
// other project (else PROJECT_OFFICE_TAKEN).
const assertOfficeFree = async (employerId, officeId, exceptProjectId, transaction) => {
  const office = UUID.test(String(officeId))
    ? await Office.findOne({ where: { id: officeId, employer_id: employerId }, attributes: ["id"], transaction })
    : null;
  if (!office) throw new ErrorHandler("VALIDATION_FAILED", { errors: { officeId: "officeSelect" } });
  const where = { office_id: office.id };
  if (exceptProjectId) where.id = { [Op.ne]: exceptProjectId };
  if (await Project.findOne({ where, paranoid: false, attributes: ["id"], transaction })) throw new ErrorHandler("PROJECT_OFFICE_TAKEN");
};

const assertNameFree = async (employerId, name, exceptId, transaction) => {
  const where = { employer_id: employerId, project_name: name };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  if (await Project.findOne({ where, attributes: ["id"], transaction })) throw new ErrorHandler("PROJECT_NAME_TAKEN");
};

const columnsFrom = (body) => ({
  project_name: body.name,
  office_id: body.officeId,
  start_date: body.startDate,
  end_date: body.endDate,
  project_location: body.location,
  lat: body.latitude,
  lng: body.longitude,
  radius_meters: Math.round(body.radius),
  country_id: body.countryId,
});

// Ends the project's secondary assignments today with REMOVED history rows (D8).
const endSecondaryAssignments = async (project, userId, transaction) => {
  const today = await companyToday(project.employer_id, { transaction });
  const rows = await EmployeeProject.findAll({
    where: { project_id: project.id, is_active: true, main_project: false },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  for (const row of rows) {
    await row.update({ is_active: false, end_date: today }, { transaction });
    await EmployeeProjectHistory.create(
      {
        employer_id: project.employer_id,
        employee_id: row.employee_id,
        project_id: project.id,
        action: "REMOVED",
        effective_date: today,
        actioned_by: userId,
        notes: "Project completed",
        actioned_at: clock.now(),
      },
      { transaction }
    );
  }
};

// Applies a status change (D7, D8). The same status is no change.
const applyStatus = async (project, status, userId, transaction) => {
  if (status === undefined || status === project.status) return;
  if (!TRANSITIONS[project.status].includes(status)) {
    throw new ErrorHandler("VALIDATION_FAILED", { errors: { status: "statusChangeNotAllowed" } });
  }
  if (status === "COMPLETED") {
    const [[{ n }]] = await sequelize.query(
      `SELECT COUNT(*) AS n FROM employee_projects ep JOIN employees e ON e.id = ep.employee_id AND e.deleted_at IS NULL
       WHERE ep.project_id = ? AND ep.is_active = 1 AND ep.main_project = 1 AND e.employment_status IN ('ACTIVE', 'IN_NOTICE')`,
      { replacements: [project.id], transaction }
    );
    if (Number(n) > 0) throw new ErrorHandler("PROJECT_HAS_EMPLOYEES");
    await endSecondaryAssignments(project, userId, transaction);
  }
  await project.update({ status }, { transaction });
};

// POST /projects. Body is validated; the code is the server's (D10).
const createProject = async ({ employerId }, body, lang) => {
  await checkPlace(body.countryId, body.cityId);
  const id = await sequelize.transaction(async (transaction) => {
    await assertOfficeFree(employerId, body.officeId, null, transaction);
    await assertNameFree(employerId, body.name, null, transaction);
    const project = await saveOrClash(
      async () =>
        Project.create(
          {
            ...columnsFrom(body),
            employer_id: employerId,
            project_code: await nextProjectCode(employerId, transaction),
            city_id: orNull(body.cityId ?? null),
            description: orNull(body.description ?? null),
            allow_offline_attendance: body.allowOfflineAttendance ?? true,
            status: body.status || "ACTIVE",
          },
          { transaction }
        ),
      UNIQUE_KEY_CODES
    );
    return project.id;
  });
  return getProject({ employerId }, id, lang);
};

// PUT /projects/:id. Required fields always; omitted optional ones keep their values. The start
// can't move after any assignment's start (D11); a status change follows applyStatus.
const updateProject = async ({ employerId, userId }, id, body, lang) => {
  await sequelize.transaction(async (transaction) => {
    const project = await findProject(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    const cityId = body.cityId !== undefined ? orNull(body.cityId) : project.city_id;
    await checkPlace(body.countryId, cityId);
    await assertOfficeFree(employerId, body.officeId, project.id, transaction);
    await assertNameFree(employerId, body.name, project.id, transaction);

    const [[{ first }]] = await sequelize.query(
      "SELECT DATE_FORMAT(MIN(start_date), '%Y-%m-%d') AS first FROM employee_projects WHERE project_id = ?",
      { replacements: [project.id], transaction }
    );
    if (first && body.startDate > first) throw new ErrorHandler("PROJECT_START_AFTER_ASSIGNMENTS");

    const changes = { ...columnsFrom(body), city_id: cityId };
    if (body.description !== undefined) changes.description = orNull(body.description);
    if (body.allowOfflineAttendance !== undefined) changes.allow_offline_attendance = body.allowOfflineAttendance;
    await saveOrClash(() => project.update(changes, { transaction }), UNIQUE_KEY_CODES);
    await applyStatus(project, body.status, userId, transaction);
  });
  return getProject({ employerId }, id, lang);
};

// PATCH /projects/:id/status
const changeStatus = async ({ employerId, userId }, id, { status }, lang) => {
  await sequelize.transaction(async (transaction) => {
    const project = await findProject(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    await applyStatus(project, status, userId, transaction);
  });
  return getProject({ employerId }, id, lang);
};

// PUT /projects/:id/image. `file` is multer's in-memory file (or undefined).
const replaceImage = async ({ employerId }, id, file, lang) => {
  const project = await findProject(employerId, id);
  const ext = imageExtension(file && file.buffer);
  if (!ext) throw new ErrorHandler("PROJECT_IMAGE_INVALID");
  const oldUrl = project.photo_url;
  const storagePath = await storage.save(file.buffer, IMAGE_FOLDER, ext);
  try {
    await project.update({ photo_url: toUploadUrl(storagePath) });
  } catch (err) {
    await storage.remove(storagePath);
    throw err;
  }
  await removeImageFile(oldUrl);
  return getProject({ employerId }, project.id, lang);
};

// DELETE /projects/:id/image. 200 even when there is no photo.
const removeImage = async ({ employerId }, id, lang) => {
  const project = await findProject(employerId, id);
  const oldUrl = project.photo_url;
  if (oldUrl) {
    await project.update({ photo_url: null });
    await removeImageFile(oldUrl);
  }
  return getProject({ employerId }, project.id, lang);
};

module.exports = {
  listProjects,
  getProject,
  officeOptions,
  createProject,
  updateProject,
  changeStatus,
  replaceImage,
  removeImage,
  // Shared with the assignment and employee services.
  findProject,
  nextProjectCode,
};
