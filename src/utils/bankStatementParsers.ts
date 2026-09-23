/**
 * ProjectMatrix Bank Statement Parsers Utility
 * 
 * Strongly typed parser functions for bank statement imports:
 * - CSV
 * - OFX
 * - QBO
 * - MT940
 * - Manual Entry
 */

export interface ParsedBankStatementLine {
  line_number: number;
  transaction_date: string; // YYYY-MM-DD
  value_date?: string | null;
  bank_reference?: string | null;
  description: string;
  amount: number; // positive for deposits/credits, negative for withdrawals/debits
  balance_after?: number | null;
}

/**
 * Normalizes date string into YYYY-MM-DD format
 */
export function normalizeDate(rawDate: string): string {
  if (!rawDate) {
    throw new Error("Missing transaction date in statement row.");
  }
  const trimmed = rawDate.trim();

  // 1. YYYYMMDD or YYYYMMDDHHMMSS (OFX / QBO format e.g. 20260725120000[0:GMT])
  const ymdMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ymdMatch && !trimmed.includes('-') && !trimmed.includes('/')) {
    const [_, y, m, d] = ymdMatch;
    return `${y}-${m}-${d}`;
  }

  // 2. MT940 6-digit date YYMMDD (e.g. 260725 -> 2026-07-25)
  if (/^\d{6}$/.test(trimmed)) {
    const yy = parseInt(trimmed.slice(0, 2), 10);
    const mm = trimmed.slice(2, 4);
    const dd = trimmed.slice(4, 6);
    const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
    return `${yyyy}-${mm}-${dd}`;
  }

  // 3. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // 4. DD/MM/YYYY or MM/DD/YYYY or YYYY/MM/DD or DD-MM-YYYY
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    if (p1.length === 4) {
      // YYYY/MM/DD
      return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
    } else if (p3.length === 4) {
      // Assume DD/MM/YYYY
      return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
    }
  }

  const dObj = new Date(trimmed);
  if (!isNaN(dObj.getTime())) {
    return dObj.toISOString().slice(0, 10);
  }

  throw new Error(`Invalid transaction date format: "${rawDate}"`);
}

/**
 * Normalizes string or numeric amount into signed number
 */
export function parseAmountVal(rawVal: string | number): number {
  if (typeof rawVal === 'number') {
    if (isNaN(rawVal)) throw new Error("Invalid numeric amount");
    return rawVal;
  }
  if (!rawVal || typeof rawVal !== 'string') throw new Error("Empty amount value");

  let cleaned = rawVal.trim().replace(/[R$€\s]/g, '');

  let isNegative = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  }

  if (cleaned.endsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1);
  }

  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(/,/g, '.');
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    throw new Error(`Invalid numeric amount: "${rawVal}"`);
  }

  return isNegative ? -Math.abs(parsed) : parsed;
}

/**
 * Helper to parse a single CSV line with support for quoted values
 */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

/**
 * Parses CSV bank statement
 */
