import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useEffect, useState } from 'react';
import { theme } from '../ColorTheme';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../utils/budgetCategories';
import { BUDGET_MONTHS } from '../utils/budgetMath';
import {
  extractCategoryBudgetsFromItems,
  fillCategoryAllMonths,
  getCategoryMonthBudget,
  normalizeCategoryBudgets,
  setCategoryMonthBudget,
  withCategoryBudgetsMetaItem,
  type CategoryMonthlyBudgets,
} from '../utils/categoryBudgets';
import type { Currency } from '../utils/currency';
import { formatCurrency } from '../utils/currency';

type Props = {
  open: boolean;
  onClose: () => void;
  budgetYear: string;
  userId: string;
  currency: Currency;
  apiBaseUrl: string;
};

export default function CategoryBudgetsDialog({
  open,
  onClose,
  budgetYear,
  userId,
  currency,
  apiBaseUrl,
}: Props) {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [budgets, setBudgets] = useState<CategoryMonthlyBudgets>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fillDraft, setFillDraft] = useState<Partial<Record<ExpenseCategory, string>>>({});
  const [expanded, setExpanded] = useState<string | false>('Food');

  useEffect(() => {
    if (!open || !userId || !budgetYear) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFillDraft({});

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
        if (!res.ok) throw new Error('Failed to load budget data');
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
  }, [open, userId, budgetYear, apiBaseUrl]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const cleaned = normalizeCategoryBudgets(budgets);
      // Read-modify-write so we don't wipe line items; category budgets live as a meta row in /data.
      const getRes = await fetch(
        `${apiBaseUrl}/budgets/${encodeURIComponent(budgetYear)}/data`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId,
          },
        }
      );
      if (!getRes.ok) throw new Error('Failed to load budget before save');
      const existingItems = await getRes.json();
      const { items } = extractCategoryBudgetsFromItems(existingItems);
      const nextItems = withCategoryBudgetsMetaItem(items, cleaned);

      const putRes = await fetch(
        `${apiBaseUrl}/budgets/${encodeURIComponent(budgetYear)}/data`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId,
          },
          body: JSON.stringify({ items: nextItems }),
        }
      );
      if (!putRes.ok) throw new Error('Failed to save category budgets');
      setBudgets(cleaned);
      window.dispatchEvent(
        new CustomEvent('categoryBudgetsUpdated', {
          detail: { year: budgetYear, categoryBudgets: cleaned },
        })
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const yearTotal = EXPENSE_CATEGORIES.reduce(
    (sum, cat) =>
      sum + BUDGET_MONTHS.reduce((ms, m) => ms + getCategoryMonthBudget(budgets, cat, m), 0),
    0
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
            Category budgets — {budgetYear}
          </Typography>
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.8rem', mt: 0.25 }}>
            Set a planned amount per category for each month
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.85rem', mb: 1 }}>
              Year total planned:{' '}
              <strong style={{ color: theme.palette.text.primary }}>
                {formatCurrency(yearTotal, currency) || String(yearTotal)}
              </strong>
            </Typography>
            {EXPENSE_CATEGORIES.map((category) => {
              const catTotal = BUDGET_MONTHS.reduce(
                (sum, m) => sum + getCategoryMonthBudget(budgets, category, m),
                0
              );
              return (
                <Accordion
                  key={category}
                  expanded={expanded === category}
                  onChange={(_, isExp) => setExpanded(isExp ? category : false)}
                  sx={{
                    bgcolor: theme.palette.background.default,
                    '&:before': { display: 'none' },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%',
                        pr: 1,
                        gap: 2,
                      }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>{category}</Typography>
                      <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.85rem' }}>
                        {catTotal > 0
                          ? formatCurrency(catTotal, currency) || String(catTotal)
                          : 'Not set'}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        alignItems: 'center',
                        mb: 1.5,
                      }}
                    >
                      <TextField
                        size="small"
                        type="number"
                        label="Amount"
                        value={fillDraft[category] ?? ''}
                        onChange={(e) =>
                          setFillDraft((prev) => ({ ...prev, [category]: e.target.value }))
                        }
                        sx={{ width: 140 }}
                        inputProps={{ min: 0, step: 'any' }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const n = Number(fillDraft[category]);
                          if (!Number.isFinite(n)) return;
                          setBudgets((prev) => fillCategoryAllMonths(prev, category, n));
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Apply to all months
                      </Button>
                    </Box>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: isMobile
                          ? '1fr 1fr'
                          : 'repeat(4, minmax(0, 1fr))',
                        gap: 1,
                      }}
                    >
                      {BUDGET_MONTHS.map((month) => (
                        <TextField
                          key={month}
                          size="small"
                          type="number"
                          label={month.slice(0, 3)}
                          value={
                            getCategoryMonthBudget(budgets, category, month) || ''
                          }
                          onChange={(e) => {
                            const n = e.target.value === '' ? 0 : Number(e.target.value);
                            setBudgets((prev) =>
                              setCategoryMonthBudget(prev, category, month, n)
                            );
                          }}
                          inputProps={{ min: 0, step: 'any' }}
                        />
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || saving}
          sx={{ textTransform: 'none' }}
        >
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
