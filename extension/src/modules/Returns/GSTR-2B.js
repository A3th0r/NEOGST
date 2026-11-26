// Module: GSTR-2B  (category: Returns)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "returns",
  key: "G2B",
  seq: 4,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 3,
  orderComposition: 5, // Returns: reorder for composition taxpayers
  config: {
    "key": "G2B",
    "display": "GSTR-2B",
    "apiCode": "GSTR2B",
    "fileNameCode": "R2B",
    "expFilingStatus": "NF",
    "needsFileGeneration": false,
    "domain": "https://gstr2b.gst.gov.in/gstr2b/returns",
    "generateBase": "https://gstr2b.gst.gov.in/gstr2b/auth/api/gstr2b/getjson",
    "downloadBase": "https://gstr2b.gst.gov.in/gstr2b/auth/api/gstr2b/url"
  },
};
export default module;
