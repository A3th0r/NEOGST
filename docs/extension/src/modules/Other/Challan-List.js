// Module: Challan list (payments)  (category: Other)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "other",
  key: "CHALLAN_LIST",
  seq: 0,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 0,
  config: {
    "key": "CHALLAN_LIST",
    "display": "Challan list (payments)",
    "base": "https://payment.gst.gov.in/payment/auth/challan/getlist",
    "needsGstinParam": true,
    "fileNameCode": "CHALLAN",
    "contentType": "application/json"
  },
};
export default module;
