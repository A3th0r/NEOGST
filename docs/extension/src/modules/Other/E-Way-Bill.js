export default {
  category: "other", key: "EWAY_BILL", seq: 5, listed: true, order: 5,
  config: {
    key: "EWAY_BILL", display: "E-Way Bill", summaryType: "EWAY_BILL",
    base: "https://return.gst.gov.in/returns/auth/api/ewbdetl",
    fileNameCode: "EWAY_BILL", apiCode: "EWAY_BILL", requiresPeriod: true,
    sections: ["B2B", "B2CL", "B2CS", "EXP"], contentType: "application/json"
  }
};
