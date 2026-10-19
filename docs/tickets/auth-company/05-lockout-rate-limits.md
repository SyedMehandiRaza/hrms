# 05: Lockout and rate limits

**What to build:** Password guessing is slowed per person and per IP (D10, D11).

**Blocked by:** 04 Login, refresh, logout

**Status:** ready-for-agent

- [ ] Four wrong passwords followed by the right one log in, and the failure counter resets.
- [ ] Five wrong passwords in a row: the fifth response is 423 `AUTH_ACCOUNT_LOCKED`
      "Too many failed attempts. Try again in 15 minutes."
- [ ] During the 15 minutes even the correct password gets the same 423 message.
- [ ] After the 15 minutes pass (time mocked in the test) the correct password logs in.
- [ ] Repeated failures for an email that doesn't exist never produce the locked message.
- [ ] The 11th request within a minute from one IP to login, sign up, forgot password, verify code, reset
      password or set password gets 429 `RATE_LIMITED` "Too many requests. Please try again in a minute."
- [ ] Refresh allows 60 requests per minute per IP before the same 429.
- [ ] Limits are configurable so tests can use small numbers.
