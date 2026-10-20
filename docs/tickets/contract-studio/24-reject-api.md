# 24: Reject

**What to build:** The signer rejects a contract with a reason; final, and safe against races (plan decisions 30,
37).

**Blocked by:** 09 Signer inbox API

**Status:** done

- [x] When the employee rejects with a 10–500 character reason → the contract becomes REJECTED and the recipient
      DECLINED with the reason; a DECLINED activity is logged with the reason.
- [x] When the staffing company rejects its own contract → the same.
- [x] When the reason is missing → "Reason is required"; 9 characters → "Reason must be at least 10 characters";
      501 characters → "Reason cannot exceed 500 characters"; an emoji → "Emojis are not allowed".
- [x] When the employee rejects an expired contract (even before the job runs) → 409 / "This contract has expired.
      Contact HR for a new one."; a revoked one → 409 / "This contract was withdrawn by HR."; a submitted or
      completed one → 409 / "You have already signed this contract."; a rejected one → 409 / "This contract can no
      longer be changed."
- [x] When the signer has become inactive → 409 / "This recipient is no longer active."
- [x] When an expired contract is rejected with no reason → 409 / "This contract has expired. Contact HR for a new
      one." (state is checked before the body).
- [x] When a reject and a submit run at the same moment → exactly one succeeds; the other gets the 409 for the new
      state.
- [x] When anyone other than the contract's signer rejects it (another employee, the staffing company for a supplied
      employee's contract, the employee for a staffing contract, HR or the owner) → 404 / "The requested record was
      not found." and nothing changes.
- [x] When HR sends a new contract of the same type to that recipient after the rejection → the send succeeds.
