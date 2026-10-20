# 02: Phone service + data migration

**What to build:** One backend service parses, checks and stores phone numbers as E.164 with their country, and
existing phone values are converted (plan D15–D21, ADR 12).

**Blocked by:** 01 Schema + country and city reference data

**Status:** done

Field texts: `docs/standards.md` §7.2 "Countries, cities, phones".

- [x] `0501234567`, `50 123 4567` and `+966501234567` with phone country SA all become `+966501234567` / `SA`.
- [x] A number that isn't valid for its country (e.g. `12345` with SA) → phone "Enter a valid phone number for the
      selected country."; no phone country → phoneCountry "Select the phone number's country."; an unknown iso2 →
      the same phoneCountry message.
- [x] A US and a Canadian number both starting `+1` keep their own phone country.
- [x] A shared validator (Joi or equivalent) is ready for every module to use with `{ phone, phoneCountry }`.
- [x] Migration: existing values with `+code` are parsed with that code, values without one as Saudi numbers; valid
      ones become E.164 with their country; unparseable ones are left unchanged with phone country NULL and listed in
      the report (table, id, value). Users' `phone_number` stays unique after conversion; any clash is reported, not
      overwritten.
- [x] `libphonenumber-js` is added to `backend/package.json`; nothing reads or writes `.env`.

Notes (2026-10-20): service `backend/src/utils/phone.js` (`toE164`, `phoneFields`, `convertExisting`; libphonenumber-js
"max" metadata). Migration `20261020500004`. Dev DB run: 8 phones converted, 0 left unconverted.
The employee phone is `users.phone_number` (see geo 01 notes).
