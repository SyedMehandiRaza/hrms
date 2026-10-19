const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { departmentSchema, listDepartmentsSchema } = require("../validations/department.validation");
const departmentController = require("../controllers/department.controller");

// /departments (D31): ADMIN, or a role with the matching department flag.
// Staffing-company logins never (plan §2), whatever their role allows.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("department", action)];

router.get("/", ...can("read"), validate(listDepartmentsSchema, "query"), departmentController.listDepartments);
router.post("/", ...can("create"), validate(departmentSchema), departmentController.createDepartment);
router.get("/:id", ...can("read"), departmentController.getDepartment);
router.put("/:id", ...can("update"), validate(departmentSchema), departmentController.updateDepartment);
router.delete("/:id", ...can("delete"), departmentController.deleteDepartment);

module.exports = router;
