const approvalService = require("../services/approval.service");

const inbox = async (req, res) => {
  res.json({ success: true, data: await approvalService.inbox(req.auth, req.lang) });
};

const approve = async (req, res) => {
  res.json({ success: true, data: await approvalService.decide(req.auth, req.params.requestId, { decision: "APPROVE", ...req.body }) });
};

const reject = async (req, res) => {
  res.json({ success: true, data: await approvalService.decide(req.auth, req.params.requestId, { decision: "REJECT", ...req.body }) });
};

module.exports = { inbox, approve, reject };
