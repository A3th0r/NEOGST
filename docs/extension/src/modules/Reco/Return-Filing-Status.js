// Module: Return Filing Status Grid (FY)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "reports",
  key: "RET_STATUS",
  seq: 13,   // original array position (preserves exact map key order)
  listed: false,           // shown as a selectable subcategory?
  order: null,
  config: {
    "key": "RET_STATUS",
    "display": "Return Filing Status Grid (FY)",
    "fileNameCode": "RET_STATUS",
    "apiCode": "RETURN_STATUS_FY",
    "summaryType": "RETURN_STATUS",
    "fyWide": true
  },
};
export default module;
