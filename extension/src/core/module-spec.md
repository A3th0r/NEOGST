// =============================================================================
// src/core/module-spec.md  (reference — how a computed module is written)
// =============================================================================
//
// Every COMPUTED module has THREE schemas. The generic engine reads all three,
// so no per-module engine code is needed. The whole module lives in one file and
// is portable to any copy of the extension that has this generic engine.
//
//   1. needs   — WHAT DATA the module consumes
//   2. compute — HOW to combine that data into values
//   3. render  — HOW to turn those values into an Excel sheet
//
// -----------------------------------------------------------------------------
// SCHEMA 1: needs
// -----------------------------------------------------------------------------
// Either short codes for existing returns/ledgers:
//   needs: ["3B", "2B"]
// Or, when new portal data is required (Type B), a fetch spec:
//   needs: [
//     "3B",
//     { as: "MYDATA",
//       fetch: { url: "https://.../endpoint", from: "fdate", to: "tdate", format: "DD/MM/YYYY" },
//       pick: "data.records" }        // JSON path into the response
//   ]
// The engine warms/downloads each item and hands them to compute as
//   sources = { "3B": <payload>, "2B": <payload>, "MYDATA": <picked> }
//
// -----------------------------------------------------------------------------
// SCHEMA 2: compute
// -----------------------------------------------------------------------------
//   compute: {
//     heads: ["igst", "cgst", "sgst", "cess"],   // value columns
//     rows: [
//       { label: "ITC as per 2B", from: "2B", path: "itc.net" },
//       { label: "ITC claimed 3B", from: "3B", path: "itc4.net" },
//       { label: "Difference (3B - 2B)", diff: ["3B", "2B"] }, // live Excel formula
//       { label: "Ratio %", expr: "row('ITC claimed 3B') / row('ITC as per 2B') * 100" },
//     ],
//   }
// - path: dot/bracket path into that source's payload; may end in a heads-map
//   object { igst, cgst, sgst, cess } or a single number (applied to all heads).
// - diff: [A, B] emits a live Excel formula  =A_cell - B_cell  per head.
// - expr: a small arithmetic expression over other rows via row('label').
//
// -----------------------------------------------------------------------------
// SCHEMA 3: render
// -----------------------------------------------------------------------------
//   render: {
//     title: "GSTR-3B vs GSTR-2B (Reco)",
//     sheetName: "Reco 3B vs 2B",
//     theme: "navy",                 // preset styling (navy header, banded rows)
//     labelHeader: "Particulars",
//     showDifference: true,          // adds a Difference block if diff rows exist
//     numFmt: "#,##0;[Red](#,##0)",
//   }
//
// -----------------------------------------------------------------------------
// FULL EXAMPLE (a complete computed module file)
// -----------------------------------------------------------------------------
//   const module = {
//     category: "refund",
//     key: "REFUND_ITC_ACCUM",
//     listed: true,
//     order: 1,
//     computed: true,                // <-- tells the engine to use the generic builder
//     config: { key: "REFUND_ITC_ACCUM", display: "Refund - ITC Accumulation", ... },
//     needs: ["2B", "3B"],
//     compute: {
//       heads: ["igst", "cgst", "sgst", "cess"],
//       rows: [
//         { label: "ITC available (2B)", from: "2B", path: "itc.net" },
//         { label: "ITC utilised (3B)",  from: "3B", path: "itc4.net" },
//         { label: "Accumulated ITC",    diff: ["2B", "3B"] },
//       ],
//     },
//     render: { title: "Refund - ITC Accumulation", sheetName: "ITC Accum", theme: "navy", showDifference: false },
//   };
//   export default module;
// =============================================================================
