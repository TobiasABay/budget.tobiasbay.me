/**
 * Client-side bank CSV parse + monthly rollup for budget reconcile (Phase A).
 * Supports common Danish exports: `;` or `,` delimiter, decimal comma/dot, DD-MM-YYYY dates.
 * Data never leaves the browser.
 */

import { BUDGET_MONTHS } from './budgetMath';

export type BankTransaction = {
  date: Date;
  amount: number;
  description: string;
};

export type BankMonthRollup = {
  monthIndex: number;
  month: string;
  /** Sum of positive amounts (credits / income) */
  income: number;
  /** Sum of absolute negative amounts (debits / spending) */
  expense: number;
  count: number;
};

export type ParseBankCsvResult = {
  delimiter: string;
  headers: string[];
  mapping: { dateIdx: number; amountIdx: number; descIdx: number | null };
  transactions: BankTransaction[];
  skippedRows: number;
  warnings: string[];
};

const DATE_HEADER_RE = /^(dato|date|bogf[øo]rt|booking\s*date|value\s*date|posted|transaktionsdato|valuedato)$/i;
const AMOUNT_HEADER_RE = /^(bel[øo]b|amount|sum|bel[øo]b\s*\(?dkk\)?|amount\s*\(?dkk\)?|posteringsbel[øo]b)$/i;
const DESC_HEADER_RE =
  /^(tekst|text|beskrivelse|description|navn|name|meddelelse|merchant|modtager|afsender|comment|bem[æa]rkning)$/i;

function detectDelimiter(firstLine: string): string {
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs >= semis && tabs >= commas && tabs > 0) return '\t';
  if (semis >= commas) return ';';
  return ',';
}

