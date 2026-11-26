// Module: GSTR-3B  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G3B",
  seq: 0,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 0,
  orderComposition: 2, // Returns: reorder for composition taxpayers
  config: {
    "key": "G3B",
    "display": "GSTR-3B",
    "apiCode": "GSTR3B",
    "fileNameCode": "R3B",
    "expFilingStatus": "FIL",
    "needsFileGeneration": false,
    "generateBase": "https://return.gst.gov.in/returns/auth/api/offline/download/generate",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/offline/download/url"
  },
};
export default module;
