// Module: ITC ledger (Excel)  (category: Ledgers)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "ledger",
  key: "ITC_LED",
  seq: 0,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 0,
  config: {
    "key": "ITC_LED",
    "display": "ITC ledger (Excel)",
    "base": "https://return.gst.gov.in/returns/auth/api/itcdtls",
    "generateBase": "https://return.gst.gov.in/returns/auth/api/itcdtls",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/url",
    "fromParam": "fdate",
    "toParam": "tdate",
    "format": "DD/MM/YYYY",
    "fileNameCode": "ITCLED",
    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
};
export default module;
