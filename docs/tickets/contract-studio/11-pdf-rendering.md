# 11: PDF rendering service

**What to build:** Stamping values and signatures onto the PDF, the "Not final" preview, the certificate page and
Arabic text (plan decisions 38–40, ADR 0009).

**Blocked by:** 01 Contract schema changes

**Status:** ready-for-agent

- [ ] When a contract with every field type is rendered → each value, checkbox mark, date, initials and signature
      image appears at its page position and inside its box.
- [ ] When a value is too long for its box → the text shrinks to fit (down to 6 pt) and never spills outside.
- [ ] When a value is Arabic (e.g. an Arabic full name) → it is drawn joined and right-to-left, checked through
      extracted text and glyph order; mixed Arabic and Latin values also render correctly.
- [ ] When a preview is requested → every page carries a diagonal "Not final" watermark and there's no
      certificate page.
- [ ] When a final PDF is requested → form content is flattened and a "Certificate of completion" page is appended
      with the number, type, template PDF hash, signer evidence, approver, and times in UTC and company time.
- [ ] When a final PDF is produced → its SHA-256 is returned for storage.
- [ ] When the source PDF is missing or broken → a clear failure is reported to the caller (no partial file is stored).
- [ ] When the source PDF or a signature image doesn't match its stored SHA-256 → rendering fails with an integrity
      error (logged) and nothing is produced.
- [ ] When the original PDF already has form fields → they are flattened in the final PDF.
