// Module: GSTR-2A  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G2AEXL",
  seq: 3,   // original array position (preserves exact map key order)
  listed: false,           // shown as a selectable subcategory?
  order: null,
  orderComposition: null, // Returns: reorder for composition taxpayers
  config: {
    "fileType": "EX",
    "fileTypeCode": "EXL",
    "key": "G2AEXL",
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
