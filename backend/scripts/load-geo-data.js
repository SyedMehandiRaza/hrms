// Re-runs the country/city upsert against the configured database (development by default), e.g.
// after src/data/geo/*.json was rebuilt. Adds new rows and updates names; never deletes.
//   npm run geo:load
const db = require("../src/models");
const { loadGeoReference } = require("../src/utils/geoReference");

(async () => {
  try {
    const result = await db.sequelize.transaction((transaction) => loadGeoReference(db.sequelize, { transaction }));
    console.log(
      `countries +${result.countriesAdded} ~${result.countriesUpdated}, cities +${result.citiesAdded} ~${result.citiesUpdated}`
    );
  } finally {
    await db.sequelize.close();
  }
})();
