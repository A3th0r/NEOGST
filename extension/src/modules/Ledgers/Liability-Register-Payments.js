// Module: Electronic liability register (other payments)  (category: Ledgers)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "ledger",
  key: "LIAB_PAY",
  seq: 4,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 4,
  config: {
    "key": "LIAB_PAY",
    "display": "Electronic liability register (other payments)",
    "base": "https://payment.gst.gov.in/payment/auth/api/liabdetails",
    "generateBase": "https://payment.gst.gov.in/payment/auth/api/liabdetails",
    "downloadBase": "https://payment.gst.gov.in/payment/auth/api/url",
    "fromParam": "fdate",
    "toParam": "tdate",
    "format": "YYYY-MM-DD",
    "fileNameCode": "LIABPAY",
    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
};
export default module;
