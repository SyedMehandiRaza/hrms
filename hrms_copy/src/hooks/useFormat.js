import { useTranslation } from "react-i18next";

import { formatDate, formatNumber } from "../utils/format";

// Date/number formatters bound to the current language.
// const { fmtDate, fmtNumber } = useFormat();
export const useFormat = () => {
  const { i18n } = useTranslation();
  const lng = i18n.language;
  return {
    fmtDate: (value, options) => formatDate(value, lng, options),
    fmtNumber: (value, options) => formatNumber(value, lng, options),
  };
};
