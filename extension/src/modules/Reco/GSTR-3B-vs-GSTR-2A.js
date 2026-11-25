// Module: GSTR-3B vs GSTR-2A (summ)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "summary",
  key: "G3B_VS_G2ASUM",
  seq: 5,   // original array position (preserves exact map key order)
  recoKinds: ["3B","2A"],   // returns this reco needs (was hardcoded in recoKindsForSummaryCfg)
  listed: true,           // shown as a selectable subcategory?
  order: 5,
  config: {
    "key": "G3B_VS_G2ASUM",
    "display": "GSTR-3B vs GSTR-2A (summ)",
    "fileNameCode": "R3B_R2ASUM",
    "apiCode": "GSTR3B_GSTR2ASUM",
    "summaryType": "GSTR3B_VS_GSTR2A",
    "compare": "GSTR2A"
  },
};
export default module;
