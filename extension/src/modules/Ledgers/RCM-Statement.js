// Module: RCM Liability / ITC statement  (category: Ledgers)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "ledger",
  key: "RCM_LED",
  seq: 2,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 2,
  config: {
    "key": "RCM_LED",
    "display": "RCM Liability / ITC statement",
    "base": "https://return.gst.gov.in/returns/auth/internalapi/getRcmDetls",
    "generateBase": "https://return.gst.gov.in/returns/auth/internalapi/getRcmDetls",
    "downloadBase": "https://return.gst.gov.in/returns/auth/internalapi/url",
    "fromParam": "fdate",
    "toParam": "tdate",
    "format": "DD/MM/YYYY",
    "fileNameCode": "RCMLED",
    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
};
export default module;
