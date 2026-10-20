import { forwardRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import CustomDropdown from "../CustomDropdown";
import useCountries from "../../hooks/useCountries";

// Country picker (docs/plans/countries-cities-phones.md D6–D10): flag + name, searchable, value =
// country id. Works with react-hook-form's register(). Pair it with <CitySelect countryId={…} />.
const CountrySelect = forwardRef(({ className = "", ...props }, ref) => {
  const { t } = useTranslation("common");
  const { countries } = useCountries();
  const options = useMemo(() => countries.map((c) => ({ value: c.id, label: `${c.flag} ${c.name}` })), [countries]);

  return (
    <CustomDropdown ref={ref} isSearchable options={options} placeholder={t("geo.selectCountry")} className={className} {...props} />
  );
});

CountrySelect.displayName = "CountrySelect";

export default CountrySelect;
