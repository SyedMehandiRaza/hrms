// Development driver: prints the email. Never throws, so a failed print can't break a request.
const deliver = async (mail) => {
  try {
    const lines = ["----- mail -----", `From: ${mail.from}`, `To: ${mail.to}`, `Subject: ${mail.subject}`, "", mail.text];
    console.log([...lines, "----------------"].join("\n"));
  } catch (err) {
    try {
      console.error("[mailer] console driver failed to print:", err.message);
    } catch {
      // nothing left to report to
    }
  }
};

module.exports = { deliver };
