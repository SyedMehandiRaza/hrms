# 03: Countries and cities API

**What to build:** Any screen (including sign-up) can list countries and search a country's cities, in English or
Arabic (plan D7–D10, §4).

**Blocked by:** 01 Schema + country and city reference data

**Status:** ready-for-agent

- [ ] `GET /countries` without a login → all active countries with id, iso2, name, calling code, flag and `hasCities`,
      sorted by name; `Accept-Language: ar` returns Arabic names.
- [ ] `GET /countries/:id/cities?search=jed` → Saudi cities matching "jed" (Jeddah first), 20 per page with paging info;
      Arabic search works on Arabic names.
- [ ] A country with no cities → an empty list, not an error.
- [ ] A city without an Arabic name is returned with its English name when the language is `ar`.
- [ ] An unknown or inactive country id → 404 `NOT_FOUND` "The requested record was not found."
- [ ] A shared check "city belongs to country" is ready for other modules: a city of another country → cityId
      "Select a city in the selected country."
- [ ] Responses are cacheable (`Cache-Control`), and the endpoints are covered by the general rate limit.
