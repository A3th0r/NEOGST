// Module: GSTR-1A  (category: Returns)
// Amendment return to GSTR-1 (Rule 59(4A), notified w.e.f. Aug-2024 tax period).
// The filed JSON mirrors the GSTR-1 schema (b2b / b2cl / b2cs / cdnr / cdnur /
// exp / at / txpd / nil / hsn / doc_issue), so this descriptor deliberately
// reuses the entire proven GSTR-1 pipeline: popup.js treats GSTR1 and GSTR1A as
// one family (see isGstr1Return), which gives 1A the same portal-format sheets,
// section consolidation and streaming XLSX writer for free.
//
// order 1.5 / orderComposition 3.5 park it immediately after GSTR-1 in the
// picker without renumbering every sibling (the registry sorts numerically).
const module = {
  category: "returns",
  key: "G1A",
  seq: 11,   // appended after the existing modules (last seq was 10)
  listed: true,           // shown as a selectable subcategory?
  order: 1.5,
  orderComposition: 3.5, // Returns: reorder for composition taxpayers
  config: {
    "key": "G1A",
    "display": "GSTR-1A",
    "apiCode": "GSTR1A",
    "fileNameCode": "R1A",
    "expFilingStatus": "FIL",
    "needsFileGeneration": true,
    // No e-invoice layering: GSTR-1A is an amendment return and has no
    // separate e-invoice download on the portal.
    "useEinvoice": false
  },
};
export default module;
