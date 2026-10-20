# 12. Phone numbers stored as E.164 with their country

Date: 2026-10-20 · Status: Accepted

## Context
Phones are stored as typed: some with a code (`+966…`), some without, checked only as "6–15 digits". The same
number can then be saved twice (`0501234567` and `+966501234567`), uniqueness checks miss duplicates, and the
calling code alone doesn't identify a country (`+1` is the US, Canada and others).

## Decision
- Every phone is stored as **E.164** (`+966501234567`) plus a **phone country** (`iso2`).
- The server parses and checks numbers with `libphonenumber-js` for that country (mobile or fixed line). This
  replaces the "6–15 digits" rule everywhere.
- The phone country defaults to the company's country, not the person's nationality.
- Existing values are migrated; unparseable ones are kept as they are and reported.

## Consequences
- Uniqueness and search work on one canonical form.
- Every phone input sends `{ phone, phoneCountry }`, and the UI formats numbers for display.
- `libphonenumber-js` metadata must be updated occasionally as numbering plans change.
