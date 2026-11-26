// Module: GSTR-1 vs IMS Outward (Reco)  (category: Reco & Summ)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "summary",
  key: "G1_VS_IMSOUT",
  seq: 8,   // original array position (preserves exact map key order)
  recoKinds: ["1"],   // returns this reco needs (was hardcoded in recoKindsForSummaryCfg)
  listed: true,           // shown as a selectable subcategory?
  order: 8,
  config: {
    "key": "G1_VS_IMSOUT",
    "display": "GSTR-1 vs IMS Outward (Reco)",
    "fileNameCode": "R1_IMSOUT_RECO",
    "apiCode": "GSTR1_IMSOUT_RECO",
    "summaryType": "GSTR1_VS_IMSOUT",
    "compare": "IMSOUT"
  },
};
export default module;
