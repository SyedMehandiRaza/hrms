import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import CustomDropdown from "../CustomDropdown";
import useCountries, { useApiLang } from "../../hooks/useCountries";
import { getCities } from "../../api/geo";

const SEARCH_DELAY_MS = 250;

// City picker that depends on a country (docs/plans/countries-cities-phones.md D6–D9): the
// country's cities are searched on the server as you type (20 at a time). A country with no
// cities loaded shows "No cities available" and stays empty. Changing the country clears the
// city (through onChange, so react-hook-form sees it). Value = city id; `selected` = the current
// city ({ id, name }) so it shows before any search.
const CitySelect = forwardRef(({ countryId, selected = null, name, onChange, className = "", disabled, ...props }, ref) => {
  const { t } = useTranslation("common");
  const { countries } = useCountries();
  const lang = useApiLang();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const timer = useRef(null);
  const firstCountry = useRef(countryId);

  const country = countries.find((c) => c.id === countryId);
  const noCities = Boolean(country && !country.hasCities);

  // Load (or search) the country's cities, debounced while typing.
  useEffect(() => {
    if (!countryId || noCities) {
      setItems([]);
      return undefined;
    }
    let alive = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      getCities(countryId, { search, lang })
        .then((data) => alive && setItems(data.items))
        .catch(() => alive && setItems([]));
    }, search ? SEARCH_DELAY_MS : 0);
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, [countryId, search, noCities, lang]);

  // A new country clears the city (not on the first render: an edit form keeps its value).
  useEffect(() => {
    if (firstCountry.current === countryId) return;
    firstCountry.current = countryId;
    setSearch("");
    if (onChange) onChange({ target: { name, value: "" } });
  }, [countryId, name, onChange]);

  const options = useMemo(() => {
    const list = items.map((c) => ({ value: c.id, label: c.name }));
    if (selected && selected.id && !list.some((o) => o.value === selected.id)) list.unshift({ value: selected.id, label: selected.name });
    return list;
  }, [items, selected]);

  return (
    <CustomDropdown
      ref={ref}
      name={name}
      onChange={onChange}
      isSearchable
      onSearchChange={setSearch}
      options={options}
      disabled={disabled || !countryId || noCities}
      placeholder={noCities ? t("geo.noCities") : t("geo.selectCity")}
      className={className}
      {...props}
    />
  );
});

CitySelect.displayName = "CitySelect";

export default CitySelect;