export function parseCsvStatement(fileContent: string): ParsedBankStatementLine[] {
  if (!fileContent || !fileContent.trim()) {
    throw new Error("CSV statement file is empty or contains no readable data.");
  }

  const rawLines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (rawLines.length === 0) {
    throw new Error("CSV statement file contains no data rows.");
  }

  // Parse header
  const headers = parseCsvRow(rawLines[0]).map(h => h.toLowerCase().trim());
  
  let dateIdx = -1;
  let valueDateIdx = -1;
  let descIdx = -1;
  let refIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;
  let amountIdx = -1;
  let balanceIdx = -1;

  headers.forEach((h, idx) => {
    if (h.includes('trans') && h.includes('date') || h === 'date' || h === 'txn date' || h === 'posting date') {
      if (dateIdx === -1) dateIdx = idx;
    } else if (h.includes('value') && h.includes('date') || h === 'val date') {
      if (valueDateIdx === -1) valueDateIdx = idx;
    } else if (h.includes('desc') || h.includes('memo') || h.includes('detail') || h.includes('payee') || h.includes('narration') || h.includes('particulars')) {
      if (descIdx === -1) descIdx = idx;
    } else if (h.includes('ref') || h.includes('fitid') || h.includes('code')) {
      if (refIdx === -1) refIdx = idx;
    } else if (h.includes('debit') || h.includes('paid out') || h.includes('withdrawal') || h === 'out') {
      if (debitIdx === -1) debitIdx = idx;
    } else if (h.includes('credit') || h.includes('paid in') || h.includes('deposit') || h === 'in') {
      if (creditIdx === -1) creditIdx = idx;
    } else if (h === 'amount' || h.includes('net amount') || h.includes('value')) {
      if (amountIdx === -1) amountIdx = idx;
    } else if (h.includes('balance')) {
      if (balanceIdx === -1) balanceIdx = idx;
    }
  });

  const hasDebitCredit = debitIdx !== -1 || creditIdx !== -1;
  const hasAmount = amountIdx !== -1;

  if (dateIdx === -1 || (!hasAmount && !hasDebitCredit)) {
    throw new Error("CSV statement header missing required columns. Header must include Date and either Amount or Debit/Credit columns.");
  }

  const parsedLines: ParsedBankStatementLine[] = [];
  let lineNumber = 1;

  for (let i = 1; i < rawLines.length; i++) {
    const row = parseCsvRow(rawLines[i]);
    if (row.length === 0 || row.every(cell => cell === '')) continue;

    const rawDate = row[dateIdx];
    if (!rawDate) continue; // Skip footer / empty row

    let txDate: string;
    try {
      txDate = normalizeDate(rawDate);
    } catch {
      continue; // Skip non-date rows (e.g., summary rows)
    }

    let valDate: string | null = null;
    if (valueDateIdx !== -1 && row[valueDateIdx]) {
      try { valDate = normalizeDate(row[valueDateIdx]); } catch { valDate = null; }
    }

    const desc = (descIdx !== -1 && row[descIdx]) ? row[descIdx] : "Statement Line";
    const ref = (refIdx !== -1 && row[refIdx]) ? row[refIdx] : null;

    let amount = 0;
    if (hasDebitCredit) {
      const debitStr = debitIdx !== -1 ? row[debitIdx] : '';
      const creditStr = creditIdx !== -1 ? row[creditIdx] : '';

      const debitVal = debitStr ? Math.abs(parseAmountVal(debitStr)) : 0;
      const creditVal = creditStr ? Math.abs(parseAmountVal(creditStr)) : 0;

      amount = creditVal - debitVal;
    } else {
      const amtStr = row[amountIdx];
      if (!amtStr) continue;
      amount = parseAmountVal(amtStr);
    }

    let balanceAfter: number | null = null;
    if (balanceIdx !== -1 && row[balanceIdx]) {
      try { balanceAfter = parseAmountVal(row[balanceIdx]); } catch { balanceAfter = null; }
    }

    parsedLines.push({
      line_number: lineNumber++,
      transaction_date: txDate,
      value_date: valDate,
      bank_reference: ref,
      description: desc,
      amount,
      balance_after: balanceAfter,
    });
  }

  if (parsedLines.length === 0) {
    throw new Error("No valid transaction rows could be extracted from the CSV file.");
  }

  return parsedLines;
}

/**
 * Parses OFX bank statement
 */
export function parseOfxStatement(fileContent: string): ParsedBankStatementLine[] {
  if (!fileContent || !fileContent.trim()) {
    throw new Error("OFX file is empty.");
  }

  if (!fileContent.toUpperCase().includes('<STMTTRN>')) {
    throw new Error("No valid OFX transaction blocks (<STMTTRN>) found in file.");
  }

  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|\r?\n(?=<STMTTRN|<BANKTRANSET|<\/BANKTRANSET|$))/gi;
  const parsedLines: ParsedBankStatementLine[] = [];
  let match: RegExpExecArray | null;
  let lineNumber = 1;

  while ((match = trnRegex.exec(fileContent)) !== null) {
    const block = match[1];

    const getTagVal = (tag: string): string => {
      const reg = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
      const m = reg.exec(block);
      return m ? m[1].trim() : '';
    };

    const rawDate = getTagVal('DTPOSTED');
    const rawValDate = getTagVal('DTUSER');
    const rawAmt = getTagVal('TRNAMT');
    const fitid = getTagVal('FITID') || getTagVal('CHECKNUM') || getTagVal('REFNUM');
    const name = getTagVal('NAME');
    const memo = getTagVal('MEMO');

    if (!rawDate || !rawAmt) continue;

    const txDate = normalizeDate(rawDate);
    const amount = parseAmountVal(rawAmt);
    let valDate: string | null = null;
    if (rawValDate) {
      try { valDate = normalizeDate(rawValDate); } catch { valDate = null; }
    }

    const description = [name, memo].filter(Boolean).join(' - ') || "OFX Transaction";

    parsedLines.push({
      line_number: lineNumber++,
      transaction_date: txDate,
      value_date: valDate,
      bank_reference: fitid || null,
      description,
      amount,
    });
  }

  if (parsedLines.length === 0) {
    throw new Error("Failed to extract valid transaction rows from the OFX file.");
  }

  return parsedLines;
}

/**
 * Parses QBO bank statement (Uses OFX specification format)
 */
export function parseQboStatement(fileContent: string): ParsedBankStatementLine[] {
  if (!fileContent || !fileContent.trim()) {
    throw new Error("QBO file is empty.");
  }

  try {
    return parseOfxStatement(fileContent);
  } catch (err: any) {
    throw new Error(`QBO Parsing Error: ${err.message}`);
  }
}

/**
 * Parses MT940 bank statement format
 */
