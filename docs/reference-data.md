# Reference data: countries and cities

Plan: `docs/plans/countries-cities-phones.md` (D1–D5).

## Sources and licences
- **Countries:** ISO 3166 codes and English/Arabic names from
  [`i18n-iso-countries`](https://github.com/michaelwittig/node-i18n-iso-countries) (MIT); calling codes from
  [`libphonenumber-js`](https://gitlab.com/catamphetamine/libphonenumber-js) (MIT). Only countries with a phone
  numbering plan are included (243).
- **Cities:** [GeoNames](https://www.geonames.org/) `cities15000` (population ≥ 15,000) and per-country
  alternate names for Arabic, for SA, AE, QA, KW, BH, OM, IN, PK, BD, PH, EG, NP, LK (5,414 cities).
  GeoNames data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):
  "Contains data from GeoNames (geonames.org)". Cities without an Arabic name show their English name.

## Files
- `backend/src/data/geo/countries.json`, `backend/src/data/geo/cities.json`: committed, generated.
- Loaded by migration `20261020500002-geo-load-reference-data` (every database, tests included), keeping
  the ids of the first seed's 6 countries and 6 Saudi cities.

## Rebuilding
1. Download `https://download.geonames.org/export/dump/cities15000.zip` and, per country,
   `https://download.geonames.org/export/dump/alternatenames/<CC>.zip` into an empty folder; unzip each
   alternate-names file into `alt-<CC>/`.
2. `cd backend && node scripts/build-geo-data.js <folder>/cities15000.txt <folder>`
3. `npm run geo:load` updates an existing database (adds new rows, updates names, never deletes).
