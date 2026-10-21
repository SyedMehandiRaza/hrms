// Project form rules shared by Create Project and Edit Project, matching the
// backend (project.validation.js) so neither form accepts what the API
// rejects — or rejects what it accepts.

// Name: letters/digits in any script (Arabic…) plus common punctuation.
export const PROJECT_NAME_PATTERN = /^[\p{L}\p{M}\p{N}\s\-&,()'’./:#]+$/u;
export const PROJECT_NAME_MIN = 2;
export const PROJECT_NAME_MAX = 255;

// Description: optional free text (line breaks allowed), up to 1000.
export const PROJECT_DESCRIPTION_MAX = 1000;

// Geofence radius in meters. Below ~50 m GPS error alone makes check-in fail.
export const RADIUS_MIN = 50;
export const RADIUS_MAX = 100000;

// The three statuses the backend stores.
export const PROJECT_STATUS_OPTIONS = [
  { value: "ACTIVE", labelKey: "status.active" },
  { value: "ON_HOLD", labelKey: "status.onHold" },
  { value: "COMPLETED", labelKey: "status.completed" },
];
const STATUS_VALUES = PROJECT_STATUS_OPTIONS.map((o) => o.value);

// Photo: JPG or PNG up to 2 MB (the server also checks the file's magic bytes).
export const PROJECT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PROJECT_IMAGE_TYPES = ["image/png", "image/jpeg"];
export const isValidProjectImage = (file) =>
  Boolean(file) && PROJECT_IMAGE_TYPES.includes(file.type) && file.size <= PROJECT_IMAGE_MAX_BYTES;

// API field → form field, so server field errors land under the inputs. The office and the map
// location aren't plain inputs; their errors are shown by the forms themselves.
export const PROJECT_FIELD_MAP = { name: "projectName" };
export const PROJECT_FIELDS = ["projectName", "startDate", "endDate", "radius", "description", "countryId", "cityId", "status"];
export const PROJECT_OFFICE_FIELDS = ["officeId"];
export const PROJECT_LOCATION_FIELDS = ["location", "latitude", "longitude"];

// 409 codes that belong under one input.
export const PROJECT_CODE_FIELDS = {
  PROJECT_NAME_TAKEN: "projectName",
  PROJECT_HAS_EMPLOYEES: "status",
  PROJECT_START_AFTER_ASSIGNMENTS: "startDate",
};

// An API item (or nothing, for a new project) → form values.
export const toProjectFormValues = (project, companyCountry) => ({
  projectName: project?.name || "",
  status: STATUS_VALUES.includes(project?.status) ? project.status : "ACTIVE",
  allowOffline: project ? project.allow_offline_attendance !== false : true,
  startDate: project?.start_date || "",
  endDate: project?.end_date || "",
  description: project?.description || "",
  radius: project?.radius ?? "",
  countryId: project?.country?.id || companyCountry?.id || "",
  cityId: project?.city?.id || "",
});

// The form's values + the picked office and map point → the POST/PUT body.
export const toProjectBody = (data, { officeId, position, address }) => ({
  name: data.projectName.trim(),
  officeId,
  startDate: data.startDate,
  endDate: data.endDate,
  // The map's address (up to 255 characters, like the API), else the coordinates.
  location: ((address || "").trim() || `${Number(position.lat).toFixed(5)}, ${Number(position.lng).toFixed(5)}`).slice(0, 255),
  latitude: Number(position.lat),
  longitude: Number(position.lng),
  radius: Number(data.radius),
  allowOfflineAttendance: Boolean(data.allowOffline),
  description: data.description?.trim() || null,
  countryId: data.countryId,
  cityId: data.cityId || null,
  status: STATUS_VALUES.includes(data.status) ? data.status : "ACTIVE",
});
