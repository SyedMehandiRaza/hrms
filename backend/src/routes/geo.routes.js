const { Router } = require("express");
const validate = require("../middlewares/validate");
const { lookupRateLimiter } = require("../middlewares/rateLimit");
const { getRateLimitConfig } = require("../config/rateLimit");
const { listCitiesSchema } = require("../validations/geo.validation");
const geoController = require("../controllers/geo.controller");

// /countries: public lookups (also used by sign-up), each route with its own per-IP budget.
// Built by a factory so tests can mount it with small limits.
const createGeoRouter = (limits = getRateLimitConfig()) => {
  const router = Router();
  router.get("/", lookupRateLimiter(limits), geoController.listCountries);
  router.get("/:id/cities", lookupRateLimiter(limits), validate(listCitiesSchema, "query"), geoController.listCities);
  return router;
};

module.exports = { createGeoRouter };
