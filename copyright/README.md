# Copyright filing deposit — source/object code sample

Generated for Form XIV, Statement of Further Particulars (Rule 70(5)), from
`main` at commit `c7db7a8` (2026-08-25). Read-only export — no application
code was changed to produce this.

- **`Antara_Source_Code_Excerpt.pdf`** (22 pages) — the first 10 and last 10
  pages of the application's real source code (69 files, backend Python +
  frontend TypeScript/React), concatenated in a fixed, documented order
  (cover page lists the exact order). A divider page between the two
  10-page blocks states how many pages were omitted from the middle, per
  Copyright Office practice for a representative excerpt.
- **`Antara_Object_Code_Sample.pdf`** (13 pages) — real compiled/built
  output corresponding to the first two backend and first two frontend
  files in the excerpt above: CPython 3.14 compiled bytecode (`.pyc`, shown
  as a hex/ASCII dump since it's binary) for `main.py` and `engine.py`, and
  real minified production JavaScript bundles from an actual `next build`
  for `page.tsx` and `graph/page.tsx`. Each artifact's SHA-256 hash and
  size are included so it can be checked against the repository.
- **`pagination_manifest.json`** — the full file → page mapping for all 284
  pages of the underlying concatenation (not just the 20 included in the
  PDF), for reference if the Office asks for the full listing or a specific
  page range beyond the excerpt.

Both PDFs were rendered from real repository content — nothing in them was
hand-written for the filing.
