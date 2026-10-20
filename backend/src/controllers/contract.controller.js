const contractService = require("../services/contract.service");
const contractSendService = require("../services/contractSend.service");

// POST /contracts: drafts, or drafts sent one by one in SEND mode (decision 25).
const createContracts = async (req, res) => {
  const data = await contractService.createContracts(req.auth, req.body, {
    sendOne: contractSendService.sendRow(req.lang),
    beforeSend: contractSendService.assertOpenYear,
    lang: req.lang,
  });
  res.status(201).json({ success: true, data });
};

const editDraft = async (req, res) => {
  res.json({ success: true, data: await contractService.editDraft(req.auth, req.params.id, req.body) });
};

const deleteDraft = async (req, res) => {
  res.json({ success: true, data: await contractService.deleteDraft(req.auth, req.params.id) });
};

const sendDraft = async (req, res) => {
  res.json({ success: true, data: await contractSendService.sendDraft(req.auth, req.params.id) });
};

module.exports = { createContracts, editDraft, deleteDraft, sendDraft };
