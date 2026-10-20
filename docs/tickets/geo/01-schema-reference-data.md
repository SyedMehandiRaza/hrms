# 01: Schema + country and city reference data

**What to build:** The database holds every country and the cities of the GCC and labour-source countries, and every
table that needs a country, city or phone country has the columns for it (plan D1–D5, D11–D13, §3).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A dev script builds `countries.json` (all ISO countries: iso2, iso3, EN/AR name, calling code, flag) and
      `cities.json` (GeoNames `cities15000` for SA, AE, QA, KW, BH, OM, IN, PK, BD, PH, EG, NP, LK, with Arabic names
      where available); both files are committed and the GeoNames attribution is in the docs.
- [x] After seeding, `countries` has ~250 active rows and every listed country has cities; other countries have none.
- [x] The existing SA/IN/PK countries and the 6 Saudi cities keep their ids; links from projects still work.
- [x] Re-running the seeder adds nothing new and deletes nothing.
- [x] `cities.country_id` is required; `geoname_id` is unique.
- [x] Every company has `country_id` = Saudi Arabia; sign-up sets it in the same transaction.
- [x] Employees, offices, projects, staffing companies and users have the new country / city / phone-country columns
      from plan §3; employees' nationality text is matched to `nationality_country_id` by EN or AR name, and unmatched
      values appear in the migration report.
- [x] Staffing companies' city text is matched to `city_id` where it matches a city of their country.
- [x] Migrations run up and down cleanly on an empty database and on the seeded dev database.

Notes (2026-10-20): the reference rows are loaded by migration `20261020500002` (not a seeder) so every database,
the test database included, has them; `npm run geo:load` re-runs the same upsert. The employee phone is
`users.phone_number`, so its phone country is `users.phone_country` (employees have no phone column).
Sources and attribution: `docs/reference-data.md`.