/** Split a CSV line respecting double quotes. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.map((c) => c.replace(/^"|"$/g, '').trim());
}

export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === '-' || s === '–') return null;
  s = s.replace(/\s/g, '').replace(/kr\.?/gi, '').replace(/DKK/gi, '');
  // (1.234,56) accounting negative
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('-') || s.startsWith('−')) {
    neg = true;
    s = s.slice(1);
  }
  // Danish: 1.234,56 or 1234,56
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s) || /^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) {
    // US: 1,234.56
    s = s.replace(/,/g, '');
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

export function parseBankDate(raw: string): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // YYYY-MM-DD or YYYY/MM/DD
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  // YYYYMMDD
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  // DDMMYYYY
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(s);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function findColumnIndex(headers: string[], re: RegExp): number {
  const normalized = headers.map((h) => h.trim());
  const exact = normalized.findIndex((h) => re.test(h));
  if (exact >= 0) return exact;
  return normalized.findIndex((h) => re.test(h.replace(/\s+/g, ' ')));
}

function scoreDateColumn(rows: string[][], col: number): number {
  let ok = 0;
  const sample = rows.slice(0, 30);
  for (const r of sample) {
    if (parseBankDate(r[col] || '')) ok++;
  }
  return ok;
}

function scoreAmountColumn(rows: string[][], col: number): number {
  let ok = 0;
  const sample = rows.slice(0, 30);
  for (const r of sample) {
    if (parseAmount(r[col] || '') != null) ok++;
  }
  return ok;
}

export function detectColumnMapping(
  headers: string[],
  rows: string[][]
): { dateIdx: number; amountIdx: number; descIdx: number | null; warnings: string[] } {
  const warnings: string[] = [];
  let dateIdx = findColumnIndex(headers, DATE_HEADER_RE);
  let amountIdx = findColumnIndex(headers, AMOUNT_HEADER_RE);
  let descIdx = findColumnIndex(headers, DESC_HEADER_RE);

  if (dateIdx < 0 && rows.length) {
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < (rows[0]?.length || 0); c++) {
      const sc = scoreDateColumn(rows, c);
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    if (bestScore >= Math.min(3, rows.length)) {
      dateIdx = best;
      warnings.push(`Date column auto-detected as column ${best + 1} (no matching header).`);
    }
  }

  if (amountIdx < 0 && rows.length) {
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < (rows[0]?.length || 0); c++) {
      if (c === dateIdx) continue;
      const sc = scoreAmountColumn(rows, c);
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    if (bestScore >= Math.min(3, rows.length)) {
      amountIdx = best;
      warnings.push(`Amount column auto-detected as column ${best + 1} (no matching header).`);
    }
  }

  if (descIdx < 0) {
    descIdx = headers.findIndex((_, i) => i !== dateIdx && i !== amountIdx);
    if (descIdx < 0) descIdx = null as unknown as number;
  }

  return {
    dateIdx,
    amountIdx,
    descIdx: descIdx >= 0 ? descIdx : null,
    warnings,
  };
}

export function parseBankCsv(
  text: string,
  override?: { dateIdx?: number; amountIdx?: number; descIdx?: number | null }
): ParseBankCsvResult {
  const warnings: string[] = [];
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV needs a header row and at least one data row.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((l) => splitCsvLine(l, delimiter));

  const detected = detectColumnMapping(headers, rows);
  const dateIdx = override?.dateIdx ?? detected.dateIdx;
  const amountIdx = override?.amountIdx ?? detected.amountIdx;
  const descIdx = override?.descIdx !== undefined ? override.descIdx : detected.descIdx;
  warnings.push(...detected.warnings);

  if (dateIdx < 0 || amountIdx < 0) {
    throw new Error(
      'Could not find Date and Amount columns. Rename headers to e.g. "Dato" and "Beløb", or pick columns manually.'
    );
  }

  const transactions: BankTransaction[] = [];
  let skippedRows = 0;
  for (const row of rows) {
    const date = parseBankDate(row[dateIdx] || '');
    const amount = parseAmount(row[amountIdx] || '');
    if (!date || amount == null || amount === 0) {
      skippedRows++;
      continue;
    }
    transactions.push({
      date,
      amount,
      description: descIdx != null ? row[descIdx] || '' : '',
    });
  }

  if (transactions.length === 0) {
    throw new Error('No valid transactions parsed. Check date/amount formats.');
  }

  return {
    delimiter,
    headers,
    mapping: { dateIdx, amountIdx, descIdx },
    transactions,
    skippedRows,
    warnings,
  };
}

/** Aggregate bank txs for a calendar year into monthly income / expense. */
export function aggregateBankByMonth(
  transactions: BankTransaction[],
  budgetYear: number
): BankMonthRollup[] {
  const buckets = BUDGET_MONTHS.map((month, monthIndex) => ({
    monthIndex,
    month,
    income: 0,
    expense: 0,
    count: 0,
  }));

  for (const tx of transactions) {
    if (tx.date.getFullYear() !== budgetYear) continue;
    const i = tx.date.getMonth();
    buckets[i].count += 1;
    if (tx.amount >= 0) buckets[i].income += tx.amount;
    else buckets[i].expense += Math.abs(tx.amount);
  }

  return buckets;
}

export type ReconcileMonthRow = {
  month: string;
  monthIndex: number;
  budgetIncome: number;
  budgetExpense: number;
  bankIncome: number;
  bankExpense: number;
  incomeDiff: number;
  expenseDiff: number;
  bankCount: number;
};

/**
 * Diff = bank − budget.
 * Positive expenseDiff ⇒ bank shows more spending than the budget.
 */
export function buildReconcileRows(
  budgetMonths: { month: string; income: number; netExpense: number }[],
  bankMonths: BankMonthRollup[]
): ReconcileMonthRow[] {
  return budgetMonths.map((b, i) => {
    const bank = bankMonths[i] || {
      monthIndex: i,
      month: b.month,
      income: 0,
      expense: 0,
      count: 0,
    };
    return {
      month: b.month,
      monthIndex: i,
      budgetIncome: b.income,
      budgetExpense: b.netExpense,
      bankIncome: bank.income,
      bankExpense: bank.expense,
      incomeDiff: bank.income - b.income,
      expenseDiff: bank.expense - b.netExpense,
      bankCount: bank.count,
    };
  });
}