export function parseMt940Statement(fileContent: string): ParsedBankStatementLine[] {
  if (!fileContent || !fileContent.trim()) {
    throw new Error("MT940 file is empty.");
  }

  const lines = fileContent.split(/\r?\n/).map(l => l.trim());
  const parsedLines: ParsedBankStatementLine[] = [];
  let lineNumber = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith(':61:')) {
      const tagContent = line.slice(4);
      // Format: YYMMDD [MMDD] C|D|RC|RD [F] Amount N Type Reference
      const m61 = tagContent.match(/^(\d{6})(\d{4})?(C|D|RC|RD)([A-Z]?)([\d,\.]+)(N[A-Z0-9]{3})(.*)/i);
      
      if (!m61) {
        // Fallback for simple :61: parser
        const simpleMatch = tagContent.match(/^(\d{6})(C|D|RC|RD)([\d,\.]+)/i);
        if (simpleMatch) {
          const [_, rawDate, dc, rawAmt] = simpleMatch;
          const txDate = normalizeDate(rawDate);
          const baseAmt = parseAmountVal(rawAmt);
          const isCredit = dc.toUpperCase().includes('C');
          const amount = isCredit ? Math.abs(baseAmt) : -Math.abs(baseAmt);

          let description = "MT940 Transaction";
          let ref: string | null = null;

          if (i + 1 < lines.length && lines[i + 1].startsWith(':86:')) {
            description = lines[i + 1].slice(4).trim() || description;
          }

          parsedLines.push({
            line_number: lineNumber++,
            transaction_date: txDate,
            bank_reference: ref,
            description,
            amount,
          });
        }
        continue;
      }

      const [_, rawDate, __, dc, ___, rawAmt, ____, rest] = m61;
      const txDate = normalizeDate(rawDate);
      const baseAmt = parseAmountVal(rawAmt);
      const isCredit = dc.toUpperCase().includes('C');
      const amount = isCredit ? Math.abs(baseAmt) : -Math.abs(baseAmt);

      let description = rest.trim() || "MT940 Transaction";
      let ref: string | null = rest.trim() || null;

      if (i + 1 < lines.length && lines[i + 1].startsWith(':86:')) {
        description = lines[i + 1].slice(4).trim() || description;
      }

      parsedLines.push({
        line_number: lineNumber++,
        transaction_date: txDate,
        bank_reference: ref,
        description,
        amount,
      });
    }
  }

  if (parsedLines.length === 0) {
    throw new Error("Unable to parse MT940 format. No valid statement line (:61:) tags found.");
  }

  return parsedLines;
}

/**
 * Parses Manual statement entry
 */
export function parseManualStatement(values: {
  transaction_date: string;
  bank_reference?: string | null;
  description: string;
  amount: number;
}): ParsedBankStatementLine[] {
  if (!values.transaction_date) {
    throw new Error("Transaction date is required for manual statement entry.");
  }
  if (!values.description || !values.description.trim()) {
    throw new Error("Description is required for manual statement entry.");
  }
  if (typeof values.amount !== 'number' || isNaN(values.amount) || values.amount === 0) {
    throw new Error("A non-zero valid amount is required for manual statement entry.");
  }

  return [{
    line_number: 1,
    transaction_date: normalizeDate(values.transaction_date),
    bank_reference: values.bank_reference?.trim() || null,
    description: values.description.trim(),
    amount: values.amount,
  }];
}

/**
 * Main parser entry point dispatcher
 */
export async function parseBankStatementFile(
  fileOrContent: File | string,
  fileFormat: 'CSV' | 'OFX' | 'QBO' | 'MT940' | 'PDF' | 'Manual',
  manualValues?: { transaction_date: string; bank_reference?: string; description: string; amount: number }
): Promise<ParsedBankStatementLine[]> {
  if (fileFormat === 'PDF') {
    throw new Error("PDF files cannot be automatically parsed into structured statement lines. Please upload CSV, OFX, QBO, or MT940 files, or enter transactions manually. PDF statements may be attached as supporting documents.");
  }

  if (fileFormat === 'Manual') {
    if (!manualValues) {
      throw new Error("Manual statement values must be provided.");
    }
    return parseManualStatement(manualValues);
  }

  let textContent = '';
  if (typeof fileOrContent === 'string') {
    textContent = fileOrContent;
  } else if (fileOrContent instanceof File) {
    if (fileOrContent.name.toLowerCase().endsWith('.pdf')) {
      throw new Error("PDF files cannot be automatically parsed into structured statement lines. Please upload CSV, OFX, QBO, or MT940 files.");
    }
    textContent = await fileOrContent.text();
  } else {
    throw new Error("Invalid file or file content provided for statement parsing.");
  }

  switch (fileFormat) {
    case 'CSV':
      return parseCsvStatement(textContent);
    case 'OFX':
      return parseOfxStatement(textContent);
    case 'QBO':
      return parseQboStatement(textContent);
    case 'MT940':
      return parseMt940Statement(textContent);
    default:
      throw new Error(`Unsupported statement file format: ${fileFormat}`);
  }
}
