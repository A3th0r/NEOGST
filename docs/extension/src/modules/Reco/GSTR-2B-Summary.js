// Module: GSTR-2B (summ)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "reports",
  key: "G2BSUM",
  seq: 2,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 3,
  config: {
    "key": "G2BSUM",
    "display": "GSTR-2B (summ)",
    "fileNameCode": "R2BSUM",
    "apiCode": "GSTR2BSUM",
    "summaryType": "GSTR2B",
    "blank": true
  },
};
export default module;
