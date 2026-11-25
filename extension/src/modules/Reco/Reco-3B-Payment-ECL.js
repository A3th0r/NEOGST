// Module: GSTR-3B Payment / ECL (Reco)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "summary",
  key: "G3B_ECL",
  seq: 9,   // original array position (preserves exact map key order)
  recoKinds: ["3B"],   // returns this reco needs (was hardcoded in recoKindsForSummaryCfg)
  listed: true,           // shown as a selectable subcategory?
  order: 9,
  config: {
    "key": "G3B_ECL",
    "display": "GSTR-3B Payment / ECL (Reco)",
    "fileNameCode": "R3B_ECL_RECO",
    "apiCode": "GSTR3B_ECL_RECO",
    "summaryType": "GSTR3B_VS_ECL"
  },
};
export default module;
