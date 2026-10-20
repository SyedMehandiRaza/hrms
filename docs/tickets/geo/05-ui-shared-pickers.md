# 05: UI shared Country, City and Phone inputs (Sign up, Company profile)

**What to build:** Reusable inputs, a Country select, a City select that depends on the country, and a Phone input
with its own country, all fed by the API, and used first on Sign up and Company profile (plan D6–D10, D14–D19).
Approved UI addition: the inputs keep today's look; only their data and behaviour change.

**Blocked by:** 03 Countries and cities API, 04 Sign-up and company profile use the new phone rule

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] The phone code list shows flag, country name and code, defaults to the company's country (Saudi Arabia, +966
      on sign-up), and searching "ind" finds India (+91).
- [ ] Typing `0501234567` with Saudi Arabia saves and shows as `+966 50 123 4567` after reload.
- [ ] An invalid number shows "Enter a valid phone number for the selected country." under the field.
- [ ] The City select loads the chosen country's cities as you type; changing the country clears the city; a country
      with no cities shows "No cities available".
- [ ] With the language set to Arabic, country and city names show in Arabic.
- [ ] The country list loads once per session, not on every keystroke.
- [ ] The static country data in `hrms/src/data/` is no longer used by these screens.
- [ ] Lint passes.
