// Module: GSTR-2A  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G2A",
  seq: 2,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 2,
  orderComposition: 4, // Returns: reorder for composition taxpayers
  config: {
    "key": "G2A",
    "display": "GSTR-2A",
    "apiCode": "GSTR2A",
    "fileNameCode": "R2A",
    "expFilingStatus": "NF",
    "needsFileGeneration": true,
    "generateBase": "https://return.gst.gov.in/returns/auth/api/offline/download/generate",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/offline/download/url"
  },
};
export default module;
