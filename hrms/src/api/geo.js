import client, { currentLang } from "./client";

// Country and city lookups (backend/src/routes/geo.routes.js; docs/plans/countries-cities-phones.md
// D7–D10). Public: no login needed (sign-up uses them too). Names come in the language asked for;
// the API marks its answers Vary: Accept-Language, so the browser keeps one copy per language.

const inLang = (lang) => ({ headers: { "Accept-Language": lang === "ar" ? "ar" : "en" } });

// GET /countries → [{ id, iso2, name, callingCode, flag, hasCities }], sorted by name in that
// language. Loaded once per session and language (D9); a failed load is retried next call.
const countryCache = new Map();
export const getCountries = (lang = currentLang()) => {
  if (!countryCache.has(lang)) {
    countryCache.set(
      lang,
      client
        .get("/countries", inLang(lang))
        .then((res) => res.data.data.items)
        .catch((err) => {
          countryCache.delete(lang);
          throw err;
        })
    );
  }
  return countryCache.get(lang);
};

// GET /countries/:id/cities?search=&page=&limit= → { items: [{ id, name }], total, page, limit }.
export const getCities = (countryId, { search = "", page = 1, limit = 20, lang = currentLang() } = {}) =>
  client
    .get(`/countries/${countryId}/cities`, { params: { search: search || undefined, page, limit }, ...inLang(lang) })
    .then((res) => res.data.data);
