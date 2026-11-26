// =============================================================================
// computed-engine.js  —  ONE generic builder for all "computed" modules.
// -----------------------------------------------------------------------------
// Loaded as a classic script (like popup.js). Exposes window.NEOGST_COMPUTED
// with two entry points the popup calls:
//
//   NEOGST_COMPUTED.isComputed(moduleDescriptor)  -> bool
//   NEOGST_COMPUTED.build({ descriptor, sources, meta, XLSX }) -> { blob, fileName }
//
// It reads the module's three schemas (needs / compute / render) and produces a
// styled xlsx workbook — no per-module engine code. Because the whole recipe
// lives in the module file, the file is portable across extension copies that
// include this engine.
//
// `sources` is { CODE: payload } already fetched by the popup using `needs`.
// `meta` carries { gstin, periodLabel }.
// =============================================================================
;(function (root) {
  "use strict";

  // ── tiny helpers ───────────────────────────────────────────────────────────
  function getPath(obj, path) {
    if (obj == null || !path) return undefined;
    // supports a.b.c and a[0].b
    const parts = String(path).replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  const HEAD_DEFAULT = ["igst", "cgst", "sgst", "cess"];

  // Resolve a row's raw values into a { head: number } map.
  // When `strict` is true, a path that resolves to nothing throws instead of
  // silently becoming 0 — this catches source-format changes loudly.
  function valuesForRow(row, sources, heads, strict) {
    const out = {};
    if (row.from && row.path) {
      if (strict && !(row.from in sources)) {
        throw new Error(`Missing source "${row.from}" for row "${row.label}"`);
      }
      const node = getPath(sources[row.from], row.path);
      if (strict && node === undefined) {
        throw new Error(
          `Path "${row.path}" not found in source "${row.from}" (row "${row.label}"). ` +
          `The source format may have changed — update the path in the module file.`
        );
      }
      if (node && typeof node === "object") {
        heads.forEach((h) => {
          if (strict && node[h] === undefined) {
            throw new Error(`Field "${h}" missing at "${row.path}" in source "${row.from}" (row "${row.label}")`);
          }
          out[h] = Number(node[h]) || 0;
        });
      } else {
        const n = Number(node) || 0;
        heads.forEach((h) => (out[h] = n)); // scalar -> applied to all heads
      }
    } else {
      heads.forEach((h) => (out[h] = 0)); // diff/expr rows: filled by formulas
    }
    return out;
  }

  // Theme presets (kept minimal; matches the navy look used elsewhere).
  function theme(name) {
    const NAVY = "1F3864", LBLUE = "D9E2F3", WHITE = "FFFFFF", GREY = "F2F2F2";
    const bd = { style: "thin", color: { rgb: "8EA9DB" } };
    const border = { top: bd, bottom: bd, left: bd, right: bd };
    return {
      title: { font: { bold: true, sz: 14, color: { rgb: WHITE } }, fill: { patternType: "solid", fgColor: { rgb: NAVY } }, alignment: { horizontal: "center", vertical: "center" } },
      head: { font: { bold: true, sz: 10, color: { rgb: NAVY } }, fill: { patternType: "solid", fgColor: { rgb: LBLUE } }, alignment: { horizontal: "center" }, border },
      label: { font: { sz: 10 }, border },
      num: { font: { sz: 10 }, alignment: { horizontal: "right" }, numFmt: "#,##0;[Red](#,##0)", border },
      band: { fill: { patternType: "solid", fgColor: { rgb: GREY } } },
      border,
    };
  }

  function isComputed(desc) {
    return !!(desc && desc.computed && desc.compute && Array.isArray(desc.compute.rows));
  }

  // ── the generic build ───────────────────────────────────────────────────────
  function build(args) {
    const XLSX = args.XLSX;
    const desc = args.descriptor;
    const sources = args.sources || {};
    const meta = args.meta || {};
    const heads = (desc.compute.heads && desc.compute.heads.length) ? desc.compute.heads : HEAD_DEFAULT;
    const render = desc.render || {};
    const th = theme(render.theme || "navy");
    const numFmt = render.numFmt || th.num.numFmt;

    // 1) resolve each row's base values
    const strict = !!desc.compute.strict;
    const rows = desc.compute.rows.map((r) => ({ def: r, vals: valuesForRow(r, sources, heads, strict) }));
    const labelToIndex = {};
    rows.forEach((r, i) => (labelToIndex[r.def.label] = i));

    // 2) build the sheet as array-of-arrays + record where formulas go
    const aoa = [];
    const merges = [];
    const styleCells = []; // { r, c, style }
    const formulaCells = []; // { r, c, f }

    const labelHeader = render.labelHeader || "Particulars";
    const totalCols = 1 + heads.length;

    // title
    aoa.push([render.title || desc.config.display || desc.key]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
    styleCells.push({ r: 0, c: 0, style: th.title });
    aoa.push([`GSTIN: ${meta.gstin || "-"}   Period: ${meta.periodLabel || "-"}`]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });
    aoa.push([]);

    // header row
    const headerRowIdx = aoa.length;
    aoa.push([labelHeader].concat(heads.map((h) => h.toUpperCase())));
    for (let c = 0; c < totalCols; c++) styleCells.push({ r: headerRowIdx, c, style: th.head });

    // data rows
    const rowExcelIndex = {}; // row label -> excel row number (1-indexed)
    rows.forEach((r, ri) => {
      const aoaR = aoa.length;
      rowExcelIndex[r.def.label] = aoaR + 1;
      const line = [r.def.label];
      heads.forEach((h) => line.push(r.vals[h] != null ? r.vals[h] : 0));
      aoa.push(line);
      styleCells.push({ r: aoaR, c: 0, style: th.label });
      for (let c = 1; c < totalCols; c++) styleCells.push({ r: aoaR, c, style: th.num });
    });

    // 3) attach live formulas for diff / expr rows
    rows.forEach((r) => {
      const aoaR = rowExcelIndex[r.def.label] - 1;
      if (Array.isArray(r.def.diff) && r.def.diff.length === 2) {
        // diff over two *source rows*? No — diff is over two SOURCES compared by
        // their own rows. Here we support diff between two labeled rows if given
        // labels, else between two source-derived rows already present.
        const [aKey, bKey] = r.def.diff;
        // find the data rows that came from those sources
        const aRow = rows.find((x) => x.def.from === aKey);
        const bRow = rows.find((x) => x.def.from === bKey);
        heads.forEach((h, i) => {
          const c = 1 + i;
          const col = XLSX.utils.encode_col(c);
          if (aRow && bRow) {
            const ar = rowExcelIndex[aRow.def.label];
            const br = rowExcelIndex[bRow.def.label];
            const v = (Number(aRow.vals[h]) || 0) - (Number(bRow.vals[h]) || 0);
            formulaCells.push({ r: aoaR, c, f: `${col}${ar}-${col}${br}`, v });
          }
        });
      } else if (r.def.expr) {
        // expr uses row('Label') -> cell refs, per head column
        heads.forEach((h, i) => {
          const c = 1 + i;
          const col = XLSX.utils.encode_col(c);
          const f = String(r.def.expr).replace(/row\(\s*'([^']+)'\s*\)/g, (m, lbl) => {
            const rr = rowExcelIndex[lbl];
            return rr ? `${col}${rr}` : "0";
          });
          formulaCells.push({ r: aoaR, c, f });
        });
      }
    });

    // 4) emit worksheet
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // apply merges
    ws["!merges"] = merges;
    // apply formulas
    formulaCells.forEach((fc) => {
      const ref = XLSX.utils.encode_cell({ r: fc.r, c: fc.c });
      ws[ref] = { t: "n", f: fc.f, v: fc.v != null ? fc.v : 0 };
    });
    // apply styles + number format
    styleCells.forEach((sc) => {
      const ref = XLSX.utils.encode_cell({ r: sc.r, c: sc.c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = sc.style;
      if (sc.style && sc.style.numFmt) ws[ref].z = sc.style.numFmt;
    });
    // column widths
    ws["!cols"] = [{ wch: 42 }].concat(heads.map(() => ({ wch: 14 })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (render.sheetName || "Sheet1").slice(0, 31));

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const fileName = `${meta.gstin || "GSTIN"}_${desc.config.fileNameCode || desc.key}_${(meta.periodLabel || "").replace(/[^\w-]/g, "")}.xlsx`;
    return { blob, fileName };
  }

  root.NEOGST_COMPUTED = { isComputed: isComputed, build: build, __getPath: getPath };
})(typeof self !== "undefined" ? self : this);
