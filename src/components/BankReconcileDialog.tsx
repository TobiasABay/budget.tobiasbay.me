import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useCallback, useMemo, useRef, useState } from 'react';
import { theme } from '../ColorTheme';
import {
  aggregateBankByMonth,
  buildReconcileRows,
  parseBankCsv,
  type ParseBankCsvResult,
  type ReconcileMonthRow,
} from '../utils/bankCsv';
import type { YearSummary } from '../utils/budgetMath';
import type { Currency } from '../utils/currency';
import { formatCurrency } from '../utils/currency';

type Props = {
  open: boolean;
  onClose: () => void;
  budgetYear: string;
  yearOverview: YearSummary;
  currency: Currency;
  hideNumbers?: boolean;
};

function fmt(amount: number, currency: Currency, hide?: boolean): string {
  if (hide) return '••••';
  if (amount === 0) return '-';
  return formatCurrency(amount, currency) || String(amount);
}

export default function BankReconcileDialog({
  open,
  onClose,
  budgetYear,
  yearOverview,
  currency,
  hideNumbers,
}: Props) {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseBankCsvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateIdx, setDateIdx] = useState(0);
  const [amountIdx, setAmountIdx] = useState(1);
  const [descIdx, setDescIdx] = useState<number | null>(null);

  const yearNum = Number.parseInt(budgetYear, 10);

  const reparse = useCallback(
    (text: string, mapping?: { dateIdx: number; amountIdx: number; descIdx: number | null }) => {
      setError(null);
      try {
        const result = parseBankCsv(text, mapping);
        setParsed(result);
        setDateIdx(result.mapping.dateIdx);
        setAmountIdx(result.mapping.amountIdx);
        setDescIdx(result.mapping.descIdx);
      } catch (e) {
        setParsed(null);
        setError(e instanceof Error ? e.message : 'Failed to parse CSV');
      }
    },
    []
  );

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setRawText(text);
    reparse(text);
  };

  const applyMapping = () => {
    if (!rawText) return;
    reparse(rawText, {
      dateIdx,
      amountIdx,
      descIdx,
    });
  };

  const rows: ReconcileMonthRow[] = useMemo(() => {
    if (!parsed || !Number.isFinite(yearNum)) return [];
    const bankMonths = aggregateBankByMonth(parsed.transactions, yearNum);
    const budgetMonths = yearOverview.months.map((m) => ({
      month: m.month,
      income: m.income,
      netExpense: m.netExpense,
    }));
    return buildReconcileRows(budgetMonths, bankMonths);
  }, [parsed, yearNum, yearOverview.months]);

  const activeRows = rows.filter(
    (r) =>
      r.budgetIncome !== 0 ||
      r.budgetExpense !== 0 ||
      r.bankIncome !== 0 ||
      r.bankExpense !== 0
  );

  const totals = activeRows.reduce(
    (acc, r) => ({
      budgetIncome: acc.budgetIncome + r.budgetIncome,
      budgetExpense: acc.budgetExpense + r.budgetExpense,
      bankIncome: acc.bankIncome + r.bankIncome,
      bankExpense: acc.bankExpense + r.bankExpense,
      incomeDiff: acc.incomeDiff + r.incomeDiff,
      expenseDiff: acc.expenseDiff + r.expenseDiff,
      bankCount: acc.bankCount + r.bankCount,
    }),
    {
      budgetIncome: 0,
      budgetExpense: 0,
      bankIncome: 0,
      bankExpense: 0,
      incomeDiff: 0,
      expenseDiff: 0,
      bankCount: 0,
    }
  );

  const inYearCount = parsed
    ? parsed.transactions.filter((t) => t.date.getFullYear() === yearNum).length
    : 0;

  const reset = () => {
    setFileName(null);
    setRawText(null);
    setParsed(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { bgcolor: theme.palette.background.paper } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography component="span" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
          Bank reconcile — {budgetYear}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem', mb: 2 }}>
          Upload a bank CSV (stays in your browser). We compare monthly bank totals to this budget.
          Expense diff = bank spending − budget expenses (living minus Nordnet withdrawals). Positive
          means the bank shows more spending than you registered.
        </Typography>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,.txt"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => fileRef.current?.click()}
            sx={{ textTransform: 'none' }}
          >
            {fileName ? 'Replace CSV' : 'Upload bank CSV'}
          </Button>
          {fileName && (
            <Button variant="outlined" onClick={reset} sx={{ textTransform: 'none' }}>
              Clear
            </Button>
          )}
        </Box>

        {fileName && (
          <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, mb: 1 }}>
            File: {fileName}
            {parsed &&
              ` · ${parsed.transactions.length} transactions · ${inYearCount} in ${budgetYear}` +
                (parsed.skippedRows ? ` · ${parsed.skippedRows} rows skipped` : '')}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {parsed?.warnings.map((w) => (
          <Alert key={w} severity="info" sx={{ mb: 1 }}>
            {w}
          </Alert>
        ))}

        {parsed && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Date column</InputLabel>
              <Select
                label="Date column"
                value={dateIdx}
                onChange={(e) => setDateIdx(Number(e.target.value))}
              >
                {parsed.headers.map((h, i) => (
                  <MenuItem key={`d-${i}`} value={i}>
                    {h || `Column ${i + 1}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Amount column</InputLabel>
              <Select
                label="Amount column"
                value={amountIdx}
                onChange={(e) => setAmountIdx(Number(e.target.value))}
              >
                {parsed.headers.map((h, i) => (
                  <MenuItem key={`a-${i}`} value={i}>
                    {h || `Column ${i + 1}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Text column</InputLabel>
              <Select
                label="Text column"
                value={descIdx === null ? -1 : descIdx}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDescIdx(v < 0 ? null : v);
                }}
              >
                <MenuItem value={-1}>(none)</MenuItem>
                {parsed.headers.map((h, i) => (
                  <MenuItem key={`t-${i}`} value={i}>
                    {h || `Column ${i + 1}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" size="small" onClick={applyMapping} sx={{ textTransform: 'none' }}>
              Re-parse
            </Button>
          </Box>
        )}

        {!parsed && !error && (
          <Alert severity="info">
            Tip: Danish exports often use <strong>Dato;Beløb;Tekst</strong> with amounts like{' '}
            <code>-1.234,56</code>. Outflows should be negative (or in parentheses).
          </Alert>
        )}

        {activeRows.length > 0 && (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Budget income</TableCell>
                  <TableCell align="right">Bank income</TableCell>
                  <TableCell align="right">Income Δ</TableCell>
                  <TableCell align="right">Budget expense</TableCell>
                  <TableCell align="right">Bank expense</TableCell>
                  <TableCell align="right">Expense Δ</TableCell>
                  <TableCell align="right"># tx</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeRows.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell>{r.month.slice(0, 3)}</TableCell>
                    <TableCell align="right">{fmt(r.budgetIncome, currency, hideNumbers)}</TableCell>
                    <TableCell align="right">{fmt(r.bankIncome, currency, hideNumbers)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          Math.abs(r.incomeDiff) < 0.5
                            ? theme.palette.text.secondary
                            : r.incomeDiff > 0
                              ? '#4caf50'
                              : '#f44336',
                        fontWeight: Math.abs(r.incomeDiff) >= 0.5 ? 700 : 400,
                      }}
                    >
                      {fmt(r.incomeDiff, currency, hideNumbers)}
                    </TableCell>
                    <TableCell align="right">{fmt(r.budgetExpense, currency, hideNumbers)}</TableCell>
                    <TableCell align="right">{fmt(r.bankExpense, currency, hideNumbers)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          Math.abs(r.expenseDiff) < 0.5
                            ? theme.palette.text.secondary
                            : r.expenseDiff > 0
                              ? '#f44336'
                              : '#4caf50',
                        fontWeight: Math.abs(r.expenseDiff) >= 0.5 ? 700 : 400,
                      }}
                    >
                      {fmt(r.expenseDiff, currency, hideNumbers)}
                    </TableCell>
                    <TableCell align="right">{r.bankCount || '-'}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {fmt(totals.budgetIncome, currency, hideNumbers)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {fmt(totals.bankIncome, currency, hideNumbers)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {fmt(totals.incomeDiff, currency, hideNumbers)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {fmt(totals.budgetExpense, currency, hideNumbers)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {fmt(totals.bankExpense, currency, hideNumbers)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      color: totals.expenseDiff > 0.5 ? '#f44336' : totals.expenseDiff < -0.5 ? '#4caf50' : undefined,
                    }}
                  >
                    {fmt(totals.expenseDiff, currency, hideNumbers)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {totals.bankCount}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
