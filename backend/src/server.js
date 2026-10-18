const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`HRMS API listening on http://localhost:${PORT}`);
});
