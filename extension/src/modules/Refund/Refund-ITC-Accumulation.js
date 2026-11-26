// =============================================================================
// EXAMPLE COMPUTED MODULE  —  Refund: ITC Accumulation (2B vs 3B)
// -----------------------------------------------------------------------------
// This is a COMPUTED module: it is built entirely from data already available
// in other returns (GSTR-2B and GSTR-3B). The whole recipe — what data it needs,
// how to compute, and how to render the Excel — lives in THIS file. The generic
// engine (computed-engine.js) does the rest, so:
//   • adding it = dropping this one file + `npm run build`
//   • it is PORTABLE: copy this file to any extension copy that has the engine.
//
// NOTE: the `path:` values below (itc.net / itc4.net) are PLACEHOLDERS. Point
// them at the real fields in your 2B / 3B JSON, then verify the numbers once.
// =============================================================================
const module = {
  category: "refund",
  key: "REFUND_ITC_ACCUM",
  seq: 1,
  listed: true,
  order: 1,
  computed: true, // <-- routes this module through the generic compute engine

  config: {
    key: "REFUND_ITC_ACCUM",
    display: "Refund - ITC Accumulation (2B vs 3B)",
    fileNameCode: "REFUND_ITC_ACCUM",
    apiCode: "REFUND_ITC_ACCUM",
    summaryType: "REFUND_ITC_ACCUM",
  },

  // SCHEMA 1 — what data this module consumes (reuses existing return fetchers)
  needs: ["2B", "3B"],

  // SCHEMA 2 — how to compute the values
  compute: {
    // strict: fail loudly if a `path` below is missing (e.g. the source format
    // changed) instead of silently producing zeros. Recommended for anything
    // client-facing. Set to false only if you knowingly allow missing fields.
    strict: true,
    heads: ["igst", "cgst", "sgst", "cess"],
    rows: [
      { label: "ITC available (as per 2B)", from: "2B", path: "itc.net" },
      { label: "ITC utilised (as per 3B)",  from: "3B", path: "itc4.net" },
      { label: "Accumulated ITC (2B - 3B)", diff: ["2B", "3B"] }, // live Excel formula
    ],
  },

  // SCHEMA 3 — how to render the Excel
  render: {
    title: "Refund - ITC Accumulation (2B vs 3B)",
    sheetName: "ITC Accumulation",
    theme: "navy",
    labelHeader: "Particulars",
    numFmt: "#,##0;[Red](#,##0)",
  },
};
export default module;
