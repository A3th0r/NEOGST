// Module: IMS Outward supplies (R1)  (category: Other)
// Self-contained descriptor. The shared engine in src/core consumes `config`
// generically via session.return, so adding/removing this file needs no other edits.
const module = {
  category: "other",
  key: "IMS_OUT",
  seq: 2,   // original array position (preserves exact map key order)
  listed: true,           // shown as a selectable subcategory?
  order: 2,
  config: {
    "key": "IMS_OUT",
    "display": "IMS Outward supplies (R1)",
    "base": "https://return.gst.gov.in/imsweb/auth/api/ims/generateOutwardsDoc?flag=0",
    "generateBase": "https://return.gst.gov.in/imsweb/auth/api/ims/generateOutwardsDoc?flag=1",
    "requiresPeriod": true,
    "fileNameCode": "IMSOUT",
    "contentType": "application/json"
  },
};
export default module;
