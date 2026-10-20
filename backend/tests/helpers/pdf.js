const zlib = require("zlib");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");

// Test helpers: build PNGs of any size, and read rendered PDFs back with pdf.js.

// A valid RGB PNG of width×height. `noise` makes it incompressible (for size limits).
const makePng = (width, height, { noise = false } = {}) => {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let i = 1; i <= width * 3; i += 1) raw[row + i] = noise ? Math.floor(Math.random() * 256) : 40;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: noise ? 0 : 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

// A PNG whose file is close to `bytes` long (random pixels, no compression).
const pngOfSize = (bytes) => {
  const side = Math.ceil(Math.sqrt(bytes / 3));
  return makePng(side, side, { noise: true });
};

const dataUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;

const openPdf = (bytes) => pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, verbosity: 0 }).promise;

// Text items of a page: { str, x, y, width, height, fontSize } in PDF points.
const pageText = async (doc, pageNo) => {
  const page = await doc.getPage(pageNo);
  const { items } = await page.getTextContent();
  return items
    .filter((i) => i.str.trim())
    .map((i) => ({
      str: i.str,
      x: i.transform[4],
      y: i.transform[5],
      width: i.width,
      height: i.height,
      fontSize: Math.hypot(i.transform[0], i.transform[1]),
      dir: i.dir,
    }));
};

// Items whose baseline lies inside the box (points), sorted left to right, joined.
const textInBox = (items, box) =>
  items
    .filter((i) => i.x >= box.x - 0.5 && i.x <= box.x + box.width && i.y >= box.y - 0.5 && i.y <= box.y + box.height)
    .sort((a, b) => a.x - b.x);

const operatorNames = async (doc, pageNo) => {
  const page = await doc.getPage(pageNo);
  const ops = await page.getOperatorList();
  const names = Object.fromEntries(Object.entries(pdfjs.OPS).map(([k, v]) => [v, k]));
  return ops.fnArray.map((fn) => names[fn]);
};

// Unicode of every glyph in painting order (left to right along a line). Unlike pageText,
// pdf.js does not re-order these for right-to-left scripts.
const paintedGlyphs = async (doc, pageNo) => {
  const page = await doc.getPage(pageNo);
  const ops = await page.getOperatorList();
  const out = [];
  ops.fnArray.forEach((fn, i) => {
    if (fn !== pdfjs.OPS.showText) return;
    for (const g of ops.argsArray[i][0]) if (g && typeof g === "object" && g.unicode) out.push(g.unicode);
  });
  return out.join("");
};

module.exports = { makePng, pngOfSize, dataUrl, openPdf, pageText, textInBox, operatorNames, paintedGlyphs };
