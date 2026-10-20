# 9. Signed PDFs are built with pdf-lib plus Arabic shaping

Date: 2026-10-20 · Status: Accepted

## Context
Completed contracts need a locked PDF with values, signatures and a certificate page, and a stored hash. Values are
often Arabic. `pdf-lib` draws glyphs without joining or right-to-left ordering; headless Chrome would shape
correctly but adds a ~150 MB browser dependency to every server and CI.

## Decision
- Use `pdf-lib`, embed Noto Sans and Noto Naskh Arabic (OFL, bundled), and pass each value through an Arabic
  reshaper and the bidi algorithm before drawing; choose the font per script.
- Generate the final PDF once at COMPLETED, store it privately with its SHA-256; earlier downloads are on-the-fly
  previews watermarked "Not final".
- The certificate page is English only for now.

## Consequences
- New backend dependencies: `pdf-lib`, `@pdf-lib/fontkit`, a reshaper and a bidi library, `node-cron` (expiry job).
- Tests must stamp an Arabic value and check glyph order. `pdf-lib` can't extract text, so `pdfjs-dist` is added
  as a **dev** dependency for that check.
