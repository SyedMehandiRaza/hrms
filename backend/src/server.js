const app = require("./app");
const { assertContractRootPrivate } = require("./services/storage.service");

const PORT = process.env.PORT || 5000;

// Contract files must never be reachable through the public /uploads route (plan decision 8).
try {
  assertContractRootPrivate();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`HRMS API listening on http://localhost:${PORT}`);
});

// Hourly contract expiry / reminder / inactive-recipient job (plan decision 36).
require("./jobs/contractJob").startContractJob();
