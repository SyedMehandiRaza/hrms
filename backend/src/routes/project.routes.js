const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const uploadImage = require("../middlewares/uploadImage");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { projectSchema, statusSchema, listProjectsSchema, officeOptionsSchema } = require("../validations/project.validation");
const projectController = require("../controllers/project.controller");

// /projects (workforce D7–D16, ADR 0010): ADMIN, or a role with the matching project flag.
// Staffing-company logins never (workforce D57), whatever their role allows.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("project", action)];

router.get("/", ...can("read"), validate(listProjectsSchema, "query"), projectController.listProjects);
router.get("/office-options", ...can("read"), validate(officeOptionsSchema, "query"), projectController.officeOptions);
router.post("/", ...can("create"), validate(projectSchema), projectController.createProject);
router.get("/:id", ...can("read"), projectController.getProject);
router.put("/:id", ...can("update"), validate(projectSchema), projectController.updateProject);
router.patch("/:id/status", ...can("update"), validate(statusSchema), projectController.changeStatus);
router.put("/:id/image", ...can("update"), uploadImage("image", "PROJECT_IMAGE_INVALID"), projectController.uploadImage);
router.delete("/:id/image", ...can("update"), projectController.deleteImage);

module.exports = router;
