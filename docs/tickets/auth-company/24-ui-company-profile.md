# 24: Company Profile screen

**What to build:** Settings → Company Profile loads and saves the real company, uploads and removes the logo, and
the header updates after saving (D27–D29, D35, D39 copy changes).

**Blocked by:** 14 UI foundation, 10 Company profile and logo API

**Status:** done

Verified by the ui-tester agent:

- [x] Opening the tab shows the loading state, then the company's values; the industry dropdown lists the real
      industries; metadata shows the company ID and created date.
- [x] Owner edits all fields → Save → confirm "Save Company Profile" → "✓ Saved"; reloading shows the new values;
      the header shows the new name.
- [x] "Discard Changes" restores the last saved values.
- [x] Field errors under the inputs: "Company name is required", "Company name must be at least 2 characters"
      (replaces "Too short"), "Company name cannot exceed 100 characters", "Please select an industry",
      "Phone is required", "Enter a valid phone number (6–15 digits)", "Email is required", "Enter a valid email",
      "Address is required", "Address cannot exceed 500 characters". New strings exist in English and Arabic.
- [x] The logo hint reads "Upload a JPG or PNG (max 2MB)."
- [x] Uploading a PNG updates the preview and the header logo; Remove → confirm → placeholder shown.
- [x] A 3 MB image or a GIF → "Logo must be a JPG or PNG image up to 2 MB." and nothing changes.
- [x] The sub-admin sees the profile read-only (no Save, no logo buttons).
- [x] Load failure → error state with "Failed to load company profile" and Retry.
- [x] Lint passes.
