// Module: GSTR-1  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G1",
  seq: 1,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 1,
  orderComposition: 3, // Returns: reorder for composition taxpayers
  config: {
    "key": "G1",
    "display": "GSTR-1",
    "apiCode": "GSTR1",
    "fileNameCode": "R1",
    "expFilingStatus": "FIL",
    "needsFileGeneration": true,
    "useEinvoice": true,
    "generateBase": "https://return.gst.gov.in/returns/auth/api/offline/download/generate",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/offline/download/url"
  },
};
export default module;
