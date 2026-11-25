// Module: GSTR-9C  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G9CEX",
  seq: 10,   // original array position (preserves exact map key order)
  listed: false,           // shown as a selectable subcategory?
  order: null,
  orderComposition: null, // Returns: reorder for composition taxpayers
  config: {
    "fileType": "EX",
    "fileTypeCode": "EXL",
    "isAnnual": true,
    "key": "G9CEX",
    "display": "GSTR-9C",
    "apiCode": "GSTR9C",
    "fileNameCode": "R9C",
    "expFilingStatus": "FIL",
    "needsFileGeneration": true,
    "flag": "1",
    "generateBase": "https://return.gst.gov.in/returns/auth/api/offline/download/generate",
    "downloadBase": "https://return.gst.gov.in/returns/auth/api/offline/download/url"
  },
};
export default module;
