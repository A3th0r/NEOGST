// Module: GSTR-1 (summ)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "reports",
  key: "G1SUM",
  seq: 0,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 0,
  config: {
    "key": "G1SUM",
    "display": "GSTR-1 (summ)",
    "fileNameCode": "R1SUM",
    "apiCode": "GSTR1SUM",
    "summaryType": "GSTR1"
  },
};
export default module;
