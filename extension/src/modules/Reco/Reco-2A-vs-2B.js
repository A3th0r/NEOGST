// Module: GSTR-2A vs GSTR-2B (Reco)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "summary",
  key: "G2A_VS_G2BSUM",
  seq: 7,   // original array position (preserves exact map key order)
  recoKinds: ["2A","2B"],   // returns this reco needs (was hardcoded in recoKindsForSummaryCfg)
  listed: true,           // shown as a selectable subcategory?
  order: 7,
  config: {
    "key": "G2A_VS_G2BSUM",
    "display": "GSTR-2A vs GSTR-2B (Reco)",
    "fileNameCode": "R2A_R2B_RECO",
    "apiCode": "GSTR2A_GSTR2B_RECO",
    "summaryType": "GSTR2A_VS_GSTR2B",
    "compare": "GSTR2B"
  },
};
export default module;
