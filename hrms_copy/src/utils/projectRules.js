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
  { value: "INACTIVE", labelKey: "status.onHold" },
  { value: "COMPLETED", labelKey: "status.completed" },
];
