# 25: Demo contracts seed

**What to build:** Demo contracts for manual testing and the ui-tester, created through the real services so
numbers, evidence, hashes and the final PDF are genuine (plan section 5).

**Blocked by:** 12 Approve and revoke

**Status:** ready-for-agent

- [ ] When the seed runs → employee@hrms.test has a SENT, a SUBMITTED and a COMPLETED contract, and the seeded
      staffing company has a SENT contract, each with a CON number.
- [ ] When the seed runs on any day → the SENT contracts' sign-by date is 7 days after that day, so they aren't
      expired.
- [ ] When the COMPLETED contract is downloaded → the final PDF ends with the certificate page and matches its
      stored hash.
- [ ] When the SUBMITTED contract is opened by HR → its evidence is present and its values hash reproduces.
- [ ] When the seed is undone → the demo contracts, their files and their activity are removed.
