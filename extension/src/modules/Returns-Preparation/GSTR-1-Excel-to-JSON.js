// GSTR-1 Excel (Offline Tool Template V2.0) -> GST Portal JSON converter.
// Supports the consolidated layout where amendments sit in the same sheet as the original data (columns
// under "Amendment - original details"), as well as the older layout with separate b2ba / cdnra / ... sheets.
//
// Usage:
//   import { gstr1ExcelToJson } from "./GSTR-1-Excel-to-JSON.js";
//   const { json, text, fileName, warnings, errors } = gstr1ExcelToJson(fileOrBuffer);
//   // fileName = returns_<last day of period DDMMYYYY>_R1_<GSTIN>_offline.json  (the name the offline tool expects); gstr1DownloadJson(result) saves it
//
// The taxpayer GSTIN, return month / financial year and turnovers are read from a "Company Info"
// sheet in the workbook (Field | Value). You can still pass them:
//   gstr1ExcelToJson(file, { gstin: "29AAICA3918J1ZE", fp: "102026" })
// Explicit values win over the sheet.
//   opts.legacyHsnAs      "b2b" | "b2c" - only for old workbooks with a single "hsn" sheet
//   opts.hsnDescriptions  { "1001": "WHEAT AND MESLIN", ... } or (code) => text - HSN master descriptions
//   opts.fileDate         Date or "DDMMYYYY" for the file name (default: last day of the return period)
//   opts.version          override header version (default "GST3.2.2", the offline tool v2.2.3 value)
//   opts.duplicateMode    "sum" (default: repeated rows are added together, nothing is lost) | "last" (offline-tool style:
//                         the last repeated row replaces the earlier ones)
//                         What to do when B2CS / B2CSA rows repeat the same POS + rate + type.
//   opts.ostin            { "<supplier GSTIN>": "<original supplier GSTIN>" } - adds "ostin" to ecoma.b2ca entries when the
//                         optional "ostin" column of the ecoab2c sheet (last column) is blank
//
// Output rules (same as the portal / offline-tool JSON):
//   - Blank optional fields are LEFT OUT. The JSON never contains null, "" or NaN (a zero stays a zero).
//     A non-numeric value in an amount cell is reported as an error instead of becoming null.
//   - Text cells are cleaned: line breaks (Alt+Enter), tabs, non-breaking / zero-width spaces and repeated
//     spaces become one normal space, so no "\n" / "\r" / "\t" can leak into the JSON. GSTINs have all spaces removed.
//   - Amounts are JSON numbers rounded half-up to 2 decimals; rates are plain numbers (7.5, 18);
//     place of supply is a 2-digit string ("01"); original month is "MMYYYY".
//   - Dates are "dd-mm-yyyy". Accepted: Excel serial / date cell, dd-mm-yyyy, dd/mm/yyyy, dd.mm.yyyy,
//     dd-mm-yy, yyyy-mm-dd (optionally with time), dd-Mon-yyyy, "5 October 2026", "October 5, 2026".
//     Dates that do not exist on the calendar (31-02-2026) are rejected.
// This converter is loaded in the extension popup, where SheetJS is provided by
// xlsx.full.min.js.  Keeping it free of Node-only imports also lets the registry
// builder read this module without an npm dependency.
//
// Optional HSN descriptions can be supplied through opts.hsnDescriptions.
function hsnMasterFile() { return null; }
// Small built-in fallback (descriptions exactly as the offline tool fills them from its HSN master).
const BUILTIN_HSN = {
  "1001": "WHEAT AND MESLIN",
  "9983": "Other professional, technical and business services",
  "6403": "FOOTWEAR WITH OUTER SOLES OF RUBBER, PLASTICS, LEATHER OR COMPOSITION LEATHER AND UPPERS OF LEATHER",
};

// Round half away from zero to 2 decimals, working on the decimal text of the number so that
// values like 51318.495 give 51318.50 (as the portal does) instead of drifting on binary floats.
const r2 = (n) => {
  if (!Number.isFinite(n)) return n;
  const s = String(Math.abs(n));
  const a = s.includes("e")
    ? Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100
    : Math.round(Number(s + "e2")) / 100;
  return n < 0 ? -a : a;
};
// Cell text -> single-line clean text: line breaks / tabs / NBSP / zero-width chars -> one space, runs of spaces collapsed.
const clean = (v) => String(v).replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/[\s\u00A0]+/g, " ").trim();
const isBlank = (v) => v === undefined || v === null || clean(v) === "";
const str = (v) => (isBlank(v) ? "" : clean(v));
const gstinTxt = (v) => (isBlank(v) ? "" : String(v).replace(/[\s\u00A0\u200B-\u200D\u2060\uFEFF]+/g, "").toUpperCase());
const num = (v) => {
  if (isBlank(v)) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[,%\s]/g, ""));
  return Number.isNaN(n) ? NaN : n;
};

const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
const pad = (n) => String(n).padStart(2, "0");

