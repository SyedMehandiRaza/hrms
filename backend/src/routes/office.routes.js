const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const uploadImage = require("../middlewares/uploadImage");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { officeSchema, listOfficesSchema } = require("../validations/office.validation");
const officeController = require("../controllers/office.controller");

// /offices (workforce D1–D6, ADR 0010): ADMIN, or a role with the matching office flag.
// Staffing-company logins never (workforce D57), whatever their role allows.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("office", action)];

router.get("/", ...can("read"), validate(listOfficesSchema, "query"), officeController.listOffices);
router.post("/", ...can("create"), validate(officeSchema), officeController.createOffice);
router.get("/:id", ...can("read"), officeController.getOffice);
router.put("/:id", ...can("update"), validate(officeSchema), officeController.updateOffice);
router.delete("/:id", ...can("delete"), officeController.deleteOffice);
router.put("/:id/image", ...can("update"), uploadImage("image", "OFFICE_IMAGE_INVALID"), officeController.uploadImage);
router.delete("/:id/image", ...can("update"), officeController.deleteImage);

module.exports = router;
