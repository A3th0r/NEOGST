// Module: GSTR-4A  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G4A",
  seq: 7,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 7,
  orderComposition: 1, // Returns: reorder for composition taxpayers
  config: {
    "isQuarterly": true,
    "key": "G4A",
    "display": "GSTR-4A",
    "apiCode": "GSTR4A",
    "fileNameCode": "R4A",
    "expFilingStatus": "NF",
    "needsFileGeneration": true,
    "generateBase": "https://return.gst.gov.in/returns/auth/api/offline/download/generate",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/offline/download/url"
  },
};
export default module;
