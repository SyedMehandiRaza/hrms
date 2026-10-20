# 22: Merge values

**What to build:** One shared resolver that turns a contract's merge fields into text values for a recipient: the
fixed catalogue, the employee's main project, the English formats, and the values-hash recipe. Used by the draft
preview (live values) and by send (frozen values) (plan decisions 20, 32, 44, ADR 0006, ADR 0008).

**Blocked by:** 05 Templates and merge-field catalogue API, 06 Recipient lookup API

**Status:** done

- [x] When values are resolved for an employee → every Employee-group token returns the plan's source (e.g.
      `employee_name` = full name, `employee_code` = the employee code, `designation`, `department`, `shift`).
- [x] When values are resolved for a staffing company → every Staffing Company-group token returns its source.
- [x] When values are resolved for the Contract group → name, type, start and end dates, rate, notice period, number
      and sent date come from the contract (number and sent date blank before send).
- [x] When a value is a date → "16 Jan 2023"; an enum FULL_TIME → "Full Time", IN_NOTICE → "In Notice", MALE →
      "Male"; a rate of 4500 MONTHLY SAR → "SAR 4,500.00 / month", and HOURLY / DAILY / ANNUAL → "/ hour", "/ day",
      "/ year"; a notice period of 1 → "1 day", 30 → "30 days", 0 → "0 days".
- [x] When a name or address is stored in Arabic → it is returned as stored.
- [x] When the receiver's language is Arabic → the formats above are still English.
- [x] When an employee is on company payroll → `staffing_company` is blank.
- [x] When the employee has two active main projects → the one with the latest main-project start date (then latest
      created) is used; with none → blank, and the contract's project is empty.
- [x] When a source value is empty → the value is reported as missing, with the field's label.
- [x] When the values hash is computed twice for the same values in a different order → the same hash.
- [x] When a drawn signature is part of the values → the hash uses the image's SHA-256, not its path.
- [x] When values are resolved → no employee, account or staffing-company row is changed.
