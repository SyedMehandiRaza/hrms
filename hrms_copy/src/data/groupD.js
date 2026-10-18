// Group D static data (attendance, corrections, overtime, leave, leave policy,
// encashment, approval groups). Each area lives in its own module; names are
// prefixed per area so the re-exports never collide.
export * from "./groupD/approval.js";
export * from "./groupD/attendance.js";
export * from "./groupD/overtime.js";
export * from "./groupD/leaveSetup.js";
export * from "./groupD/leaveRequests.js";
