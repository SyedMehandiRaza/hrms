# Plan: Countries, cities and phone numbers

Status: **Agreed 2026-10-20** (planning session, 9 questions; D17 and the staffing-form deferral confirmed by the
user the same day). Open questions: **0** (deferred items in §6).
Scope: country and city reference data, a country → city picker wherever a city is chosen, and one way to store and
check phone numbers (E.164). Rules shared by all modules: `docs/standards.md`. Terms: `docs/CONTEXT.md`.
Reason for the phone format: `docs/adr/0012-phones-stored-as-e164.md`.
Builds on Auth + Company (done) and changes some Workforce tickets (§7).

---

## 1. Decisions

### Reference data
1. **Countries: all** (~250), each with `iso2`, `iso3`, English and Arabic name, calling code (`+966`) and flag
   emoji. Source: `i18n-iso-countries` (names, MIT) + `libphonenumber-js` (calling codes, MIT).
2. **Cities: only for these countries** — Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman, India, Pakistan,
   Bangladesh, Philippines, Egypt, Nepal, Sri Lanka. Source: GeoNames `cities15000` (population ≥ 15,000,
   CC BY 4.0, attribution in the docs), with Arabic names from GeoNames alternate names where they exist (else the
   English name is shown).
3. Both are generated once by a dev script into JSON files committed in the repo and loaded by a seeder. Re-running
   the seeder updates names and adds new rows; it never deletes (rows are matched by `iso2` / GeoNames id).
4. Reference data is **global** (no `employer_id`) and read-only through the API. Admins can't add cities; new
   cities come from the seed file. `is_active=false` hides a row from pickers without breaking saved records.
5. The 3 seeded countries and 6 seeded Saudi cities keep their ids (matched by `iso2` / name) so existing links survive.

### Pickers
6. **Country → City everywhere a city is chosen**: employee (new, residence), project (existing City field gets a
   Country before it), head office (new Country + City next to the map location), staffing company (new, wired when
   the Staffing module is built). These are **approved UI additions**.
7. Country is **required** and defaults to the **company's country**. City is **optional** and must belong to the
   chosen country. A country with no cities loaded shows "No cities available" and the City stays empty.
8. Changing the country clears the city.
9. The city list is searched on the server (type-ahead, 20 per page); the country list (~250) is loaded once and
   cached by the UI.
10. Names are returned in the request language (`Accept-Language` `en` | `ar`), falling back to English.

### Company country
11. `employers.country_id`: Saudi Arabia for every company (set at sign-up; existing companies migrated). **Not
    editable yet** (like currency). It's the default for every Country picker and phone code.

### Employee
12. New: **residence country** (required, default company country) and **residence city** (optional). They mean
    where the employee lives/works.
13. **Nationality** stays a separate field but is stored as a country id (`nationality_country_id`). The old text
    column is matched to countries by English or Arabic name in a data migration; unmatched values are listed in the
    migration report, left NULL, and the text is kept until the column is dropped.
14. Nationality **does not** change the phone code (a foreign worker usually has a local number). The current
    "nationality fills the code" behaviour is removed.

### Phone numbers (ADR 12)
15. Every phone is stored as **E.164** (`+966501234567`) plus the **phone country** `iso2` (needed because `+1`,
    `+7` and others are shared by several countries).
16. The user picks the phone country (flag + name + code, default company country) and types the number in any
    usual form (`0501234567`, `50 123 4567`, `+966501234567`). The server parses it with `libphonenumber-js`.
17. Valid = a valid number (mobile **or** fixed line, confirmed) for that country — office and company phones are
    often landlines. Otherwise the field error
    "Enter a valid phone number for the selected country." This **replaces** the "6–15 digits" rule everywhere.
18. Uniqueness checks (employee phone per company, `users.phone_number` globally) compare E.164 values, so
    `0501234567` and `+966501234567` are the same number.
19. Responses return `phone` (E.164) and `phoneCountry` (iso2). The UI shows the number in national format with the
    code from the country.
20. Fields: `users.phone_number`, `employees.phone`, `employers.company_phone_number` (company profile and sign-up),
    `offices.office_phone`, `hrms_staffing_companies.phone` and `contact_person_phone`.
21. **Data migration:** values with a `+code` are parsed as such; values without one are parsed as Saudi numbers;
    valid ones are rewritten to E.164 with their country. Anything that can't be parsed is left as it is, with
    phone country NULL, and listed in the migration report (it must be fixed on the next edit).

### Request shape
22. Bodies send `{ phone, phoneCountry }` (and `countryId`, `cityId`, `nationalityCountryId` as ids). Field error
    keys match those names.

## 2. Permission matrix
| Action | Permission |
|---|---|
| List countries, list a country's cities | public (also used on sign-up) |
| Everything else | as in the owning module (employee, office, project, company) |

## 3. Schema changes (migrations)
- `countries`: + `iso3 CHAR(3)`, `name_ar`, `flag`, `is_active bool =1`; `iso2` and `calling_code` NOT NULL.
- `cities`: `country_id` NOT NULL; + `geoname_id INT` unique, `name_ar`, index `(country_id, city_name)`.
- `employers`: + `country_id →countries NN` (Saudi Arabia).
- `employees`: + `nationality_country_id`, `residence_country_id` (NN after migration, default company country),
  `residence_city_id`, `phone_country CHAR(2)`; `nationality` text deprecated.
- `offices`: + `country_id`, `city_id`, `phone_country`.
- `projects`: + `country_id` (existing `city_id` must belong to it).
- `hrms_staffing_companies`: + `country_id`, `city_id`, `phone_country`, `contact_person_phone_country`; text `city`
  migrated to `city_id` where it matches, kept until dropped.
- `users`, `employers`: + `phone_country` for their phone column.

## 4. Endpoints
| Method & path | Who |
|---|---|
| `GET /countries` (all active; `id, iso2, name, callingCode, flag, hasCities`) | public |
| `GET /countries/:id/cities?search=&page=&limit=20` | public |

## 5. Messages
New codes and texts: `docs/standards.md` §7.

## 6. Deferred
- Editing the company country (and what it would change).
- Cities for other countries; admin-managed cities.
- Staffing-company form wiring (confirmed: done with the Staffing module; geo 01 adds the columns and the rules apply
  from then).
- Dropping `employees.nationality` and `hrms_staffing_companies.city` text columns.
- SMS verification of phone numbers.

## 7. Effect on other plans
- Auth + Company (done): the sign-up phone and Company profile phone follow D15–D19; their tests change to the new
  rule (the rule changed, not weakened).
- Workforce: head office (D5), project (D11) and employee (D45–D46) forms get the pickers and phone rule; the
  affected workforce tickets carry an extra AC and are blocked by geo 03 (+ 02 for phones).

## 8. Build order
1. Schema + reference data. 2. Phone service + data migration. 3. Countries/cities API. 4. Auth + Company phones.
5. UI shared pickers on Sign up and Company profile. Then the Workforce tickets that use them.
