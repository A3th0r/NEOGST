// Module: GSTR-3B vs GSTR-2B (Reco)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "summary",
  key: "G3B_VS_G2BSUM",
  seq: 6,   // original array position (preserves exact map key order)
  recoKinds: ["3B","2B"],   // returns this reco needs (was hardcoded in recoKindsForSummaryCfg)
  listed: true,           // shown as a selectable subcategory?
  order: 6,
  config: {
    "key": "G3B_VS_G2BSUM",
    "display": "GSTR-3B vs GSTR-2B (Reco)",
    "fileNameCode": "R3B_R2B_RECO",
    "apiCode": "GSTR3B_GSTR2B_RECO",
    "summaryType": "GSTR3B_VS_GSTR2B",
    "compare": "GSTR2B"
  },
};
export default module;
