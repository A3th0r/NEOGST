// Module: GSTR-9  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G9",
  seq: 8,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 4,
  orderComposition: 6, // Returns: reorder for composition taxpayers
  config: {
    "isAnnual": true,
    "key": "G9",
    "display": "GSTR-9",
    "apiCode": "GSTR9",
    "fileNameCode": "R9",
    "expFilingStatus": "FIL",
    "needsFileGeneration": false,
    "generateBase": "https://return.gst.gov.in/returns/auth/api/offline/download/generate",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/offline/download/url"
  },
};
export default module;
