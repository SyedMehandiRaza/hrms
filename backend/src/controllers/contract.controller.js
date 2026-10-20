const contractService = require("../services/contract.service");
const contractSendService = require("../services/contractSend.service");
const contractQueryService = require("../services/contractQuery.service");
const contractApprovalService = require("../services/contractApproval.service");
const { sendPdf } = require("../services/contractFiles.service");

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

const listContracts = async (req, res) => {
  res.json({ success: true, data: await contractQueryService.listContracts(req.auth, req.query) });
};

const contractStats = async (req, res) => {
  res.json({ success: true, data: await contractQueryService.contractStats(req.auth) });
};

const getContract = async (req, res) => {
  res.json({ success: true, data: await contractQueryService.getContract(req.auth, req.params.id) });
};

const contractPdf = async (req, res) => {
  const { bytes, fileName } = await contractQueryService.hrContractPdf(req.auth, req.params.id);
  sendPdf(res, bytes, { fileName, inline: false });
};

const approveContract = async (req, res) => {
  res.json({ success: true, data: await contractApprovalService.approveContract(req.auth, req.params.id) });
};

const revokeContract = async (req, res) => {
  res.json({ success: true, data: await contractApprovalService.revokeContract(req.auth, req.params.id, req.body) });
};

module.exports = {
  createContracts,
  editDraft,
  deleteDraft,
  sendDraft,
  listContracts,
  contractStats,
  getContract,
  contractPdf,
  approveContract,
  revokeContract,
};
