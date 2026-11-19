import ExcelJS from "exceljs";

function cellText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    if (value.text) return String(value.text);
    if (value.richText) return value.richText.map((p) => p.text || "").join("");
    if (value.result != null) return String(value.result);
    if (value.hyperlink) return String(value.text || value.hyperlink);
  }
  return String(value);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Parse an uploaded .xlsx or .csv into an array of row arrays (header first).
 * Old binary .xls is not supported.
 */
export async function parseSpreadsheetBuffer(buffer, filename = "") {
  const name = String(filename || "").toLowerCase();
  const bytes = Buffer.from(buffer);

  if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
    throw new Error("Old .xls files are not supported. Save the file as .xlsx or .csv and upload again.");
  }

  if (name.endsWith(".csv") || looksLikeCsv(bytes)) {
    return parseCsv(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const data = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = [];
    const max = row.cellCount;
    for (let i = 1; i <= max; i++) {
      values.push(cellText(row.getCell(i).value));
    }
    data.push(values);
  });
  return data;
}

function looksLikeCsv(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return false; // zip/xlsx
  const sample = bytes.subarray(0, 256).toString("utf8");
  return sample.includes(",") && !sample.includes("\0");
}