// Calendar-checked "dd-mm-yyyy"; "" when day/month/year do not form a real date (GST started in 2017).
const mkDate = (d, m, y) => {
  d = Number(d); m = Number(m); y = Number(y);
  if (!(y >= 2017 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${pad(d)}-${pad(m)}-${y}` : "";
};
const serialDate = (n) => {
  if (!Number.isFinite(n) || n < 1 || n >= 2958466) return "";
  const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
  return mkDate(t.getUTCDate(), t.getUTCMonth() + 1, t.getUTCFullYear());
};
const monthNo = (w) => { const u = String(w).toUpperCase(); return u.length >= 3 ? MONTHS.findIndex((x) => x.startsWith(u)) + 1 : 0; };
const year4 = (y) => (String(y).length === 2 ? 2000 + Number(y) : Number(y));

function fmtDate(v) {
  if (isBlank(v)) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : mkDate(v.getUTCDate(), v.getUTCMonth() + 1, v.getUTCFullYear());
  if (typeof v === "number") return serialDate(v);
  let s = str(v);
  if (/^\d{5}(\.\d+)?$/.test(s)) return serialDate(Number(s)); // Excel serial stored as text
  s = s.replace(/[T\s]+\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2}|[AP]M)?$/i, ""); // drop trailing time
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return mkDate(m[1], m[2], year4(m[3]));
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return mkDate(m[3], m[2], m[1]);
  m = s.match(/^(\d{1,2})[-/ .]+([A-Za-z]{3,9})[-/ .,]+(\d{2}|\d{4})$/);
  if (m && monthNo(m[2])) return mkDate(m[1], monthNo(m[2]), year4(m[3]));
  m = s.match(/^([A-Za-z]{3,9})[-/ .]+(\d{1,2})(?:st|nd|rd|th)?[-/ .,]+(\d{4})$/);
  if (m && monthNo(m[1])) return mkDate(m[2], monthNo(m[1]), m[3]);
  return "";
}

const posCode = (v) => {
  const m = str(v).match(/^(\d{1,2})/);
  return m ? pad(+m[1]) : "";
};

// "Applicable % of Tax Rate": 65 / "65.00" -> 0.65 ; blank/"" -> undefined
const diffPct = (v) => {
  const n = num(v);
  return isBlank(v) || Number.isNaN(n) || n === 0 || n === 100 ? undefined : r2(n / 100);
};

// "2022-23" + "OCTOBER" -> "102022"
function origMonth(fy, mon) {
  const mi = MONTHS.indexOf(str(mon).toUpperCase());
  const m = str(fy).match(/^(\d{4})-(\d{2})$/);
  if (mi < 0 || !m) return "";
  const year = mi >= 3 ? +m[1] : +m[1] + 1;
  return `${pad(mi + 1)}${year}`;
}

const INV_TYPE = {
  "regular b2b": "R", regular: "R",
  "sez supplies with payment": "SEWP",
  "sez supplies without payment": "SEWOP",
  "deemed exp": "DE", "deemed export": "DE",
  "intra-state supplies attracting igst": "CBW",
};
const invTyp = (v) => INV_TYPE[str(v).toLowerCase()] || (isBlank(v) ? "R" : str(v));

const DOC_NATURE = [
  "Invoices for outward supply",
  "Invoices for inward supply from unregistered person",
  "Revised Invoice",
  "Debit Note",
  "Credit Note",
  "Receipt Voucher",
  "Payment Voucher",
  "Refund Voucher",
  "Delivery Challan for job work",
  "Delivery Challan for supply on approval",
  "Delivery Challan in case of liquid gas",
  "Delivery Challan in case other than by way of supply (excluding at S no. 9 to 11)",
];

const VALID_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 14, 18, 28, 40];
const NOTE_TYPES = ["C", "D", "R"]; // credit, debit, refund voucher (per the template's help sheet)

// Column order of each sheet in the V2.0 template (data starts on row 5).
const SHEETS = {
  b2b:    { names: ["b2b,sez,de", "b2b"], cols: "ctin name inum idt val pos rchrg diff invtyp etin rt txval cess oinum oidt" },
  b2ba:   { names: ["b2ba"], cols: "ctin name oinum oidt inum idt val pos rchrg diff invtyp etin rt txval cess" },
  b2cl:   { names: ["b2cl"], cols: "inum idt val pos diff rt txval cess etin oinum oidt opos" },
  b2cla:  { names: ["b2cla"], cols: "oinum oidt opos inum idt val diff rt txval cess etin" },
  b2cs:   { names: ["b2cs"], cols: "typ pos diff rt txval cess etin fy omon ort" },
  b2csa:  { names: ["b2csa"], cols: "fy omon pos typ diff rt txval cess etin" },
  cdnr:   { names: ["cdnr"], cols: "ctin name num dt ntty pos rchrg suptyp val diff rt txval cess onum odt" },
  cdnra:  { names: ["cdnra"], cols: "ctin name onum odt num dt ntty pos rchrg suptyp val diff rt txval cess" },
  cdnur:  { names: ["cdnur"], cols: "urtyp num dt ntty pos val diff rt txval cess onum odt" },
  cdnura: { names: ["cdnura"], cols: "urtyp onum odt num dt ntty pos val diff rt txval cess" },
  exp:    { names: ["exp"], cols: "exptyp inum idt val port sbnum sbdt rt txval cess oinum oidt" },
  expa:   { names: ["expa"], cols: "exptyp oinum oidt inum idt val port sbnum sbdt rt txval cess" },
  at:     { names: ["at"], cols: "pos diff rt amt cess fy omon opos" },
  ata:    { names: ["ata"], cols: "fy omon pos diff rt amt cess" },
  atadj:  { names: ["atadj"], cols: "pos diff rt amt cess fy omon opos" },
  atadja: { names: ["atadja"], cols: "fy omon pos diff rt amt cess" },
  exemp:  { names: ["exemp"], cols: "desc nil expt ngsup" },
  hsn:    { names: ["hsn"], cols: "hsn desc uqc qty val rt txval igst cgst sgst cess" }, // legacy single sheet
  hsnb2b: { names: ["hsn(b2b)", "hsn_b2b", "hsn b2b", "hsn-b2b", "hsn,b2b"], cols: "hsn desc uqc qty val rt txval igst cgst sgst cess" },
  hsnb2c: { names: ["hsn(b2c)", "hsn_b2c", "hsn b2c", "hsn-b2c", "hsn,b2c"], cols: "hsn desc uqc qty val rt txval igst cgst sgst cess" },
  docs:   { names: ["docs", "doc"], cols: "nature from to total cancel" },
  eco:    { names: ["eco"], cols: "nature etin name val igst cgst sgst cess fy omon oetin" },
  ecoa:   { names: ["ecoa"], cols: "nature fy omon oetin retin name val igst cgst sgst cess" },
  // Section 9(5)
  ecob2b:    { names: ["ecob2b"],    cols: "stin sname rtin rname dnum ddt val pos dtyp rt txval cess odnum oddt" },
  ecourp2b:  { names: ["ecourp2b"],  cols: "rtin rname dnum ddt val pos dtyp rt txval cess odnum oddt" },
  ecob2c:    { names: ["ecob2c"],    cols: "stin sname pos txval rt cess fy omon" },
  ecourp2c:  { names: ["ecourp2c"],  cols: "pos txval rt cess fy omon" },
  ecoab2b:   { names: ["ecoab2b"],   cols: "stin sname rtin rname odnum oddt dnum ddt val pos dtyp rt txval cess" },
  // "ostin" (Original supplier GSTIN, optional, last column): only needed when the supplier GSTIN itself is being amended
  ecoab2c:   { names: ["ecoab2c"],   cols: "fy omon stin sname pos rt txval cess ostin" },
  ecoaurp2b: { names: ["ecoaurp2b"], cols: "rtin rname odnum oddt dnum ddt val dtyp pos rt txval cess" },
  ecoaurp2c: { names: ["ecoaurp2c"], cols: "fy omon pos rt txval cess" },
};

// ---- Single-sheet layout (amendments consolidated into the main sheets) ---------------------------
// Every main sheet now has its own "Amendment - original details" columns on the right. A row is an
// AMENDMENT row when any of those columns is filled, and is then converted exactly like a row of the old
// separate amendment sheet (b2ba, b2cla, ...); otherwise it is a normal row. The old separate amendment
// sheets are still read if a workbook has them, so older workbooks keep working.
//   amend : key of the amendment table the row feeds
//   extra : the "original details" columns that mark a row as an amendment
//   fix   : (row, warn) => overrides that turn the row into the old amendment-sheet shape
const posEq = (a, b) => posCode(a) === posCode(b);
const MERGED = {
  b2b:      { amend: "b2ba",      extra: ["oinum", "oidt"] },
  b2cl:     { amend: "b2cla",     extra: ["oinum", "oidt", "opos"], fix: (r) => ({ opos: isBlank(r.opos) ? r.pos : r.opos }) },
  // B2CS amendment: the "Rate" column is the revised rate; when it is left blank the "Original Rate" is used.
  b2cs:     { amend: "b2csa",     extra: ["fy", "omon", "ort"], fix: (r, warn) => {
    if (!isBlank(r.rt) && !isBlank(r.ort) && num(r.rt) !== num(r.ort))
      warn(`b2cs row ${r._row}: Rate ${r.rt} differs from Original Rate ${r.ort}. The portal JSON (b2csa) carries only one rate, so the revised Rate ${r.rt} was used.`);
    return { rt: isBlank(r.rt) ? r.ort : r.rt };
  } },
  cdnr:     { amend: "cdnra",     extra: ["onum", "odt"] },
  cdnur:    { amend: "cdnura",    extra: ["onum", "odt"] },
  exp:      { amend: "expa",      extra: ["oinum", "oidt"] },
  // AT / ATADJ amendment: the Original Place of Supply identifies the record being amended.
  at:       { amend: "ata",       extra: ["fy", "omon", "opos"], fix: (r, warn) => advPos(r, warn, "at") },
  atadj:    { amend: "atadja",    extra: ["fy", "omon", "opos"], fix: (r, warn) => advPos(r, warn, "atadj") },
  eco:      { amend: "ecoa",      extra: ["fy", "omon", "oetin"], fix: (r) => ({ retin: r.etin }) },
  ecob2b:   { amend: "ecoab2b",   extra: ["odnum", "oddt"] },
  ecourp2b: { amend: "ecoaurp2b", extra: ["odnum", "oddt"] },
  ecob2c:   { amend: "ecoab2c",   extra: ["fy", "omon"] },
  ecourp2c: { amend: "ecoaurp2c", extra: ["fy", "omon"] },
};
function advPos(r, warn, sheet) {
  if (!isBlank(r.pos) && !isBlank(r.opos) && !posEq(r.pos, r.opos))
    warn(`${sheet} row ${r._row}: Place of Supply "${r.pos}" differs from Original Place of Supply "${r.opos}". The original Place of Supply identifies the amended record, so it was used.`);
  return { pos: isBlank(r.opos) ? r.pos : r.opos };
}
const BASE_OF = Object.fromEntries(Object.entries(MERGED).map(([k, v]) => [v.amend, k]));
const isAmendRow = (r, extra) => extra.some((k) => !isBlank(r[k]));

function readRows(wb, spec) {
  const nz = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const sheetName = wb.SheetNames.find((n) => spec.names.map(nz).includes(nz(n)));
  if (!sheetName) return { rows: [], sheetName: null };
  const keys = spec.cols.split(" ");
  const ws = wb.Sheets[sheetName];
  const ref = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: true, range: { s: { r: 0, c: 0 }, e: ref.e } });
  const rows = [];
  raw.forEach((arr, i) => {
    if (i < 4) return; // rows 1-4 = summary + headers
    if (arr.every(isBlank)) return;
    const o = { _row: i + 1, _sheet: sheetName };
    keys.forEach((k, j) => (o[k] = arr[j]));
    rows.push(o);
  });
  return { rows, sheetName };
}

// GSTIN / UIN / TDS / NRTP check character (same algorithm the GST portal and offline tool use)
const CHK = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function gstinOk(g) {
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d][A-Z\d][A-Z\d]$/.test(g) && !/^\d{4}[A-Z]{3}\d{5}[A-Z0-9]{3}$/.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) { const v = CHK.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2); sum += Math.floor(v / 36) + (v % 36); }
  return CHK[(36 - (sum % 36)) % 36] === g[14];
}

// "Company Info" sheet = the same questions as the offline tool's "File Returns" screen (Field | Value):
//   GST Statement/Returns (GSTR-1 or IFF) | GSTR-1
//   GSTIN of Supplier                      | 29AAICA3918J1ZE
//   Financial Year                         | 2026-27
//   Tax Period (month)                     | OCTOBER
//   Is SEZ Taxpayer?                       | No
//   Is taxpayer Quarterly filer?           | No
//   Is aggregate turnover greater than 5CR in preceding financial year? | No
//   (optional) Return Period (MMYYYY) | 102026 ; Aggregate Turnover - Previous FY ; Current FY Turnover
const etinOk = (g) => gstinOk(g) && g[13] === "C"; // e-commerce operator (TCS) GSTINs carry "C" as the 14th character
const COMPANY_SHEETS = ["companyinfo", "company", "filereturns", "filinginfo", "returninfo", "taxpayerinfo", "gstr1info", "filingdetails"];
const yes = (v) => /^\s*(y|yes|true|1)\s*$/i.test(String(v ?? ""));
function readCompanyInfo(wb) {
  const nz = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = wb.SheetNames.find((n) => COMPANY_SHEETS.includes(nz(n)));
  if (!name) return null;
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "", blankrows: true });
  const kv = {};
  for (const row of raw) { const k = nz(row[0] ?? ""); if (k && !isBlank(row[1])) kv[k] = row[1]; }
  const pick = (...keys) => {
    for (const k of keys) if (!isBlank(kv[k])) return kv[k];
    for (const k of keys) { const f = Object.keys(kv).find((x) => x.startsWith(k)); if (f) return kv[f]; }
    return undefined;
  };
  const info = {
    sheet: name,
    form: pick("gststatement", "returntype", "form"),
    gstin: pick("gstinofsupplier", "gstin", "gstinuin"),
    legalName: pick("legalname", "companyname", "name"),
    isSez: pick("issez"), isQuarterly: pick("istaxpayerquarterly", "isquarterly", "quarterly"),
    aatoAbove5Cr: pick("isaggregateturnover", "aggregateturnovergreater", "aato"),
    gt: pick("aggregateturnoverpreviousfy", "grossturnover", "gt"), curGt: pick("currentfyturnover", "curgt"),
  };
  let fp = pick("returnperiodmmyyyy", "fp");
  if (fp !== undefined) { fp = String(fp).replace(/\D/g, ""); if (fp.length === 5) fp = "0" + fp; }
  if (!fp || fp.length !== 6) {
    const m = pick("taxperiod", "returnmonth", "month"); const fy = pick("financialyear", "fy");
    const mi = m === undefined ? -1 : MONTHS.findIndex((x) => x.startsWith(String(m).trim().toUpperCase().slice(0, 3)));
    const ym = fy === undefined ? null : String(fy).match(/^(\d{4})/);
    fp = mi >= 0 && ym ? pad(mi + 1) + (mi >= 3 ? +ym[1] : +ym[1] + 1) : undefined;
  }
  info.fp = fp;
  return info;
}

export const toPortalText = (json) => JSON.stringify(json); // minified, like the GST portal / offline tool

// File name the offline tool expects when importing: returns_<DDMMYYYY>_R1_<GSTIN>_offline.json
// The offline tool reads the GSTIN / return type from this NAME (split on "_"), not from the JSON, so any other
// name (e.g. "GSTR1_Workbook_with_Summary_JSON.json") fills the GSTIN box with a wrong word and leaves GST Statement blank.
// The date is the LAST DAY of the return period read from the "Company Info" sheet (e.g. period 102026 -> 31102026),
// NOT today's date. Pass opts.fileDate (a Date or "DDMMYYYY") only if you want to override it.
// Only if the period is missing/invalid does it fall back to today.
export function gstr1PortalFileName(gstin, date, fp) {
  let d = typeof date === "string" && /^\d{8}$/.test(date) ? date : "";
  if (!d && date instanceof Date && !Number.isNaN(date.getTime())) d = pad(date.getDate()) + pad(date.getMonth() + 1) + date.getFullYear();
  if (!d) {
    const m = /^(0[1-9]|1[0-2])(\d{4})$/.exec(String(fp ?? "").trim());
    if (m) d = pad(new Date(Date.UTC(+m[2], +m[1], 0)).getUTCDate()) + m[1] + m[2]; // day 0 of next month = last day of this month
  }
  if (!d) { const t = new Date(); d = pad(t.getDate()) + pad(t.getMonth() + 1) + t.getFullYear(); }
  return `returns_${d}_R1_${gstinTxt(gstin)}_offline.json`;
}

// Saves the converted JSON under the offline-tool file name, e.g. returns_31102026_R1_29AAICA3918J1ZE_offline.json
//   const result = gstr1ExcelToJson(file);
//   if (!result.errors.length) gstr1DownloadJson(result);        // name = result.fileName
// (a second argument overrides the name; it is cleaned so it always ends in "_offline.json"-style safe characters)
export function gstr1DownloadJson(result, fileName) {
  const name = String(fileName || result.fileName).replace(/[\\/:*?"<>|]+/g, "_");
  const blob = new Blob([result.text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return name;
}

export function gstr1ExcelToJson(input, opts = {}) {
  const warnings = [];
  const errors = [];

  let wb;
  if (typeof input === "string") throw new Error("Pass an Excel File or ArrayBuffer in the extension popup.");
  else {
    const buf = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    wb = XLSX.read(buf, { type: "buffer", cellDates: false, cellFormula: false, cellStyles: false });
  }

  // Values given by the caller win; otherwise they come from the workbook's "Company Info" sheet.
  const company = readCompanyInfo(wb);
  const gstin = gstinTxt(opts.gstin ?? company?.gstin);
  const fp = str(opts.fp ?? company?.fp);
  if (opts.gt === undefined && company?.gt !== undefined) opts = { ...opts, gt: company.gt };
  if (opts.curGt === undefined && company?.curGt !== undefined) opts = { ...opts, curGt: company.curGt };

  if (!gstinOk(gstin)) errors.push(`Invalid taxpayer GSTIN "${gstin}" (format or check character is wrong). Fill it in the "Company Info" sheet or pass { gstin }.`);
  if (!/^(0[1-9]|1[0-2])\d{4}$/.test(fp)) errors.push(`Invalid return period "${fp}". Fill Month + Financial Year (or Return Period as MMYYYY, e.g. 102026) in the "Company Info" sheet, or pass { fp }.`);
  const home = gstin.slice(0, 2);
  const flag = (k, v) => (opts[k] !== undefined ? !!opts[k] : yes(v));
  const sez = flag("isSez", company?.isSez);                 // SEZ taxpayer: every supply is charged IGST
  const quarterly = flag("isQuarterly", company?.isQuarterly); // quarterly filer: IFF months allow only B2B/CDNR (+ amendments)
  const aatoAbove5Cr = flag("aatoAbove5Cr", company?.aatoAbove5Cr); // HSN minimum digits 6 (else 4)
  const sumDuplicates = str(opts.duplicateMode).toLowerCase() !== "last";
  if (!company) warnings.push('No "Company Info" sheet found: assuming Not SEZ, Not quarterly filer, turnover up to 5 Cr (HSN min 4 digits).');

  // B2CL / CDNUR(B2CL) value limit: more than 1 lakh from Aug 2024, 2.5 lakh before
  const fpMonth = Number(fp.slice(0, 2)), fpYear = Number(fp.slice(2));
  const b2clLimit = fpYear > 2024 || (fpYear === 2024 && fpMonth >= 8) ? 100000 : 250000;

  const err = (sheet, row, msg) => errors.push(`${sheet} row ${row}: ${msg}`);

  // ---- shared helpers ------------------------------------------------------
  const tax = (txval, rt, pos, cess, forceIgst = false, diff = 1, zeroTax = false) => {
    const t = { rt, txval: r2(txval) };
    const inter = forceIgst || sez || !pos || pos !== home;
    const total = zeroTax ? 0 : (txval * rt * diff) / 100;
    if (inter) t.iamt = r2(total);
    else { t.camt = r2(total / 2); t.samt = r2(total / 2); }
    t.csamt = r2(cess);
    return t;
  };
  const addInto = (a, b) => { for (const k of Object.keys(b)) if (k !== "rt") a[k] = r2((a[k] || 0) + b[k]); };
  const numd = (d) => ({ num: Math.round(d.rt * 100) + 1, itm_det: d });
  const itmsOf = (m) => [...m.values()].map(numd);
  const addItem = (m, det) => { const k = String(det.rt); if (m.has(k)) addInto(m.get(k), det); else m.set(k, det); };

  function checkLine(sheet, r, { needRate = true } = {}) {
    const rt = num(r.rt);
    if (needRate && (Number.isNaN(rt) || !VALID_RATES.includes(rt))) err(sheet, r._row, `Rate "${r.rt}" is not a valid GST rate`);
    if ("diff" in r && !isBlank(r.diff) && ![65, 100].includes(num(r.diff))) err(sheet, r._row, `Applicable % of Tax Rate "${r.diff}" must be 65 or 100 (or blank)`);
    checkNums(sheet, r);
    return rt;
  }
  // Every amount cell must be blank (= 0) or a number; otherwise it would become null in the JSON.
  const NUM_COLS = ["txval", "cess", "val", "amt", "qty", "igst", "cgst", "sgst", "nil", "expt", "ngsup", "total", "cancel"];
  const checkNums = (sheet, r, cols = NUM_COLS) => {
    for (const k of cols) if (k in r && Number.isNaN(num(r[k]))) err(sheet, r._row, `"${k}" value "${r[k]}" is not a number`);
  };

  // GSTIN checks: a wrong format is an error; a right format with a wrong check character is only a warning
  // (the value is kept as entered), so sample / test data does not block the whole conversion.
  const fmtOk = (g) => /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d][A-Z\d][A-Z\d]$/.test(g) || /^\d{4}[A-Z]{3}\d{5}[A-Z0-9]{3}$/.test(g);
  const checkGstin = (sheet, r, v, label = "GSTIN/UIN of recipient") => {
    const g = gstinTxt(v);
    if (!gstinOk(g)) {
      const f = fmtOk(g);
      (f ? warnings : errors).push(`${sheet} row ${r._row}: ${label} "${v}" is not a valid GSTIN/UIN${f ? " (check character is wrong; kept as entered)" : " (format is wrong)"}`);
    }
    return g;
  };
  const etinBad = (g) => !etinOk(g);
  const etinSink = (g) => (fmtOk(g) && g[13] === "C" ? warnings : errors);
  const etinMsg = (g) => (fmtOk(g) && g[13] === "C" ? "check character is wrong; kept as entered" : "must be a valid e-commerce operator GSTIN (14th character C)");
  const optEtin = (r, v) => {
    const g = gstinTxt(v);
    if (g && etinBad(g)) etinSink(g).push(`${r._sheet} row ${r._row}: E-Commerce GSTIN "${v}" ${etinMsg(g)}`);
    return g;
  };
  const checkEtin = (sheet, r, v, label) => {
    const g = gstinTxt(v);
    if (etinBad(g)) etinSink(g).push(`${sheet} row ${r._row}: ${label} "${v}" ${etinMsg(g)}`);
    return g;
  };
  const checkDate = (sheet, r, v, label) => {
    const d = fmtDate(v);
    if (!d) err(sheet, r._row, `${label} "${v}" is not a valid date`);
    return d;
  };
  const optDate = (sheet, r, v, label) => {
    const d = fmtDate(v);
    if (!d && !isBlank(v)) warnings.push(`${sheet} row ${r._row}: ${label} "${v}" is not a valid date and was left out`);
    return d;
  };
  const checkNo = (sheet, r, v, label) => {
    if (typeof v === "string" && /[\r\n\t]/.test(v)) warnings.push(`${sheet} row ${r._row}: ${label} had a line break/tab; it was replaced by a space ("${str(v)}")`);
    const s = str(v);
    if (!s) err(sheet, r._row, `${label} is blank`);
    else if (s.length > 16) err(sheet, r._row, `${label} "${s}" is longer than 16 characters`);
    return s;
  };
  const checkPos = (sheet, r, v) => {
    const p = posCode(v);
    if (!p) err(sheet, r._row, `Place of Supply "${v}" is not valid`);
    return p;
  };
  const checkNote = (sheet, r, v) => {
    const t = str(v).toUpperCase();
    if (!NOTE_TYPES.includes(t)) err(sheet, r._row, `Note type "${v}" must be C, D or R`);
    return t;
  };

  const turnover = (v, label) => {
    if (isBlank(v)) return undefined;
    const n = num(v);
    if (Number.isNaN(n)) { errors.push(`${label} "${v}" is not a number`); return undefined; }
    return r2(n);
  };
  const gtV = turnover(opts.gt, "Aggregate turnover (previous FY)");
  const curGtV = turnover(opts.curGt, "Current FY turnover");
  const out = { gstin, fp, ...(gtV !== undefined ? { gt: gtV } : {}), ...(curGtV !== undefined ? { cur_gt: curGtV } : {}), version: opts.version || "GST3.2.2", hash: "hash" };

  const cache = {};
  const get = (k) => {
    if (cache[k]) return cache[k];
    const m = MERGED[k], baseKey = BASE_OF[k];
    let res;
    if (m) {
      // main sheet: normal rows only (rows with "original details" are amendments, handled below)
      const all = readRows(wb, SHEETS[k]);
      res = { sheetName: all.sheetName, rows: all.rows.filter((r) => !isAmendRow(r, m.extra)) };
    } else if (baseKey) {
      // amendment table: rows of an old separate amendment sheet (if present) + amendment rows of the main sheet
      const legacy = readRows(wb, SHEETS[k]);
      const base = readRows(wb, SHEETS[baseKey]);
      const bm = MERGED[baseKey];
      const fromBase = base.rows.filter((r) => isAmendRow(r, bm.extra)).map((r) => {
        const o = { ...r, ...(bm.fix ? bm.fix(r, (w) => warnings.push(w)) : {}) };
        o._row = `${r._row} [amendment columns of sheet "${r._sheet}"]`;
        return o;
      });
      res = { sheetName: legacy.sheetName || base.sheetName, rows: [...legacy.rows, ...fromBase] };
    } else res = readRows(wb, SHEETS[k]);
    return (cache[k] = res);
  };

  // ---- B2B / SEZ / DE ------------------------------------------------------
  {
    const { rows } = get("b2b");
    const ctins = new Map();
    for (const r of rows) {
      const ctin = checkGstin("b2b", r, r.ctin);
      const inum = checkNo("b2b", r, r.inum, "Invoice number");
      const pos = checkPos("b2b", r, r.pos);
      const rt = checkLine("b2b", r);
      if (!ctins.has(ctin)) ctins.set(ctin, new Map());
      const invs = ctins.get(ctin);
      let inv = invs.get(inum);
      if (!inv) {
        inv = {
          inum, idt: checkDate("b2b", r, r.idt, "Invoice date"), val: r2(num(r.val)), pos,
          rchrg: str(r.rchrg).toUpperCase() === "Y" ? "Y" : "N",
          inv_typ: invTyp(r.invtyp), _items: new Map(),
        };
        const etin = optEtin(r, r.etin); if (etin) inv.etin = etin;
        const d = diffPct(r.diff); if (d !== undefined) inv.diff_percent = d;
        invs.set(inum, inv);
      }
      // SEZ-with/without-payment supplies are always IGST; without payment = zero tax
      addItem(inv._items, tax(num(r.txval), rt, pos, num(r.cess), ["SEWP", "SEWOP"].includes(inv.inv_typ), inv.diff_percent ?? 1, inv.inv_typ === "SEWOP"));
    }
    if (ctins.size) out.b2b = [...ctins].map(([ctin, invs]) => ({
      ctin,
      inv: [...invs.values()].map(({ _items, ...inv }) => ({ ...inv, itms: itmsOf(_items) })),
    }));
  }

  // ---- B2CL ----------------------------------------------------------------
  {
    const { rows } = get("b2cl");
    const byPos = new Map();
    for (const r of rows) {
      const pos = checkPos("b2cl", r, r.pos);
      const inum = checkNo("b2cl", r, r.inum, "Invoice number");
      const rt = checkLine("b2cl", r);
      if (!byPos.has(pos)) byPos.set(pos, new Map());
      const invs = byPos.get(pos);
      let inv = invs.get(inum);
      if (!inv) {
        inv = { inum, idt: checkDate("b2cl", r, r.idt, "Invoice date"), val: r2(num(r.val)), _items: new Map() };
        if (pos && pos === home) err("b2cl", r._row, "Place of Supply is your own state: B2CL must be inter-state (report this in b2cs)");
        if (inv.val <= b2clLimit) warnings.push(`b2cl row ${r._row}: invoice value ${inv.val} is not above ${b2clLimit} - the portal may reject it as B2CL.`);
        const etin = optEtin(r, r.etin); if (etin) inv.etin = etin;
        const d = diffPct(r.diff); if (d !== undefined) inv.diff_percent = d;
        invs.set(inum, inv);
      }
      addItem(inv._items, tax(num(r.txval), rt, pos, num(r.cess), true, inv.diff_percent ?? 1)); // B2CL is always inter-state
    }
    if (byPos.size) out.b2cl = [...byPos].map(([pos, invs]) => ({
      pos,
      inv: [...invs.values()].map(({ _items, ...inv }) => ({ ...inv, itms: itmsOf(_items) })),
    }));
  }

  // ---- B2CS ----------------------------------------------------------------
  // Type OE (other than e-commerce) and type E (supplies through an e-commerce operator, needs the operator GSTIN in
  // "etin"). Rows repeating the same POS + rate + type (+ etin) are ADDED together (opts.duplicateMode "last"
  // keeps only the last row instead).
  {
    const { rows } = get("b2cs");
    const map = new Map();
    let dups = 0;
    for (const r of rows) {
      const typ = str(r.typ).toUpperCase();
      if (typ !== "OE" && typ !== "E") {
        err("b2cs", r._row, `Type "${r.typ}" must be OE or E`);
        continue;
      }
      let etin = "";
      if (typ === "E") etin = checkEtin("b2cs", r, r.etin, "E-Commerce GSTIN (required for type E)");
      const pos = checkPos("b2cs", r, r.pos);
      const rt = checkLine("b2cs", r);
      const sply = pos === home && !sez ? "INTRA" : "INTER";
      const d = diffPct(r.diff);
      const key = [sply, pos, typ, rt, d ?? "", etin].join("|");
      const det = tax(num(r.txval), rt, pos, num(r.cess), false, d ?? 1);
      const entry = Object.assign({ sply_ty: sply, rt, typ, pos, ...(etin ? { etin } : {}), ...(d !== undefined ? { diff_percent: d } : {}) }, det);
      if (map.has(key)) {
        dups++;
        if (sumDuplicates) addInto(map.get(key), det); else map.set(key, entry);
      } else map.set(key, entry);
    }
    if (dups) warnings.push(`b2cs: ${dups} row(s) repeat an earlier POS + rate + type. ${sumDuplicates ? "They were added together." : 'The last row was kept (as the offline tool does). Remove duplicateMode:"last" to add them up instead.'}`);
    if (map.size) out.b2cs = [...map.values()];
  }

  // ---- CDNR ----------------------------------------------------------------
  {
    const { rows } = get("cdnr");
    const byCtin = new Map();
    for (const r of rows) {
      const ctin = checkGstin("cdnr", r, r.ctin);
      const num_ = checkNo("cdnr", r, r.num, "Note number");
      const pos = checkPos("cdnr", r, r.pos);
      const rt = checkLine("cdnr", r);
      const ntty = checkNote("cdnr", r, r.ntty);
      if (!byCtin.has(ctin)) byCtin.set(ctin, new Map());
      const notes = byCtin.get(ctin);
      const k = ntty + "|" + num_;
      let n = notes.get(k);
      if (!n) {
        n = {
          ntty, nt_num: num_, nt_dt: checkDate("cdnr", r, r.dt, "Note date"), val: r2(num(r.val)), pos,
          rchrg: str(r.rchrg).toUpperCase() === "Y" ? "Y" : "N", inv_typ: invTyp(r.suptyp), _items: new Map(),
        };
        const d = diffPct(r.diff); if (d !== undefined) n.diff_percent = d;
        notes.set(k, n);
      }
      addItem(n._items, tax(num(r.txval), rt, pos, num(r.cess), ["SEWP", "SEWOP"].includes(n.inv_typ), n.diff_percent ?? 1, n.inv_typ === "SEWOP"));
    }
    if (byCtin.size) out.cdnr = [...byCtin].map(([ctin, notes]) => ({
      ctin,
      nt: [...notes.values()].map(({ _items, ...n }) => ({ ...n, itms: itmsOf(_items) })),
    }));
  }

  // ---- CDNUR ---------------------------------------------------------------
  {
    const { rows } = get("cdnur");
    const notes = new Map();
    for (const r of rows) {
      const typ = str(r.urtyp).toUpperCase();
      if (!["B2CL", "EXPWP", "EXPWOP"].includes(typ)) err("cdnur", r._row, `UR Type "${r.urtyp}" must be B2CL, EXPWP or EXPWOP`);
      const nn = checkNo("cdnur", r, r.num, "Note number");
      const ntty = checkNote("cdnur", r, r.ntty);
      const rt = checkLine("cdnur", r);
      const pos = typ === "B2CL" ? checkPos("cdnur", r, r.pos) : posCode(r.pos);
      const k = ntty + "|" + nn;
      let n = notes.get(k);
      if (!n) {
        n = { typ, ntty, nt_num: nn, nt_dt: checkDate("cdnur", r, r.dt, "Note date"), val: r2(num(r.val)), _items: new Map() };
        if (pos) n.pos = pos;
        const d = diffPct(r.diff); if (d !== undefined) n.diff_percent = d;
        notes.set(k, n);
      }
      addItem(n._items, tax(num(r.txval), rt, pos, num(r.cess), true, n.diff_percent ?? 1, typ === "EXPWOP"));
    }
    if (notes.size) out.cdnur = [...notes.values()].map(({ _items, ...n }) => ({ ...n, itms: itmsOf(_items) }));
  }

  // ---- EXP -----------------------------------------------------------------
  {
    const { rows } = get("exp");
    const byTyp = new Map();
    for (const r of rows) {
      const typ = str(r.exptyp).toUpperCase();
      if (!["WPAY", "WOPAY"].includes(typ)) err("exp", r._row, `Export Type "${r.exptyp}" must be WPAY or WOPAY`);
      const inum = checkNo("exp", r, r.inum, "Invoice number");
      const rt = checkLine("exp", r);
      if (!byTyp.has(typ)) byTyp.set(typ, new Map());
      const invs = byTyp.get(typ);
      let inv = invs.get(inum);
      if (!inv) {
        inv = { inum, idt: checkDate("exp", r, r.idt, "Invoice date"), val: r2(num(r.val)), _items: new Map() };
        const pc = str(r.port); if (pc) inv.sbpcode = pc;
        const sn = str(r.sbnum); if (sn) inv.sbnum = sn;
        const sd = optDate("exp", r, r.sbdt, "Shipping bill date"); if (sd) inv.sbdt = sd;
        invs.set(inum, inv);
      }
      const t = tax(num(r.txval), rt, "", num(r.cess), true);
      addItem(inv._items, { txval: t.txval, rt, iamt: typ === "WOPAY" ? 0 : t.iamt, csamt: t.csamt });
    }
    if (byTyp.size) out.exp = [...byTyp].map(([exp_typ, invs]) => ({
      exp_typ,
      inv: [...invs.values()].map(({ _items, ...inv }) => ({ ...inv, itms: [..._items.values()] })),
    }));
  }

  // ---- AT / ATADJ (advance received / adjusted) ----------------------------
  const advance = (key, outKey) => {
    const { rows } = get(key);
    const groups = new Map();
    for (const r of rows) {
      const pos = checkPos(key, r, r.pos);
      const rt = checkLine(key, r);
      const sply = pos === home && !sez ? "INTRA" : "INTER";
      const d = diffPct(r.diff);
      const gk = pos + "|" + (d ?? "");
      if (!groups.has(gk)) groups.set(gk, { pos, sply_ty: sply, ...(d !== undefined ? { diff_percent: d } : {}), _items: new Map() });
      const amt = num(r.amt), f = d ?? 1;
      addItem(groups.get(gk)._items, { rt, ad_amt: r2(amt), ...(sply === "INTER" ? { iamt: r2((amt * rt * f) / 100) } : { camt: r2((amt * rt * f) / 200), samt: r2((amt * rt * f) / 200) }), csamt: r2(num(r.cess)) });
    }
    if (groups.size) out[outKey] = [...groups.values()].map(({ _items, ...g }) => ({ ...g, itms: [..._items.values()] }));
  };
  advance("at", "at");
  advance("atadj", "txpd");

  // ---- NIL / EXEMPT / NON-GST ---------------------------------------------
  {
    const { rows } = get("exemp");
    const order = ["INTRB2B", "INTRAB2B", "INTRB2C", "INTRAB2C"];
    const inv = [];
    rows.forEach((r, i) => {
      const d = str(r.desc).toLowerCase();
      let ty;
      if (d) {
        const inter = /inter/.test(d) && !/intra/.test(d);
        const reg = /unregist/.test(d) ? "B2C" : "B2B";
        ty = (inter ? "INTR" : "INTRA") + reg;
      } else ty = order[i];
      if (!ty) return err("exemp", r._row, "Cannot identify supply type from Description");
      checkNums("exemp", r, ["nil", "expt", "ngsup"]);
      const nil = r2(num(r.nil)), expt = r2(num(r.expt)), ng = r2(num(r.ngsup));
      const ex = inv.find((x) => x.sply_ty === ty);
      if (ex) { ex.nil_amt = r2(ex.nil_amt + nil); ex.expt_amt = r2(ex.expt_amt + expt); ex.ngsup_amt = r2(ex.ngsup_amt + ng); }
      else inv.push({ sply_ty: ty, expt_amt: expt, nil_amt: nil, ngsup_amt: ng });
    });
    if (inv.length) out.nil = { inv };
  }

  // ---- HSN (Table 12) -- portal format: hsn.hsn_b2b[] and hsn.hsn_b2c[] -----
  let hsnDescMissing = false;
  {
    const descOf = (code) =>
      (typeof opts.hsnDescriptions === "function" ? opts.hsnDescriptions(code) : opts.hsnDescriptions?.[code])
      || hsnMasterFile()?.[code]
      || BUILTIN_HSN[code];
    const build = (key, label) => {
      const { rows, sheetName } = get(key);
      if (!sheetName) return [];
      const map = new Map();
      for (const r of rows) {
        let hsn = str(r.hsn);
        if (/^\d+$/.test(hsn) && [3, 5, 7].includes(hsn.length)) hsn = "0" + hsn; // Excel dropped a leading zero
        if (!(aatoAbove5Cr ? /^\d{6,8}$/ : /^\d{4,8}$/).test(hsn)) err(label, r._row, `HSN "${r.hsn}" must be ${aatoAbove5Cr ? "6-8" : "4-8"} digits (${aatoAbove5Cr ? "turnover above 5 Cr" : "turnover up to 5 Cr"})`);
        const rt = checkLine(label, r);
        const uqc = str(r.uqc).split("-")[0].trim().toUpperCase();
        const svc = hsn.startsWith("99"); // services: UQC = NA, quantity = 0 (as the offline tool does)
        if (!uqc && !svc) err(label, r._row, "UQC is blank");
        const k = [hsn, svc ? "NA" : uqc, rt].join("|");
        const userDesc = str(r.desc);
        const m = descOf(hsn);
        if (!m) hsnDescMissing = true;
        const cur = {
          hsn_sc: hsn, ...(userDesc ? { user_desc: userDesc } : {}), ...(m || userDesc ? { desc: m || userDesc } : {}), uqc: svc ? "NA" : uqc, qty: svc ? 0 : r2(num(r.qty)), rt, txval: r2(num(r.txval)),
          iamt: r2(num(r.igst)), samt: r2(num(r.sgst)), camt: r2(num(r.cgst)), csamt: r2(num(r.cess)),
        };
        if (map.has(k)) { const e = map.get(k); for (const f of ["qty", "txval", "iamt", "camt", "samt", "csamt"]) e[f] = r2(e[f] + cur[f]); }
        else map.set(k, cur);
      }
      return [...map.values()].map((d, i) => ({ num: i + 1, ...d }));
    };
    let b2bH = build("hsnb2b", "hsn(b2b)");
    let b2cH = build("hsnb2c", "hsn(b2c)");
    // Old V2.0 template has one "hsn" sheet with no B2B/B2C split. The portal needs the split,
    // so the caller must say which table that sheet belongs to (or split the sheet in two).
    const legacy = get("hsn");
    if (legacy.sheetName && legacy.rows.length) {
      const as = str(opts.legacyHsnAs).toLowerCase();
      if (b2bH.length || b2cH.length) warnings.push('Both the old "hsn" sheet and the new hsn(b2b)/hsn(b2c) sheets have data; the old "hsn" sheet was ignored.');
      else if (as === "b2b") b2bH = build("hsn", "hsn");
      else if (as === "b2c") b2cH = build("hsn", "hsn");
      else errors.push('The "hsn" sheet has data, but the GST portal now needs HSN split into B2B and B2C. Use the hsn(b2b)/hsn(b2c) sheets, or pass { legacyHsnAs: "b2b" | "b2c" } to say which table this sheet belongs to.');
    }
    if (hsnDescMissing) warnings.push(hsnMasterFile() ? "Some HSN codes are not in hsn-master.json; for those your own description was used as \"desc\"." : "Some HSN codes have no master description: place hsn-master.json next to this file (or pass opts.hsnDescriptions). Your own description was used as \"desc\" for those - the offline tool fills it from the HSN master.");
    if (b2bH.length || b2cH.length) out.hsn = { ...(b2bH.length ? { hsn_b2b: b2bH } : {}), ...(b2cH.length ? { hsn_b2c: b2cH } : {}) };
  }

  // ---- DOCS ISSUED ---------------------------------------------------------
  {
    const { rows } = get("docs");
    const byNature = new Map();
    for (const r of rows) {
      const idx = DOC_NATURE.findIndex((n) => n.toLowerCase() === str(r.nature).toLowerCase());
      if (idx < 0) { err("docs", r._row, `Nature of Document "${r.nature}" not recognised`); continue; }
      checkNums("docs", r, ["total", "cancel"]);
      const total = num(r.total), cancel = num(r.cancel);
      if (!Number.isNaN(total + cancel) && (!Number.isInteger(total) || !Number.isInteger(cancel) || total < 0 || cancel < 0)) err("docs", r._row, "Total Number and Cancelled must be whole numbers (0 or more)");
      if (!str(r.from) || !str(r.to)) err("docs", r._row, "Sr. No. From/To is blank");
      if (cancel > total) err("docs", r._row, "Cancelled is greater than Total Number");
      if (!byNature.has(idx)) byNature.set(idx, []);
      const list = byNature.get(idx);
      list.push({ num: list.length + 1, from: str(r.from), to: str(r.to), totnum: total, cancel, net_issue: total - cancel });
    }
    if (byNature.size) out.doc_issue = { doc_det: [...byNature].sort((a, b) => a[0] - b[0]).map(([i, docs]) => ({ doc_num: i + 1, doc_typ: DOC_NATURE[i], docs })) };
  }

  // ---- ECO (14) ------------------------------------------------------------
  {
    const { rows } = get("eco");
    const clttx = [], paytx = [];
    for (const r of rows) {
      checkNums("eco", r, ["val", "igst", "cgst", "sgst", "cess"]);
      const etin = checkEtin("eco", r, r.etin, "GSTIN of E-Commerce Operator");
      const o = { etin, suppval: r2(num(r.val)), igst: r2(num(r.igst)), cgst: r2(num(r.cgst)), sgst: r2(num(r.sgst)), cess: r2(num(r.cess)) };
      (/9\(5\)/.test(str(r.nature)) ? paytx : clttx).push(o);
    }
    if (clttx.length || paytx.length) out.supeco = { ...(clttx.length ? { clttx } : {}), ...(paytx.length ? { paytx } : {}) };
  }

  // ======================= AMENDMENTS =======================================
  // ---- B2BA ----
  {
    const { rows } = get("b2ba");
    const byCtin = new Map();
    for (const r of rows) {
      const ctin = checkGstin("b2ba", r, r.ctin);
      const oinum = checkNo("b2ba", r, r.oinum, "Original invoice number");
      const inum = checkNo("b2ba", r, r.inum, "Revised invoice number");
      const pos = checkPos("b2ba", r, r.pos);
      const rt = checkLine("b2ba", r);
      if (!byCtin.has(ctin)) byCtin.set(ctin, new Map());
      const invs = byCtin.get(ctin);
      const k = oinum + "|" + inum;
      let inv = invs.get(k);
      if (!inv) {
        inv = {
          oinum, oidt: checkDate("b2ba", r, r.oidt, "Original invoice date"), inum, idt: checkDate("b2ba", r, r.idt, "Revised invoice date"),
          val: r2(num(r.val)), pos, rchrg: str(r.rchrg).toUpperCase() === "Y" ? "Y" : "N", inv_typ: invTyp(r.invtyp), _items: new Map(),
        };
        const etin = optEtin(r, r.etin); if (etin) inv.etin = etin;
        const d = diffPct(r.diff); if (d !== undefined) inv.diff_percent = d;
        invs.set(k, inv);
      }
      addItem(inv._items, tax(num(r.txval), rt, pos, num(r.cess), ["SEWP", "SEWOP"].includes(inv.inv_typ), inv.diff_percent ?? 1, inv.inv_typ === "SEWOP"));
    }
    if (byCtin.size) out.b2ba = [...byCtin].map(([ctin, invs]) => ({
      ctin, inv: [...invs.values()].map(({ _items, ...inv }) => ({ ...inv, itms: itmsOf(_items) })),
    }));
  }
  // ---- B2CLA ----
  {
    const { rows } = get("b2cla");
    const byPos = new Map();
    for (const r of rows) {
      const opos = checkPos("b2cla", r, r.opos);
      const oinum = checkNo("b2cla", r, r.oinum, "Original invoice number");
      const inum = checkNo("b2cla", r, r.inum, "Revised invoice number");
      const rt = checkLine("b2cla", r);
      if (!byPos.has(opos)) byPos.set(opos, new Map());
      const invs = byPos.get(opos);
      const k = oinum + "|" + inum;
      let inv = invs.get(k);
      if (!inv) {
        inv = { oinum, oidt: checkDate("b2cla", r, r.oidt, "Original invoice date"), inum, idt: checkDate("b2cla", r, r.idt, "Revised invoice date"), val: r2(num(r.val)), _items: new Map() };
        const etin = optEtin(r, r.etin); if (etin) inv.etin = etin;
        const d = diffPct(r.diff); if (d !== undefined) inv.diff_percent = d;
        invs.set(k, inv);
      }
      addItem(inv._items, tax(num(r.txval), rt, opos, num(r.cess), true, inv.diff_percent ?? 1));
    }
    if (byPos.size) out.b2cla = [...byPos].map(([pos, invs]) => ({
      pos, inv: [...invs.values()].map(({ _items, ...inv }) => ({ ...inv, itms: itmsOf(_items) })),
    }));
  }
  // ---- B2CSA ----
  {
    const { rows } = get("b2csa");
    const map = new Map();
    let dups = 0;
    for (const r of rows) {
      if (!["OE", "E"].includes(str(r.typ).toUpperCase())) {
        err("b2csa", r._row, `Type "${r.typ}" must be OE or E`);
        continue;
      }
      const omon = origMonth(r.fy, r.omon);
      if (!omon) err("b2csa", r._row, `Financial Year/Original Month "${r.fy}"/"${r.omon}" is not valid`);
      const pos = checkPos("b2csa", r, r.pos);
      const rt = checkLine("b2csa", r);
      const typ = str(r.typ).toUpperCase();
      const etin = typ === "E" ? checkEtin("b2csa", r, r.etin, "E-Commerce GSTIN (required for type E)") : "";
      const sply = pos === home && !sez ? "INTRA" : "INTER";
      const d = diffPct(r.diff);
      const key = [omon, sply, pos, typ, etin].join("|");
      if (!map.has(key)) map.set(key, { head: { omon, sply_ty: sply, typ, pos, ...(etin ? { etin } : {}), ...(d !== undefined ? { diff_percent: d } : {}) }, items: new Map() });
      const g = map.get(key);
      const det = tax(num(r.txval), rt, pos, num(r.cess), false, d ?? 1);
      const ik = String(rt);
      if (g.items.has(ik)) { dups++; if (sumDuplicates) addInto(g.items.get(ik), det); else g.items.set(ik, det); }
      else g.items.set(ik, det);
    }
    if (dups) warnings.push(`b2csa: ${dups} row(s) repeat an earlier month + POS + rate. ${sumDuplicates ? "They were added together." : 'The last row was kept (as the offline tool does). Remove duplicateMode:"last" to add them up instead.'}`);
    if (map.size) out.b2csa = [...map.values()].map((g) => ({ ...g.head, itms: [...g.items.values()] }));
  }
  // ---- CDNRA ----
  {
    const { rows } = get("cdnra");
    const byCtin = new Map();
    for (const r of rows) {
      const ctin = checkGstin("cdnra", r, r.ctin);
      const onum = checkNo("cdnra", r, r.onum, "Original note number");
      const nnum = checkNo("cdnra", r, r.num, "Revised note number");
      const pos = checkPos("cdnra", r, r.pos);
      const rt = checkLine("cdnra", r);
      const ntty = checkNote("cdnra", r, r.ntty);
      if (!byCtin.has(ctin)) byCtin.set(ctin, new Map());
      const notes = byCtin.get(ctin);
      const k = ntty + "|" + onum + "|" + nnum;
      let n = notes.get(k);
      if (!n) {
        n = {
          ntty, ont_num: onum, ont_dt: checkDate("cdnra", r, r.odt, "Original note date"), nt_num: nnum, nt_dt: checkDate("cdnra", r, r.dt, "Revised note date"),
          val: r2(num(r.val)), pos, rchrg: str(r.rchrg).toUpperCase() === "Y" ? "Y" : "N", inv_typ: invTyp(r.suptyp), _items: new Map(),
        };
        const d = diffPct(r.diff); if (d !== undefined) n.diff_percent = d;
        notes.set(k, n);
      }
      addItem(n._items, tax(num(r.txval), rt, pos, num(r.cess), ["SEWP", "SEWOP"].includes(n.inv_typ), n.diff_percent ?? 1, n.inv_typ === "SEWOP"));
    }
    if (byCtin.size) out.cdnra = [...byCtin].map(([ctin, notes]) => ({
      ctin, nt: [...notes.values()].map(({ _items, ...n }) => ({ ...n, itms: itmsOf(_items) })),
    }));
  }
  // ---- CDNURA ----
  {
    const { rows } = get("cdnura");
    const notes = new Map();
    for (const r of rows) {
      const typ = str(r.urtyp).toUpperCase();
      if (!["B2CL", "EXPWP", "EXPWOP"].includes(typ)) err("cdnura", r._row, `UR Type "${r.urtyp}" must be B2CL, EXPWP or EXPWOP`);
      const onum = checkNo("cdnura", r, r.onum, "Original note number");
      const nnum = checkNo("cdnura", r, r.num, "Revised note number");
      const ntty = checkNote("cdnura", r, r.ntty);
      const rt = checkLine("cdnura", r);
      const pos = typ === "B2CL" ? checkPos("cdnura", r, r.pos) : posCode(r.pos);
      const k = ntty + "|" + onum + "|" + nnum;
      let n = notes.get(k);
      if (!n) {
        n = { typ, ntty, ont_num: onum, ont_dt: checkDate("cdnura", r, r.odt, "Original note date"), nt_num: nnum, nt_dt: checkDate("cdnura", r, r.dt, "Revised note date"), val: r2(num(r.val)), _items: new Map() };
        if (pos) n.pos = pos;
        const d = diffPct(r.diff); if (d !== undefined) n.diff_percent = d;
        notes.set(k, n);
      }
      addItem(n._items, tax(num(r.txval), rt, pos, num(r.cess), true, n.diff_percent ?? 1, typ === "EXPWOP"));
    }
    if (notes.size) out.cdnura = [...notes.values()].map(({ _items, ...n }) => ({ ...n, itms: itmsOf(_items) }));
  }
  // ---- EXPA ----
  {
    const { rows } = get("expa");
    const byTyp = new Map();
    for (const r of rows) {
      const typ = str(r.exptyp).toUpperCase();
      if (!["WPAY", "WOPAY"].includes(typ)) err("expa", r._row, `Export Type "${r.exptyp}" must be WPAY or WOPAY`);
      const oinum = checkNo("expa", r, r.oinum, "Original invoice number");
      const inum = checkNo("expa", r, r.inum, "Revised invoice number");
      const rt = checkLine("expa", r);
      if (!byTyp.has(typ)) byTyp.set(typ, new Map());
      const invs = byTyp.get(typ);
      const k = oinum + "|" + inum;
      let inv = invs.get(k);
      if (!inv) {
        inv = { oinum, oidt: checkDate("expa", r, r.oidt, "Original invoice date"), inum, idt: checkDate("expa", r, r.idt, "Revised invoice date"), val: r2(num(r.val)), _items: new Map() };
        const pc = str(r.port); if (pc) inv.sbpcode = pc;
        const sn = str(r.sbnum); if (sn) inv.sbnum = sn;
        const sd = optDate("expa", r, r.sbdt, "Shipping bill date"); if (sd) inv.sbdt = sd;
        invs.set(k, inv);
      }
      const t = tax(num(r.txval), rt, "", num(r.cess), true);
      addItem(inv._items, { txval: t.txval, rt, iamt: typ === "WOPAY" ? 0 : t.iamt, csamt: t.csamt });
    }
    if (byTyp.size) out.expa = [...byTyp].map(([exp_typ, invs]) => ({ exp_typ, inv: [...invs.values()].map(({ _items, ...inv }) => ({ ...inv, itms: [..._items.values()] })) }));
  }
  // ---- ATA / TXPDA ----
  const advanceAmend = (key, outKey) => {
    const { rows } = get(key);
    const map = new Map();
    for (const r of rows) {
      const omon = origMonth(r.fy, r.omon);
      if (!omon) err(key, r._row, `Financial Year/Original Month "${r.fy}"/"${r.omon}" is not valid`);
      const pos = checkPos(key, r, r.pos);
      const rt = checkLine(key, r);
      const sply = pos === home && !sez ? "INTRA" : "INTER";
      const d = diffPct(r.diff);
      const gk = [omon, pos, d ?? ""].join("|");
      if (!map.has(gk)) map.set(gk, { omon, pos, sply_ty: sply, ...(d !== undefined ? { diff_percent: d } : {}), _items: new Map() });
      const amt = num(r.amt), f = d ?? 1;
      addItem(map.get(gk)._items, { rt, ad_amt: r2(amt), ...(sply === "INTER" ? { iamt: r2((amt * rt * f) / 100) } : { camt: r2((amt * rt * f) / 200), samt: r2((amt * rt * f) / 200) }), csamt: r2(num(r.cess)) });
    }
    if (map.size) out[outKey] = [...map.values()].map(({ _items, ...g }) => ({ ...g, itms: [..._items.values()] }));
  };
  advanceAmend("ata", "ata");
  advanceAmend("atadja", "txpda");
  // ---- ECOA (supecoa) ----
  {
    const { rows } = get("ecoa");
    const clttxa = [], paytxa = [];
    for (const r of rows) {
      const omon = origMonth(r.fy, r.omon);
      if (!omon) err("ecoa", r._row, `Financial Year/Original Month "${r.fy}"/"${r.omon}" is not valid`);
      checkNums("ecoa", r, ["val", "igst", "cgst", "sgst", "cess"]);
      const oetin = checkEtin("ecoa", r, r.oetin, "Original GSTIN of E-Commerce Operator");
      const etin = checkEtin("ecoa", r, r.retin, "Revised GSTIN of E-Commerce Operator");
      const o = { omon, oetin, etin, suppval: r2(num(r.val)), igst: r2(num(r.igst)), cgst: r2(num(r.cgst)), sgst: r2(num(r.sgst)), cess: r2(num(r.cess)) };
      (/9\(5\)/.test(str(r.nature)) ? paytxa : clttxa).push(o);
    }
    if (clttxa.length || paytxa.length) out.supecoa = { ...(clttxa.length ? { clttxa } : {}), ...(paytxa.length ? { paytxa } : {}) };
  }

  // ======================= SECTION 9(5) -- ecom / ecoma ======================
  const DOC_TYPE = { regular: "R", "deemed exp": "DE", "sez supplies with payment": "SEWP", "sez supplies without payment": "SEWOP" };
  const docTyp = (v) => DOC_TYPE[str(v).toLowerCase()] || "R";
  // tax split for 9(5) lines: intra when place of supply = taxpayer's state
  const ecoTax = (txval, rt, pos, cess, dt = "R") => {
    const intra = pos === home && !sez && !["SEWP", "SEWOP"].includes(dt);
    const total = dt === "SEWOP" ? 0 : (txval * rt) / 100;
    return { sply: intra ? "INTRA" : "INTER", det: intra ? { txval: r2(txval), rt, camt: r2(total / 2), samt: r2(total / 2), csamt: r2(cess) } : { txval: r2(txval), rt, iamt: r2(total), csamt: r2(cess) } };
  };
  // group document rows: parent key -> docs by number
  const ecoDocs = (sheetKey, { parent, doc }) => {
    const { rows } = get(sheetKey);
    const parents = new Map();
    for (const r of rows) {
      const p = parent(r); const pk = JSON.stringify(p.key);
      if (!parents.has(pk)) parents.set(pk, { head: p.head, docs: new Map() });
      const g = parents.get(pk);
      const d = doc(r); const dk = d.key;
      if (!g.docs.has(dk)) g.docs.set(dk, { ...d.head, _items: new Map() });
      addItem(g.docs.get(dk)._items, d.det);
    }
    return [...parents.values()].map((g) => ({ ...g.head, inv: [...g.docs.values()].map(({ _items, ...x }) => ({ ...x, itms: itmsOf(_items), flag: "N" })) }));
  };
  const ecom = {}, ecoma = {};
  // ecob2b: supplier + recipient registered
  const b2bRows = ecoDocs("ecob2b", {
    parent: (r) => { const stin = checkGstin("ecob2b", r, r.stin, "Supplier GSTIN/UIN"), rtin = checkGstin("ecob2b", r, r.rtin); return { key: [stin, rtin], head: { stin, rtin } }; },
    doc: (r) => { const pos = checkPos("ecob2b", r, r.pos), rt = checkLine("ecob2b", r), dt = docTyp(r.dtyp), t = ecoTax(num(r.txval), rt, pos, num(r.cess), dt);
      return { key: checkNo("ecob2b", r, r.dnum, "Document number"), head: { sply_ty: t.sply, inum: str(r.dnum), idt: checkDate("ecob2b", r, r.ddt, "Document date"), val: r2(num(r.val)), pos, inv_typ: dt }, det: t.det }; },
  });
  if (b2bRows.length) ecom.b2b = b2bRows;
  const urp2b = ecoDocs("ecourp2b", {
    parent: (r) => { const rtin = checkGstin("ecourp2b", r, r.rtin); return { key: [rtin], head: { rtin } }; },
    doc: (r) => { const pos = checkPos("ecourp2b", r, r.pos), rt = checkLine("ecourp2b", r), dt = docTyp(r.dtyp), t = ecoTax(num(r.txval), rt, pos, num(r.cess), dt);
      return { key: checkNo("ecourp2b", r, r.dnum, "Document number"), head: { sply_ty: t.sply, inum: str(r.dnum), idt: checkDate("ecourp2b", r, r.ddt, "Document date"), val: r2(num(r.val)), pos, inv_typ: dt }, det: t.det }; },
  });
  if (urp2b.length) ecom.urp2b = urp2b;
  // B2C-type flat rows (portal keeps tax amounts for all three heads, zero where not applicable)
  const flatC = (sheetKey, withStin) => {
    const { rows } = get(sheetKey); const m = new Map();
    for (const r of rows) {
      const pos = checkPos(sheetKey, r, r.pos), rt = checkLine(sheetKey, r), stin = withStin ? checkGstin(sheetKey, r, r.stin, "Supplier GSTIN/UIN") : "";
      const t = ecoTax(num(r.txval), rt, pos, num(r.cess)); const k = [stin, pos, rt].join("|");
      const full = { txval: t.det.txval, rt, csamt: t.det.csamt, sply_ty: t.sply, camt: t.det.camt ?? 0, samt: t.det.samt ?? 0, iamt: t.det.iamt ?? 0, flag: "N" };
      if (m.has(k)) { const e = m.get(k); for (const f of ["txval", "csamt", "camt", "samt", "iamt"]) e[f] = r2(e[f] + full[f]); }
      else m.set(k, withStin ? { stin, pos, ...full } : { pos, ...full });
    }
    return [...m.values()];
  };
  const b2cRows = flatC("ecob2c", true); if (b2cRows.length) ecom.b2c = b2cRows;
  const urp2c = flatC("ecourp2c", false); if (urp2c.length) ecom.urp2c = urp2c;
  if (Object.keys(ecom).length) out.ecom = ecom;

  // amendments
  const b2baRows = ecoDocs("ecoab2b", {
    parent: (r) => { const stin = checkGstin("ecoab2b", r, r.stin, "Supplier GSTIN/UIN"), rtin = checkGstin("ecoab2b", r, r.rtin); return { key: [stin, rtin], head: { stin, rtin } }; },
    doc: (r) => { const pos = checkPos("ecoab2b", r, r.pos), rt = checkLine("ecoab2b", r), dt = docTyp(r.dtyp), t = ecoTax(num(r.txval), rt, pos, num(r.cess), dt);
      return { key: checkNo("ecoab2b", r, r.odnum, "Original document number") + "|" + checkNo("ecoab2b", r, r.dnum, "Revised document number"),
        head: { sply_ty: t.sply, oinum: str(r.odnum), oidt: checkDate("ecoab2b", r, r.oddt, "Original document date"), inum: str(r.dnum), idt: checkDate("ecoab2b", r, r.ddt, "Revised document date"), val: r2(num(r.val)), pos, inv_typ: dt }, det: t.det }; },
  });
  if (b2baRows.length) ecoma.b2ba = b2baRows;
  const urp2ba = ecoDocs("ecoaurp2b", {
    parent: (r) => { const rtin = checkGstin("ecoaurp2b", r, r.rtin); return { key: [rtin], head: { rtin } }; },
    doc: (r) => { const pos = checkPos("ecoaurp2b", r, r.pos), rt = checkLine("ecoaurp2b", r), dt = docTyp(r.dtyp), t = ecoTax(num(r.txval), rt, pos, num(r.cess), dt);
      return { key: checkNo("ecoaurp2b", r, r.odnum, "Original document number") + "|" + checkNo("ecoaurp2b", r, r.dnum, "Revised document number"),
        head: { inum: str(r.dnum), idt: checkDate("ecoaurp2b", r, r.ddt, "Revised document date"), oinum: str(r.odnum), oidt: checkDate("ecoaurp2b", r, r.oddt, "Original document date"), val: r2(num(r.val)), pos, inv_typ: dt, sply_ty: t.sply }, det: t.det }; },
  });
  if (urp2ba.length) ecoma.urp2ba = urp2ba;
  {
    // ecoma.b2ca: the portal file has one { pos, posItms:[ one entry ] } per supplier/month/POS (POS is NOT merged across suppliers).
    // The portal's optional "ostin" (original supplier GSTIN) is read from the optional "ostin" column (last column of the
    // ecoab2c sheet). If that cell is blank, opts.ostin = { "<stin>": "<ostin>" } is used as a fallback; if neither is given
    // the key is left out. A value equal to the supplier GSTIN is kept as entered (the offline tool exports it that way).
    const { rows } = get("ecoab2c"); const m = new Map();
    for (const r of rows) {
      const pos = checkPos("ecoab2c", r, r.pos), rt = checkLine("ecoab2c", r), stin = checkGstin("ecoab2c", r, r.stin, "Supplier GSTIN/UIN");
      const omon = origMonth(r.fy, r.omon); if (!omon) err("ecoab2c", r._row, `Financial Year/Original Month "${r.fy}"/"${r.omon}" is not valid`);
      const t = ecoTax(num(r.txval), rt, pos, num(r.cess));
      const ostin = isBlank(r.ostin) ? gstinTxt(opts.ostin?.[stin]) : checkGstin("ecoab2c", r, r.ostin, "Original supplier GSTIN/UIN");
      const k = [pos, omon, stin, ostin].join("|");
      if (!m.has(k)) m.set(k, { pos, sply_ty: t.sply, omon, stin, ostin, _items: new Map() });
      addItem(m.get(k)._items, t.det);
    }
    if (m.size) ecoma.b2ca = [...m.values()].map(({ pos, sply_ty, omon, stin, ostin, _items }) => ({
      pos,
      posItms: [{ sply_ty, omon, stin, itms: [..._items.values()].map((d) => ({ rt: d.rt, ...d })), flag: "N", ...(ostin ? { ostin } : {}) }],
    }));
  }
  {
    const { rows } = get("ecoaurp2c"); const m = new Map();
    for (const r of rows) {
      const pos = checkPos("ecoaurp2c", r, r.pos), rt = checkLine("ecoaurp2c", r);
      const omon = origMonth(r.fy, r.omon); if (!omon) err("ecoaurp2c", r._row, `Financial Year/Original Month "${r.fy}"/"${r.omon}" is not valid`);
      const t = ecoTax(num(r.txval), rt, pos, num(r.cess)); const k = [omon, pos].join("|");
      if (!m.has(k)) m.set(k, { sply_ty: t.sply, omon, pos, _items: new Map() });
      addItem(m.get(k)._items, t.det);
    }
    if (m.size) ecoma.urp2ca = [...m.values()].map(({ _items, ...g }) => ({ ...g, flag: "N", itms: [..._items.values()].map((d) => ({ rt: d.rt, ...d })) }));
  }
  if (Object.keys(ecoma).length) out.ecoma = ecoma;

  // Quarterly filer, month that is not a quarter end (Jan/Feb, Apr/May, Jul/Aug, Oct/Nov) => IFF: only B2B, B2BA, CDNR, CDNRA and 9(5) B2B-type tables
  const isIff = quarterly && Number(fp.slice(0, 2)) % 3 !== 0;
  if (isIff) {
    const allowed = ["b2b", "b2ba", "cdnr", "cdnra"];
    const extra = Object.keys(out).filter((k) => !["gstin", "fp", "gt", "cur_gt", "version", "hash", ...allowed].includes(k)
      && !(k === "ecom" && Object.keys(out.ecom).every((x) => ["b2b", "urp2b"].includes(x)))
      && !(k === "ecoma" && Object.keys(out.ecoma).every((x) => ["b2ba", "urp2ba"].includes(x))));
    if (extra.length) errors.push(`Quarterly filer, ${fp.slice(0, 2)}/${fp.slice(2)} is an IFF month: only B2B, B2BA, CDNR, CDNRA (and 9(5) B2B-type) data is allowed, but these sections have data: ${extra.join(", ")}. Clear them or change the Company Info answers.`);
  }
  if (!Object.keys(out).some((k) => !["gstin", "fp", "gt", "cur_gt", "version", "hash"].includes(k))) warnings.push("No data rows found in any sheet; JSON contains only the header.");

  // Final safety net: no null / "" / undefined / NaN anywhere, no empty tables; every string is single-line. Zero is kept.
  const prune = (v, path) => {
    if (Array.isArray(v)) { const a = v.map((x, i) => prune(x, `${path}[${i}]`)).filter((x) => x !== undefined); return a.length ? a : undefined; }
    if (v && typeof v === "object") {
      const o = {};
      for (const [k, x] of Object.entries(v)) { const p = prune(x, `${path}.${k}`); if (p !== undefined) o[k] = p; }
      return Object.keys(o).length ? o : undefined;
    }
    if (typeof v === "number" && !Number.isFinite(v)) { errors.push(`${path} is not a valid number`); return undefined; }
    if (typeof v === "string") { const c = clean(v); return c === "" ? undefined : c; }
    if (v === null || v === undefined) return undefined;
    return v;
  };
  const cleaned = prune(out, "json") || {};

  // Emit top-level keys in the same order as the portal / offline-tool JSON.
  const ORDER = ["gstin", "fp", "gt", "cur_gt", "version", "hash", "b2b", "b2ba", "b2cl", "b2cla", "b2cs", "b2csa", "cdnr", "cdnra", "cdnur", "cdnura", "exp", "expa", "nil", "at", "ata", "doc_issue", "hsn", "supeco", "supecoa", "ecom", "ecoma", "txpd", "txpda"];
  const ordered = {};
  for (const k of ORDER) if (k in cleaned) ordered[k] = cleaned[k];
  for (const k of Object.keys(cleaned)) if (!(k in ordered)) ordered[k] = cleaned[k];

  // Portal / offline-tool files are MINIFIED, single-line JSON (no indentation, no line breaks between keys).
  // Save/download `text` (not JSON.stringify(json, null, 2)) so the file has the same layout as the portal's.
  // fileName: save/download the file under THIS name so the offline tool picks up GSTIN and return type correctly.
  return { json: ordered, text: toPortalText(ordered), fileName: gstr1PortalFileName(gstin, opts.fileDate, fp), warnings, errors };
}

// The popup is a classic script, so expose the converter deliberately rather
// than relying on ES-module imports at click time.
globalThis.gstr1ExcelToJson = gstr1ExcelToJson;
globalThis.gstr1ToPortalText = toPortalText;
globalThis.gstr1PortalFileName = gstr1PortalFileName;
globalThis.gstr1DownloadJson = gstr1DownloadJson;

// ---- Tool registration (same shape as the original GSTR-1-Excel-to-JSON.js) ----
export default {
  category: "preparation",
  key: "GSTR1_EXCEL_JSON",
  listed: true,
  order: 0,
  config: {
    key: "GSTR1_EXCEL_JSON",
    display: "GSTR-1 Excel to JSON",
    tool: "gstr1ExcelToJson",
    handler: gstr1ExcelToJson, // (fileOrBuffer, { gstin, fp }) => { json, warnings, errors }
  },
};
