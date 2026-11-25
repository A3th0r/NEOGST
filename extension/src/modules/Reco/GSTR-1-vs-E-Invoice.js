// Invoice-wise and section-wise GSTR-1 vs E-Invoice reconciliation.
export default {
  category: "summary", key: "G1_VS_EINV", seq: 17, listed: true, order: 17,
  config: {
    key: "G1_VS_EINV", display: "GSTR-1 vs E-Invoice", summaryType: "G1_VS_EINV",
    base: "https://return.gst.gov.in/einvoice/auth/api/geteinvdata",
    fileNameCode: "GSTR1_VS_E_INVOICE", apiCode: "E_INVOICE", requiresPeriod: true,
    contentType: "application/json"
  }
};
