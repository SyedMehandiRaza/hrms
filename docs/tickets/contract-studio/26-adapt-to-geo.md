# 26: Adapt to the geo + workforce data

**What to build:** After the geo + workforce branch is merged, Contract Studio reads the new employee,
staffing-company and company data: nationality and residence as countries/cities with English and Arabic names,
E.164 phones, the server-generated employee code and main-project periods (plan section 7). Contract Studio still
only reads those tables; sent contracts never change.

**Blocked by:** geo + workforce branch merged into main; 06 Recipient lookup API; 11 PDF rendering service;
22 Merge values

**Status:** ready-for-agent

- [ ] When a contract is sent to an employee whose nationality is Saudi Arabia and whose language is English → the
      `nationality` value is "Saudi Arabia"; when their language is Arabic → the Arabic country name.
- [ ] When the country has no Arabic name and the signer's language is Arabic → the English name is used.
- [ ] When the employee has no nationality country → `nationality` is missing (blocked by "Some contract values are
      missing: Nationality." only when the field is required).
- [ ] When HR opens the merge-field catalogue for EMPLOYEE → it includes `residence_country`, `residence_city` and
      `id_number`.
- [ ] When a contract is sent → `residence_country` and `residence_city` are the employee's residence country and
      city names in the signer's language; with no residence city → `residence_city` is missing.
- [ ] When a template field uses a residence or nationality token and the signer's language changes after send →
      the sent contract keeps the frozen name.
- [ ] When the employee's phone is `+966501234567` (phone country SA) on a Saudi company → `employee_phone` reads
      "050 123 4567"; when it is `+919876543210` (phone country IN) → "+91 98765 43210".
- [ ] When the staffing company's phone and contact person's phone are E.164 → `company_phone` and
      `contact_person_phone` follow the same national / international rule.
- [ ] When a phone could not be migrated (phone country empty) → the stored value is used as it is.
- [ ] When the staffing company has a city id → `city` is the city name in the signer's language; with no city id →
      the old text city.
- [ ] When a contract is sent → `employee_code` is the server-generated code (e.g. "EMP-0001") and `id_number` is
      the Iqama / national ID.
- [ ] When the merge runs on existing templates and drafts that use `employee_code` → those fields now use
      `id_number`; sent contracts are unchanged.
- [ ] When the employee changed main project last month → the contract's project and `project` value are the new
      main project (the period covering today).
- [ ] When HR looks up employees → each row shows the employee code, ID number, nationality, residence country and
      residence city (names in the request language); search matches name, employee code or ID number.
- [ ] When HR looks up staffing companies → each row shows the city name.
- [ ] When a final PDF is rendered with an Arabic country or city name in an English template, and an international
      phone number → both are drawn in the right order inside their boxes.
- [ ] When the Contract Studio tests run after the merge → employee fixtures use country ids, E.164 phones with a
      phone country and main-project periods, and every earlier ticket's tests still pass (assertions updated only
      where this ticket changes the rule).
- [ ] When the lookup and merge values are resolved → no employee, account, staffing-company or reference row is
      changed.
