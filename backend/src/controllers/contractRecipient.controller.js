const contractRecipientService = require("../services/contractRecipient.service");

const lookupRecipients = async (req, res) => {
  res.json({ success: true, data: await contractRecipientService.lookupRecipients(req.auth, req.query) });
};

module.exports = { lookupRecipients };
