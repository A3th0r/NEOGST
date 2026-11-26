// Module: GSTR-2A (summ)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "reports",
  key: "G2ASUM",
  seq: 1,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 1,
  config: {
    "key": "G2ASUM",
    "display": "GSTR-2A (summ)",
    "fileNameCode": "R2ASUM",
    "apiCode": "GSTR2ASUM",
    "summaryType": "GSTR2A",
    "blank": true
  },
};
export default module;
