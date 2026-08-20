import * as XLSX from "xlsx";

/** Read every non-empty cell value of the first column-ish content of a sheet/txt/csv file. */
export async function readRowsFromFile(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt")) {
    const text = await file.text();
    return splitLines(text);
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  const out: string[] = [];
  for (const row of rows) {
    const cell = (row ?? []).map((c) => (c == null ? "" : String(c).trim())).find((c) => c !== "");
    if (cell) out.push(cell);
  }
  // drop an obvious header row
  if (out.length > 1 && /^(comment|feedback|statement|category|categories|text|review)s?$/i.test(out[0]!)) {
    out.shift();
  }
  return out;
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function toCsv(rows: (string | number | boolean)[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
