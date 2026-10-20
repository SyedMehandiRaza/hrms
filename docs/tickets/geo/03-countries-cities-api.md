# 03: Countries and cities API

**What to build:** Any screen (including sign-up) can list countries and search a country's cities, in English or
Arabic (plan D7–D10, §4).

**Blocked by:** 01 Schema + country and city reference data

**Status:** done

- [x] `GET /countries` without a login → all active countries with id, iso2, name, calling code, flag and `hasCities`,
      sorted by name; `Accept-Language: ar` returns Arabic names.
- [x] `GET /countries/:id/cities?search=jed` → Saudi cities matching "jed" (Jeddah first), 20 per page with paging info;
      Arabic search works on Arabic names.
- [x] A country with no cities → an empty list, not an error.
- [x] A city without an Arabic name is returned with its English name when the language is `ar`.
- [x] An unknown or inactive country id → 404 `NOT_FOUND` "The requested record was not found."
- [x] A shared check "city belongs to country" is ready for other modules: a city of another country → cityId
      "Select a city in the selected country."
- [x] Responses are cacheable (`Cache-Control: public, max-age=3600`), and each endpoint has a per-IP limit of 60/min
      (`RATE_LIMIT_LOOKUP_MAX`; decided 2026-10-20, there was no general limit) → 429 `RATE_LIMITED`.

Notes (2026-10-20): shared checks for other modules in `backend/src/services/geo.service.js`:
`assertCountry(id, field)` and `assertCityInCountry(cityId, countryId, field)`.
