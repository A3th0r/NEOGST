// Module: IMS Inward supplies  (category: Other)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "other",
  key: "IMS_IN",
  seq: 1,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 1,
  config: {
    "key": "IMS_IN",
    "display": "IMS Inward supplies",
    "base": "https://return.gst.gov.in/imsweb/auth/api/ims/generateDoc?flag=0",
    "generateBase": "https://return.gst.gov.in/imsweb/auth/api/ims/generateDoc",
    "downloadBase": "https://return.gst.gov.in/imsweb/auth/api/ims/url",
    "needsFileUrl": true,
    "fileNameCode": "IMSIN",
    "contentType": "application/zip"
  },
};
export default module;
