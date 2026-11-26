// Module: Refund of Export Services (Exports w/o Payment of Tax)  (category: Refund)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
// Output workbook includes Refund Computation, Refund Combinations (period grouping optimizer),
// GSTR-3B summary, Eligible ITC, Turnover Reco, ITC Reco (3B vs 2B), Correlation Statement,
// New Annexure-B, and Electronic Credit Ledger.
const module = {
  category: "refund",
  key: "REFUND_EXPWOP",
  seq: 0,   // original array position (preserves exact map key order)
  recoKinds: ["3B","2B","1SUM","1"],   // returns this reco needs (was hardcoded in recoKindsForSummaryCfg)
  listed: true,           // shown as a selectable subcategory?
  order: 0,
  config: {
    "key": "REFUND_EXPWOP",
    "display": "Refund of Export Services (Exports w/o Payment of Tax)",
    "fileNameCode": "REFUND_EXPWOP",
    "apiCode": "REFUND_EXPWOP",
    "summaryType": "REFUND_EXPWOP"
  },
};
export default module;
