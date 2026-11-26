// Module: FY Comparison — 1/1A vs 3B, 2A/2B vs 3B (Reco)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "summary",
  key: "CMP_FY",
  seq: 10,   // original array position (preserves exact map key order)
  listed: false,           // shown as a selectable subcategory?
  order: null,
  config: {
    "key": "CMP_FY",
    "display": "FY Comparison — 1/1A vs 3B, 2A/2B vs 3B (Reco)",
    "fileNameCode": "FY_CMP_RECO",
    "apiCode": "PORTAL_COMPARISON_FY",
    "summaryType": "PORTAL_COMPARISON",
    "fyWide": true
  },
};
export default module;
