// Module: GSTR-2A (Other)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "reports",
  key: "G2AOTHER",
  seq: 3,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 2,
  config: {
    "key": "G2AOTHER",
    "display": "GSTR-2A (Other)",
    "fileNameCode": "R2AOTHER",
    "apiCode": "GSTR2A_OTHER",
    "summaryType": "GSTR2A_OTHER"
  },
};
export default module;
