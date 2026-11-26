# Refund Word template contract

## References

- `refund-covering-letter.docx` — SHA-256 `D5156090BE89007F05F6AF82FE8427E699893AEBD0DF3B2A8DAA82865EB9DEFC`.
- `refund-declaration-section-54.docx` — SHA-256 `122EE705DF0ECB4008A1045BFD901881AE0156CA480C64999D31BE2C98B9B601`.
- `refund-undertaking-section-16.docx` — SHA-256 `43819A5FCCC53EF56F0058FA927F51343B2C44341D4483D23B404E0ACFB389C6`.

All three references are one-section A4 portrait documents. The covering letter uses 0.80-inch left/right/top and 0.69-inch bottom margins; the declarations use 0.80-inch margins on all sides. The retained DOCX packages are the design authority.

## Editable slots

Runtime edits are limited to text nodes in `word/document.xml`:

- generation date;
- selected refund-period labels, including case variants;
- legal/trade name and GSTIN;
- principal-place-of-business address;
- Central-jurisdiction lines (zone, commissionerate, division and range);
- jurisdiction city/state/postcode when available;
- named signatory text, which must be blank in generated files;
- signing-place value, which must be blank.

`<<<Letterhead>>>`, paragraph/table geometry, styles, numbering, relationships, headers, footers and all other package parts are preserve-only.

## Fidelity gates

- Patch the retained package rather than rebuilding the document.
- Preserve the section count, page size, margins, tables, paragraph/run properties and all non-document XML parts byte-for-byte.
- Generated text may wrap naturally, but must not introduce new document structures.
- If a profile field is unavailable, leave its slot blank; do not invent a value.
