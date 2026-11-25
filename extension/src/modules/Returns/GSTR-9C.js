// Module: GSTR-9C  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G9C",
  seq: 9,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 5,
  orderComposition: 7, // Returns: reorder for composition taxpayers
  config: {
    "isAnnual": true,
    "key": "G9C",
    "display": "GSTR-9C",
    "apiCode": "GSTR9C",
    "fileNameCode": "R9C",
    "expFilingStatus": "FIL",
    "needsFileGeneration": true,
    "flag": "0",
    "generateBase": "https://return.gst.gov.in/returns/auth/api/offline/download/generate",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/offline/download/url"
  },
};
export default module;
