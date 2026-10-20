const geoService = require("../services/geo.service");

// Reference data changes only with a new release: let browsers and proxies keep it an hour.
const CACHE = "public, max-age=3600";

const listCountries = async (req, res) => {
  res.set("Cache-Control", CACHE).json({ success: true, data: { items: await geoService.listCountries(req.lang) } });
};

const listCities = async (req, res) => {
  res.set("Cache-Control", CACHE).json({ success: true, data: await geoService.listCities(req.lang, req.params.id, req.query) });
};

module.exports = { listCountries, listCities };
