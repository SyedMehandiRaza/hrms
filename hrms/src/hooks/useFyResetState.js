import { useState } from "react";

// State that falls back to `initial` whenever the financial year changes —
// without a setState-in-effect. A value picked in one FY is forgotten as soon
// as `version` (useFiscalYear().version) moves on.
//
//   const fy = useFiscalYear();
//   const [month, setMonth] = useFyResetState(fy.defaultMonth, fy.version);
export default function useFyResetState(initial, version) {
  const [state, setState] = useState({ version, value: undefined, touched: false });
  const value = state.touched && state.version === version ? state.value : initial;
  const set = (next) =>
    setState({
      version,
      value: typeof next === "function" ? next(value) : next,
      touched: true,
    });
  return [value, set];
}
