const app = require("./app");
const { startJobs } = require("./jobs");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`HRMS API listening on http://localhost:${PORT}`);
  if (startJobs()) console.log("Background jobs scheduled");
});
