import {
  Alert,
  Box,
  Dialog,
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect, useMemo, useState } from 'react';
import { theme } from '../ColorTheme';
import {
  buildCategoryBudgetCompareRows,
  extractCategoryBudgetsFromItems,
  hasAnyCategoryBudget,
  type CategoryMonthlyBudgets,
} from '../utils/categoryBudgets';
import { BUDGET_MONTHS, type BudgetMathItem } from '../utils/budgetMath';
import type { Currency } from '../utils/currency';
import { formatCurrency } from '../utils/currency';

type Props = {
  open: boolean;
  onClose: () => void;
  budgetYear: string;
  userId: string;
  apiBaseUrl: string;
  lineItems: BudgetMathItem[];
  currency: Currency;
  hideNumbers?: boolean;
  /** When provided, skip refetch and use these planned amounts. */
  categoryBudgets?: CategoryMonthlyBudgets;
};

function fmt(amount: number, currency: Currency, hide?: boolean): string {
  if (hide) return '••••';
  if (amount === 0) return '—';
  return formatCurrency(amount, currency) || String(amount);
}

export default function CategoryBudgetCompareDialog({
  open,
  onClose,
  budgetYear,
  userId,
  apiBaseUrl,
  lineItems,
  currency,
  hideNumbers,
  categoryBudgets: categoryBudgetsProp,
}: Props) {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [budgets, setBudgets] = useState<CategoryMonthlyBudgets>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthScope, setMonthScope] = useState<string>('all');

  useEffect(() => {
    if (!open) return;
    if (categoryBudgetsProp) {
      setBudgets(categoryBudgetsProp);
      setLoading(false);
      setError(null);
      return;
    }
    if (!userId || !budgetYear) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/budgets/${encodeURIComponent(budgetYear)}/data`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': userId,
            },
          }
        );
        if (!res.ok) throw new Error('Failed to load category budgets');
        const items = await res.json();
        if (!cancelled) {
          const { categoryBudgets } = extractCategoryBudgetsFromItems(items);
          setBudgets(categoryBudgets);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
          setBudgets({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId, budgetYear, apiBaseUrl, categoryBudgetsProp]);

  const rows = useMemo(
    () => buildCategoryBudgetCompareRows(budgets, lineItems, monthScope),
    [budgets, lineItems, monthScope]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          budgeted: acc.budgeted + r.budgeted,
          actual: acc.actual + r.actual,
          diff: acc.diff + r.diff,
        }),
        { budgeted: 0, actual: 0, diff: 0 }
      ),
    [rows]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: theme.palette.background.paper,
          borderRadius: isMobile ? 0 : '12px',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          color: theme.palette.text.primary,
        }}
      >
        <Box>
          <Typography variant="h6" component="span">
            Category budget vs actual — {budgetYear}
          </Typography>
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.8rem', mt: 0.25 }}>
            Planned amounts from Settings compared to registered expenses
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
            mb: 2,
          }}
        >
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="cat-budget-month-label">Period</InputLabel>
            <Select
              labelId="cat-budget-month-label"
              label="Period"
              value={monthScope}
              onChange={(e) => setMonthScope(e.target.value)}
            >
              <MenuItem value="all">Full year</MenuItem>
              {BUDGET_MONTHS.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && !hasAnyCategoryBudget(budgets) && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No category budgets set yet. Open Settings → Existing Budgets → Category budgets to set
            targets (e.g. Food per month).
          </Alert>
        )}

        {loading ? (
          <Typography sx={{ color: theme.palette.text.secondary, py: 3 }}>Loading…</Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Budgeted</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Diff</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
                        No budgeted or actual amounts for this period.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {rows.map((row) => {
                      const over = row.diff > 0;
                      const under = row.diff < 0;
                      const diffColor = over
                        ? theme.palette.error.main
                        : under
                          ? theme.palette.success.main
                          : theme.palette.text.secondary;
                      return (
                        <TableRow key={row.category}>
                          <TableCell>{row.category}</TableCell>
                          <TableCell align="right">
                            {fmt(row.budgeted, currency, hideNumbers)}
                          </TableCell>
                          <TableCell align="right">
                            {fmt(row.actual, currency, hideNumbers)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: diffColor, fontWeight: row.diff !== 0 ? 600 : 400 }}
                          >
                            {hideNumbers
                              ? '••••'
                              : row.diff === 0
                                ? '—'
                                : `${row.diff > 0 ? '+' : ''}${formatCurrency(row.diff, currency) || row.diff}`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {fmt(totals.budgeted, currency, hideNumbers)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {fmt(totals.actual, currency, hideNumbers)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color:
                            totals.diff > 0
                              ? theme.palette.error.main
                              : totals.diff < 0
                                ? theme.palette.success.main
                                : theme.palette.text.primary,
                        }}
                      >
                        {hideNumbers
                          ? '••••'
                          : totals.diff === 0
                            ? '—'
                            : `${totals.diff > 0 ? '+' : ''}${formatCurrency(totals.diff, currency) || totals.diff}`}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </Box>
        )}
        <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem', mt: 2 }}>
          Diff = actual − budgeted. Red means over budget; green means under.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
