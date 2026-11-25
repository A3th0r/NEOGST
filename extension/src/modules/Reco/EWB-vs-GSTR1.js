// E-way bill details: uses the existing authenticated GST request transport.
// EWB outward-supply sections; HSN is a duplicate summary, not extra turnover.
const module = {
  category: "summary",
  key: "G1_VS_EWB",
  seq: 16,
  listed: true,
  order: 16,
  config: {
    key: "G1_VS_EWB",
    display: "GSTR-1 vs E-Way Bill",
    summaryType: "G1_VS_EWB",
    base: "https://return.gst.gov.in/returns/auth/api/ewbdetl",
    fileNameCode: "GSTR1_VS_EWAY_BILL",
    apiCode: "EWAY_BILL",
    requiresPeriod: true,
    sections: ["B2B", "B2CL", "B2CS", "EXP"],
    contentType: "application/json"
  }
};
export default module;
