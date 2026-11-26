// Module: GSTR-4  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G4",
  seq: 6,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 6,
  orderComposition: 0, // Returns: reorder for composition taxpayers
  config: {
    "isQuarterly": true,
    "key": "G4",
    "display": "GSTR-4",
    "apiCode": "GSTR4",
    "fileNameCode": "R4",
    "expFilingStatus": "FIL",
    "needsFileGeneration": true,
    "generateBase": "https://return.gst.gov.in/returns/auth/api/offline/download/generate",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/offline/download/url"
  },
};
export default module;
