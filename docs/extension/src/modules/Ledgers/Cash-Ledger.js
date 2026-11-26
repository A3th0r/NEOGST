// Module: Cash ledger (payments)  (category: Ledgers)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "ledger",
  key: "CASH_LED",
  seq: 5,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 5,
  config: {
    "key": "CASH_LED",
    "display": "Cash ledger (payments)",
    "base": "https://payment.gst.gov.in/payment/auth/ledger/detailedledger",
    "generateBase": "https://payment.gst.gov.in/payment/auth/api/cashdetls",
    "downloadBase": "https://payment.gst.gov.in/payment/auth/api/url",
    "fromParam": "fdate",
    "toParam": "tdate",
    "format": "DD/MM/YYYY",
    "fileNameCode": "CASHLED",
    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
};
export default module;
