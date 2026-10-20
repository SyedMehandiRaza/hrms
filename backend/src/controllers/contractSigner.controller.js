const contractSignerService = require("../services/contractSigner.service");
const contractSignService = require("../services/contractSign.service");
const { sendPdf } = require("../services/contractFiles.service");

const requestFacts = (req) => ({ ip: req.ip, userAgent: req.get("user-agent") });

const listMine = async (req, res) => {
  res.json({ success: true, data: await contractSignerService.listMine(req.auth, req.query) });
};

const getMine = async (req, res) => {
  res.json({ success: true, data: await contractSignerService.getMine(req.auth, req.params.id, requestFacts(req)) });
};

const myDocument = async (req, res) => {
  const { bytes, fileName } = await contractSignerService.myDocument(req.auth, req.params.id);
  sendPdf(res, bytes, { fileName, inline: true });
};

const myPdf = async (req, res) => {
  const { bytes, fileName } = await contractSignerService.myPdf(req.auth, req.params.id);
  sendPdf(res, bytes, { fileName, inline: false });
};

const submitContract = async (req, res) => {
  res.json({ success: true, data: await contractSignService.submitContract(req.auth, req.params.id, req.body, requestFacts(req)) });
};

module.exports = { listMine, getMine, myDocument, myPdf, submitContract, requestFacts };
