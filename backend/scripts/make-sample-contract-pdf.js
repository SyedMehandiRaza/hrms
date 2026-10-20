// Generates seed-assets/contracts/sample-contract.pdf: a plain 3-page contract with no
// scripts or form fields, used by the contract seeder and the tests (plan section 5).
// Run once: node scripts/make-sample-contract-pdf.js
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const PAGES = [
  ["Employment Agreement", ["This agreement is made between the Employer and the Employee named below.", "Employee name: ____________________", "Designation: ____________________"]],
  ["Terms", ["1. The Employee agrees to perform the duties of the role in good faith.", "2. Working hours follow the company policy.", "3. Either party may end this agreement with the agreed notice."]],
  ["Signatures", ["Signed by the Employee:", "", "Signature: ____________________", "Date: ____________________"]],
];

const main = async () => {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Sample contract");
  pdf.setProducer("hrms seed");
  pdf.setCreator("hrms seed");
  const fixed = new Date(Date.UTC(2026, 0, 1));
  pdf.setCreationDate(fixed);
  pdf.setModificationDate(fixed);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  PAGES.forEach(([title, lines], i) => {
    const page = pdf.addPage([595.28, 841.89]); // A4
    page.drawText(title, { x: 60, y: 760, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
    lines.forEach((line, j) => page.drawText(line, { x: 60, y: 710 - j * 28, size: 12, font }));
    page.drawText(`Page ${i + 1} of ${PAGES.length}`, { x: 60, y: 40, size: 9, font });
  });
  // Uncompressed objects keep the file simple to inspect.
  const bytes = await pdf.save({ useObjectStreams: false });
  const out = path.resolve(__dirname, "../seed-assets/contracts/sample-contract.pdf");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bytes);
  console.log(`wrote ${out} (${bytes.length} bytes)`);
};

main();
