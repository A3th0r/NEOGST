// E-Invoice details from the authenticated GST Portal session.
export default {
  category: "other", key: "E_INVOICE", seq: 6, listed: true, order: 6,
  config: {
    key: "E_INVOICE", display: "E-Invoice", summaryType: "E_INVOICE",
    base: "https://return.gst.gov.in/einvoice/auth/api/geteinvdata",
    fileNameCode: "E_INVOICE", apiCode: "E_INVOICE", requiresPeriod: true,
    contentType: "application/json"
  }
};
