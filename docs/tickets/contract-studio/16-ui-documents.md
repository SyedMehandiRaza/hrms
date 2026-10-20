# 16: Documents screen

**What to build:** `/admin/new-contracts/documents` uploads real PDFs and lists the library; the copy changes to
PDF only (plan decision 45).

**Blocked by:** 04 Contract documents API

**Status:** done

Verified by the ui-tester agent:

- [x] When HR opens the screen → the title reads "Drop PDF files to upload", the chips read "PDF · MULTIPLE · MAX
      20MB", and the file picker only offers .pdf.
- [x] When HR uploads two PDFs → "2 documents saved" → both cards show their real page count and size.
- [x] When HR drops a 25 MB PDF together with a valid one → "Upload a PDF file up to 20 MB and 50 pages." for the
      big one; the valid one is saved.
- [x] When HR drops 11 PDFs at once → "You can upload at most 10 files at a time." and none is saved.
- [x] When HR renames a document → the card shows the new name; with an empty name → "Document name is required".
- [x] When HR archives a document → the card shows it as archived.
- [x] When HR deletes a used document → "This document is used by a template or contract and can't be deleted.
      Archive it instead."; an unused one → "Document deleted" and it disappears.
- [x] When HR clicks "Make Template" → the builder opens with that document.
- [x] When a sub-admin without the matching flags opens the screen → upload, rename, archive and delete aren't shown.
- [x] When lint runs → it passes.
