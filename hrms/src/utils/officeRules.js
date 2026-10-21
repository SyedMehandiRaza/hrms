// Head office form rules shared by Create Head Office and the Edit modal, matching the backend
// (office.validation.js, standards §7.2 "Head office") so neither form accepts what the API
// rejects — or shows a different message for it.
import { DEFAULT_PHONE_COUNTRY, phoneForInput, phoneRule } from "./phone";

export const OFFICE_NAME_MIN = 2;
export const OFFICE_NAME_MAX = 100;
export const OFFICE_NAME_PATTERN = /^[A-Za-z0-9']+(?:\s[A-Za-z0-9']+)*$/;
export const OFFICE_LOCATION_MIN = 3;
export const OFFICE_LOCATION_MAX = 255;
export const OFFICE_LOCATION_PATTERN = /^[A-Za-z0-9,\s-]+$/;
export const OFFICE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Photo: JPG or PNG up to 2 MB (the server also checks the file's magic bytes).
export const OFFICE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const OFFICE_IMAGE_TYPES = ["image/png", "image/jpeg"];
export const isValidOfficeImage = (file) =>
  Boolean(file) && OFFICE_IMAGE_TYPES.includes(file.type) && file.size <= OFFICE_IMAGE_MAX_BYTES;

// The form's fields are named like the API body, so server field errors land under them.
export const OFFICE_FIELDS = ["name", "email", "phone", "phoneCountry", "location", "countryId", "cityId"];

// react-hook-form rules. `t` is the "offices" namespace; getValues reads the phone country.
export const officeRules = (t, getValues) => ({
  name: {
    validate: (v) => {
      const name = (v || "").trim();
      if (!name) return t("validation.nameRequired");
      if (name.length < OFFICE_NAME_MIN) return t("validation.min2Required");
      if (name.length > OFFICE_NAME_MAX) return t("validation.nameMax");
      if (/\s{2,}/.test(name)) return t("validation.multipleSpaces");
      if (!OFFICE_NAME_PATTERN.test(name)) return t("validation.nameChars");
      return true;
    },
  },
  email: {
    validate: (v) => {
      const email = (v || "").trim();
      if (!email) return t("validation.emailRequired");
      if (!OFFICE_EMAIL_PATTERN.test(email)) return t("validation.emailValidAddress");
      return true;
    },
  },
  phone: {
    validate: phoneRule(() => getValues("phoneCountry"), t, {
      required: true,
      requiredMessage: t("validation.phoneNumberRequired"),
    }),
  },
  phoneCountry: { required: t("common:geo.phoneCountryRequired") },
  location: {
    validate: (v) => {
      const location = (v || "").trim();
      if (!location) return t("validation.locationRequired");
      if (location.length < OFFICE_LOCATION_MIN) return t("validation.min3");
      if (location.length > OFFICE_LOCATION_MAX) return t("validation.max255");
      if (!OFFICE_LOCATION_PATTERN.test(location)) return t("validation.locationFormat");
      return true;
    },
  },
  countryId: { required: t("common:geo.countryRequired") },
});

// An office (or nothing, on create) → the form's values. New offices default to the company
// country for both the country and the phone code (countries-cities-phones D11).
export const toOfficeFormValues = (office, companyCountry) => ({
  name: office?.name || "",
  email: office?.email || "",
  phone: phoneForInput(office?.phone),
  phoneCountry: office?.phone_country || companyCountry?.iso2 || DEFAULT_PHONE_COUNTRY,
  location: office?.location || "",
  countryId: office?.country?.id || companyCountry?.id || "",
  cityId: office?.city?.id || "",
});

// The form's values → the POST/PUT body.
export const toOfficeBody = (data) => ({
  name: data.name.trim(),
  email: data.email.trim(),
  phone: data.phone.trim(),
  phoneCountry: data.phoneCountry,
  location: data.location.trim(),
  countryId: data.countryId,
  cityId: data.cityId || null,
});
