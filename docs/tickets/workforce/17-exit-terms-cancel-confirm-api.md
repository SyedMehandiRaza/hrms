# 17: Exit edit terms, cancel, confirm immediate API

**What to build:** During notice, admins adjust the terms or cancel the exit, and the owner can end it immediately
(D64, D65).

**Blocked by:** 16b Exit approval outcomes, withdraw, emails; 18 Last-working-day daily job

**Status:** done

Field texts: `docs/standards.md` §7.2 "Exit (raise, edit terms)", "Exit withdraw / cancel", "Exit confirm immediate".

- [x] Editing the LWD, notice days, reason or settlement choices of an IN_NOTICE exit (`employee:create`+`update`) →
      saved without re-approval; `original_last_working_day` is unchanged; an exit event (TERMS_UPDATED or
      LWD_EXTENDED) records old and new values.
- [x] The LWD history lists every change in order.
- [x] An LWD before the notice start or more than 365 days after it → the §7.2 lastWorkingDay texts.
- [x] A non-owner moving the LWD into the past → lastWorkingDay "Last working day cannot be in the past"; the owner can,
      and the exit is processed at once by 18's service.
- [x] Cancel with a reason (5–500) → exit CANCELLED, employee back to ACTIVE; no or short reason → reason "Reason must
      be 5–500 characters".
- [x] Editing or cancelling a PENDING_APPROVAL, REJECTED, CANCELLED or EXITED exit → 409 `EXIT_INVALID_STATE`
      "This action isn't possible in the exit's current status."
- [x] Owner "Confirm → Immediate" with a reason (10–500) → LWD = today and the exit is processed by 18's service right
      away (exit date = today); no or short reason → reason "Override reason must be 10–500 characters"; a non-owner →
      `FORBIDDEN`.
- [x] Another company's exit → `NOT_FOUND`.
