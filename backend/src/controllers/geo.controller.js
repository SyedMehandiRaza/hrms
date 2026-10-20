const geoService = require("../services/geo.service");

// Reference data changes only with a new release: let browsers and proxies keep it an hour.
// Names depend on the language, so caches must keep one copy per Accept-Language.
const CACHE = "public, max-age=3600";
const cacheable = (res) => res.set("Cache-Control", CACHE).vary("Accept-Language");

const listCountries = async (req, res) => {
  cacheable(res).json({ success: true, data: { items: await geoService.listCountries(req.lang) } });
};

const listCities = async (req, res) => {
  cacheable(res).json({ success: true, data: await geoService.listCities(req.lang, req.params.id, req.query) });
};

module.exports = { listCountries, listCities };
