// Contract events raised AFTER their transaction commits (plan decision 43): SENT, SIGNED,
// REJECTED, REMINDED, EXPIRED, REVOKED (with `auto`), COMPLETED. Listeners (notifications,
// ticket 14) must never break the action: failures are logged and swallowed.

const listeners = [];

const onContractEvent = (fn) => {
  listeners.push(fn);
};

const emitContractEvent = async (event, payload) => {
  for (const fn of listeners) {
    try {
      await fn(event, payload);
    } catch (err) {
      console.error("[contracts] event listener failed", { event, contractId: payload?.contractId, error: err.message });
    }
  }
};

module.exports = { onContractEvent, emitContractEvent };
