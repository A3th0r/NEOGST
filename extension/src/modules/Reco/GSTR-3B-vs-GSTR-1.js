// Module: GSTR-3B vs GSTR-1 (summ)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "summary",
  key: "G3B_VS_G1SUM",
  seq: 4,   // original array position (preserves exact map key order)
  recoKinds: ["3B","1SUM","1"],   // returns this reco needs (was hardcoded in recoKindsForSummaryCfg)
  listed: true,           // shown as a selectable subcategory?
  order: 4,
  config: {
    "key": "G3B_VS_G1SUM",
    "display": "GSTR-3B vs GSTR-1 (summ)",
    "fileNameCode": "R3B_R1SUM",
    "apiCode": "GSTR3B_GSTR1SUM",
    "summaryType": "GSTR3B_VS_GSTR1",
    "compare": "GSTR1"
  },
};
export default module;
