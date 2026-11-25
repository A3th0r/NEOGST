// Module: Electronic liability register (returns)  (category: Ledgers)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "ledger",
  key: "LIAB_RET",
  seq: 3,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 3,
  config: {
    "key": "LIAB_RET",
    "display": "Electronic liability register (returns)",
    "base": "https://return.gst.gov.in/returns/auth/api/retdtl",
    "generateBase": "https://return.gst.gov.in/returns/auth/api/retdtl",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/url",
    "fromParam": "fdate",
    "toParam": "to_dt",
    "format": "MMYYYY",
    "fileNameCode": "LIABRET",
    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "needsGstinParam": true
  },
};
export default module;
