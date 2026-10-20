import { forwardRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import CustomDropdown from "../CustomDropdown";
import useCountries from "../../hooks/useCountries";

// The phone country picker next to a phone input (docs/plans/countries-cities-phones.md D16):
// the list shows flag, name and code ("🇮🇳 India +91") and searches all three; the closed box
// shows only "🇮🇳 +91". The value is the ISO-2 code. Works with react-hook-form's register().
const PhoneCountrySelect = forwardRef(({ className = "", ...props }, ref) => {
  const { t } = useTranslation("common");
  const { countries } = useCountries();
  const options = useMemo(
    () =>
      countries.map((c) => ({
        value: c.iso2,
        label: `${c.flag} ${c.name} ${c.callingCode}`,
        selectedLabel: `${c.flag} ${c.callingCode}`,
      })),
    [countries]
  );

  return (
    <CustomDropdown
      ref={ref}
      isSearchable
      options={options}
      placeholder={t("geo.selectCountry")}
      className={className}
      {...props}
    />
  );
});

PhoneCountrySelect.displayName = "PhoneCountrySelect";

export default PhoneCountrySelect;
