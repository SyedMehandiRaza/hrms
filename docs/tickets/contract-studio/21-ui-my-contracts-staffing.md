# 21: Staffing portal Contracts page

**What to build:** `/staffing-company/contracts` lists and signs the staffing company's own contracts using the same
screen as ticket 20 (plan decisions 3, 26). Nothing else in the staffing portal changes.

**Blocked by:** 20 My Contracts (Employee panel and admin My Requests)

**Status:** done

Verified by the ui-tester agent:

- [x] When the staffing company opens Contracts → only Staffing Company contracts addressed to it, with the
      company subtitle; none of its supplied employees' contracts.
- [x] When the staffing company opens, signs with consent, rejects with a reason or downloads → the same results
      and messages as ticket 20.
- [x] When the staffing company opens `/staffing-company/contracts?contract=<id>` (the email link) → that contract
      opens.
- [x] When lint runs → it passes.
