// Module: Books (Purchase Register) vs GSTR-2B (Reco)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "summary",
  key: "BOOKS_2B",
  seq: 12,   // original array position (preserves exact map key order)
  recoKinds: ["2B"],   // returns this reco needs (was hardcoded in recoKindsForSummaryCfg)
  listed: false,           // shown as a selectable subcategory?
  order: null,
  config: {
    "key": "BOOKS_2B",
    "display": "Books (Purchase Register) vs GSTR-2B (Reco)",
    "fileNameCode": "BOOKS_2B_RECO",
    "apiCode": "BOOKS_VS_GSTR2B",
    "summaryType": "BOOKS_VS_GSTR2B",
    "needsBooksFile": true
  },
};
export default module;
