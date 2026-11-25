// Module: E-Credit reversal & reclaim  (category: Ledgers)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "ledger",
  key: "REV_RCLM",
  seq: 1,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 1,
  config: {
    "key": "REV_RCLM",
    "display": "E-Credit reversal & reclaim",
    "base": "https://return.gst.gov.in/returns/auth/internalapi/getRevRclmDetls",
    "generateBase": "https://return.gst.gov.in/returns/auth/internalapi/getRevRclmDetls",
    "downloadBase": "https://return.gst.gov.in/returns/auth/internalapi/url",
    "fromParam": "fdate",
    "toParam": "tdate",
    "format": "DD/MM/YYYY",
    "fileNameCode": "REVRCLM",
    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
};
export default module;
