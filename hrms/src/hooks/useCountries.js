import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCountries } from "../api/geo";

// The UI language as the API understands it ("en" | "ar").
export const useApiLang = () => {
  const { i18n } = useTranslation();
  return (i18n.resolvedLanguage || i18n.language || "en").startsWith("ar") ? "ar" : "en";
};

// The country list in the current UI language (loaded once per session and language by
// api/geo.js); switching the language loads, or reuses, that language's list.
//   const { countries, loading, error } = useCountries();
export default function useCountries() {
  const lang = useApiLang();
  const [state, setState] = useState({ lang: null, countries: [], error: null });

  useEffect(() => {
    let alive = true;
    getCountries(lang)
      .then((countries) => alive && setState({ lang, countries, error: null }))
      .catch((error) => alive && setState({ lang, countries: [], error }));
    return () => {
      alive = false;
    };
  }, [lang]);

  return { countries: state.countries, loading: state.lang !== lang, error: state.error };
}
