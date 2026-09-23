/**
 * Universal CSV Export Utility for ProjectMatrix
 * Produces standards-compliant CSV with UTF-8 BOM encoding for seamless
 * compatibility with Microsoft Excel, Google Sheets, and Apple Numbers.
 */

export interface CsvColumn<T = any> {
  key: keyof T | string;
  label: string;
  formatter?: (value: any, row: T) => string | number | boolean | null | undefined;
}

/**
 * Safely escapes a single value for CSV output according to RFC 4180.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return "";
  }
  const str = String(val);
  // If string contains comma, quote, newline, or carriage return, enclose in quotes and double internal quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Triggers a browser download of a CSV file.
 * Automatically prepends the UTF-8 Byte Order Mark (\uFEFF) so Excel opens it with proper encoding.
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  // UTF-8 BOM prevents Excel from displaying garbled characters or dropping accents/symbols
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  // Clean filename: remove illegal characters and append .csv if missing
  const cleanBase = filename.replace(/[/\\?%*:|"<>]/g, "_").trim();
  const finalFilename = cleanBase.toLowerCase().endsWith(".csv") ? cleanBase : `${cleanBase}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", finalFilename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Revoke object URL after delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Exports an array of objects to CSV given column definitions.
 */
export function exportObjectsToCsv<T = any>(
  filename: string,
  columns: CsvColumn<T>[],
  data: T[]
): void {
  const headers = columns.map((col) => escapeCsvValue(col.label)).join(",");
  
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        let val: any;
        if (typeof col.key === "string" && col.key.includes(".")) {
          // Support dot-notation keys (e.g. "client.name")
          val = col.key.split(".").reduce((acc: any, part) => acc?.[part], item);
        } else {
          val = (item as any)[col.key];
        }

        if (col.formatter) {
          val = col.formatter(val, item);
        }

        return escapeCsvValue(val);
      })
      .join(",");
  });

  const csvContent = [headers, ...rows].join("\r\n");
  downloadCsvFile(filename, csvContent);
}

/**
 * Exports raw headers and rows directly to CSV.
 */
export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(","));
  const csvContent = [headerLine, ...dataLines].join("\r\n");
  downloadCsvFile(filename, csvContent);
}
