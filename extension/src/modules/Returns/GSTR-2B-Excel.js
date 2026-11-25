// Module: GSTR-2B  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G2BEXL",
  seq: 5,   // original array position (preserves exact map key order)
  listed: false,           // shown as a selectable subcategory?
  order: null,
  orderComposition: null, // Returns: reorder for composition taxpayers
  config: {
    "fileType": "EX",
    "fileTypeCode": "EXL",
    "key": "G2BEXL",
    "display": "GSTR-2B",
    "apiCode": "GSTR2B",
    "fileNameCode": "R2B",
    "expFilingStatus": "NF",
    "needsFileGeneration": false,
    "domain": "https://gstr2b.gst.gov.in/gstr2b",
    "generateBase": "https://return.gst.gov.in/returns/auth/api/offline/download/generate",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/offline/download/url"
  },
};
export default module;
