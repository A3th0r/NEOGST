// Module: Vendor Intelligence / ITC at risk (Reco)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "summary",
  key: "VENDOR_INTEL",
  seq: 11,   // original array position (preserves exact map key order)
  recoKinds: ["2A","2B"],   // returns this reco needs (was hardcoded in recoKindsForSummaryCfg)
  listed: false,           // shown as a selectable subcategory?
  order: null,
  config: {
    "key": "VENDOR_INTEL",
    "display": "Vendor Intelligence / ITC at risk (Reco)",
    "fileNameCode": "VENDOR_INTEL",
    "apiCode": "VENDOR_INTEL",
    "summaryType": "VENDOR_INTEL"
  },
};
export default module;
