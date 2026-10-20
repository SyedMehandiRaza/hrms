# 04: Contract documents API

**What to build:** Upload, list, rename, archive and delete PDF documents, and serve their files privately
(plan decisions 6–8).

**Blocked by:** 01 Contract schema changes, 02 Contract Studio messages

**Status:** ready-for-agent

- [ ] When HR uploads two valid PDFs in one request → both are saved with their name, real page count, size and
      SHA-256 of the file.
- [ ] When HR uploads 11 files in one request → 400 / "You can upload at most 10 files at a time." and none is saved.
- [ ] When HR uploads a PDF containing JavaScript, an auto-run or launch action, an embedded file or an XFA form →
      that file is refused with "Upload a PDF file up to 20 MB and 50 pages."
- [ ] When the stored file no longer matches its hash and HR downloads it → 500 / "Something went wrong. Please
      try again." and the integrity failure is logged.
- [ ] When HR uploads a DOCX, a non-PDF renamed to .pdf, a file over 20 MB, a PDF over 50 pages or an unreadable or
      encrypted PDF → that file is refused with "Upload a PDF file up to 20 MB and 50 pages.", and the valid files
      in the same request are still saved.
- [ ] When HR renames a document → the new name shows; with an empty name → "Document name is required"; with
      256 characters → "Document name cannot exceed 255 characters".
- [ ] When HR archives a document → it shows as archived and stays downloadable.
- [ ] When HR unarchives an archived document → it is SAVED again and can be picked for templates.
- [ ] When HR deletes a document used by a template or contract → 409 / "This document is used by a template or
      contract and can't be deleted. Archive it instead."
- [ ] When HR deletes an unused document → it is gone from the list.
- [ ] When HR downloads a document through the authenticated endpoint → they get the original bytes, shown inline,
      with no-store caching and nosniff.
- [ ] When anyone requests the file under `/uploads/` by its stored path, or the endpoint without logging in → it
      isn't served (404 / 401).
- [ ] When the private contract storage is configured inside the public upload folder → the server refuses to start.
- [ ] When HR requests another company's document → 404 / "The requested record was not found."
- [ ] When a sub-admin without the matching `contract` flag, the employee or the staffing company makes a call →
      403 / "You don't have permission to do this."
