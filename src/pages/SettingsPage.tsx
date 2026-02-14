import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, TextField, Button, Paper, List, ListItem, ListItemText, IconButton, CircularProgress, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Divider, Chip, useMediaQuery, useTheme, Switch } from "@mui/material";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import DeleteIcon from '@mui/icons-material/Delete';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import FolderIcon from '@mui/icons-material/Folder';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { getStoredCurrency, setStoredCurrency, CURRENCIES } from "../utils/currency";
import type { Currency } from "../utils/currency";

interface Loan {
  id: string;
  userId: string;
  name: string;
  amount: number;
  startDate: string;
  createdAt?: string;
  updatedAt?: string;
}

// Use production API URL so local and production frontends use the same backend and database
// In dev mode, connect directly to production API. In production, use relative path.
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'https://budget.tobiasbay.me/api' : '/api');

async function fetchBudgets(userId: string): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/budgets`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch budgets');
  }

  return response.json();
}

async function createBudget(userId: string, year: string): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/budgets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify({ year }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to create budget';
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch (e) {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data.budgets || !Array.isArray(data.budgets)) {
    throw new Error('Invalid response from server');
  }
  return data.budgets;
}

async function deleteBudget(userId: string, year: string): Promise<string[]> {
  // URL encode the year parameter to handle special characters
  const encodedYear = encodeURIComponent(year);
  const response = await fetch(`${API_BASE_URL}/budgets/${encodedYear}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    let errorMessage = 'Failed to delete budget';
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch (e) {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data.budgets || !Array.isArray(data.budgets)) {
    throw new Error('Invalid response from server');
  }
  return data.budgets;
}

async function fetchLoans(userId: string): Promise<Loan[]> {
  const response = await fetch(`${API_BASE_URL}/loans`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch loans');
  }

  return response.json();
}

async function deleteLoan(userId: string, loanId: string): Promise<Loan[]> {
  const response = await fetch(`${API_BASE_URL}/loans/${loanId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    let errorMessage = 'Failed to delete loan';
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (data.success) {
    // Reload loans after deletion
    return fetchLoans(userId);
  }
  throw new Error('Invalid response from server');
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [budgetYear, setBudgetYear] = useState<string>('');
  const [budgets, setBudgets] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>(getStoredCurrency());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansLoading, setLoansLoading] = useState<boolean>(true);
  const [loanDeleteDialogOpen, setLoanDeleteDialogOpen] = useState<boolean>(false);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [stocksYears, setStocksYears] = useState<string[]>([]);
  const [stockYearDeleteDialogOpen, setStockYearDeleteDialogOpen] = useState<boolean>(false);
  const [stockYearToDelete, setStockYearToDelete] = useState<string | null>(null);
  const [activeBudget, setActiveBudget] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && user?.id) {
      loadBudgets();
      loadLoans();
      loadStocksYears();
      loadActiveBudget();
    }
  }, [isLoaded, user?.id]);

  const loadActiveBudget = () => {
    const stored = localStorage.getItem('activeBudget');
    if (stored) {
      setActiveBudget(stored);
    }
  };

  const handleToggleActiveBudget = (year: string, event: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => {
    event.stopPropagation();
    const newActiveBudget = activeBudget === year ? null : year;
    setActiveBudget(newActiveBudget);
    if (newActiveBudget) {
      localStorage.setItem('activeBudget', newActiveBudget);
    } else {
      localStorage.removeItem('activeBudget');
    }
  };

  const loadStocksYears = () => {
    const storedYears = localStorage.getItem('stocks_years');
    if (storedYears) {
      try {
        setStocksYears(JSON.parse(storedYears));
      } catch (e) {
        console.error('Error loading stocks years:', e);
      }
    }
  };

  const loadBudgets = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError('');
    try {
      const budgetList = await fetchBudgets(user.id);
      setBudgets(budgetList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
      console.error('Error loading budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async () => {
    // Check if user is loaded
    if (!isLoaded) {
      setError('Please wait, user information is loading...');
      return;
    }

    // Check if user is authenticated
    if (!user?.id) {
      setError('You must be signed in to create a budget');
      return;
    }

    // Check if year is provided
    if (!budgetYear || budgetYear.trim() === '') {
      setError('Please enter a budget year');
      return;
    }

    // Validate year format (should be a 4-digit year)
    const yearNum = parseInt(budgetYear.trim(), 10);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      setError('Please enter a valid year (2000-2100)');
      return;
    }

    const trimmedYear = budgetYear.trim();

    // Check if budget already exists
    if (budgets.includes(trimmedYear)) {
      setError('Budget already exists');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const updatedBudgets = await createBudget(user.id, trimmedYear);
      setBudgets(updatedBudgets);
      setBudgetYear('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create budget';
      setError(errorMessage);
      console.error('Error creating budget:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (year: string) => {
    setBudgetToDelete(year);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setBudgetToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!user?.id || !budgetToDelete) return;

    setError('');
    setDeleteDialogOpen(false);
    try {
      const updatedBudgets = await deleteBudget(user.id, budgetToDelete);
      setBudgets(updatedBudgets);
      // If the deleted budget was active, clear it
      if (activeBudget === budgetToDelete) {
        setActiveBudget(null);
        localStorage.removeItem('activeBudget');
      }
      setBudgetToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete budget');
      console.error('Error deleting budget:', err);
    }
  };

  const handleNavigateToBudget = (year: string) => {
    navigate(`/budgets/${year}`);
  };

  const loadLoans = async () => {
    if (!user?.id) return;

    setLoansLoading(true);
    try {
      const loansList = await fetchLoans(user.id);
      setLoans(loansList);
    } catch (err) {
      console.error('Error loading loans:', err);
    } finally {
      setLoansLoading(false);
    }
  };

  const handleLoanDeleteClick = (loan: Loan) => {
    setLoanToDelete(loan);
    setLoanDeleteDialogOpen(true);
  };

  const handleLoanDeleteCancel = () => {
    setLoanDeleteDialogOpen(false);
    setLoanToDelete(null);
  };

  const handleLoanDeleteConfirm = async () => {
    if (!user?.id || !loanToDelete) return;

    setLoanDeleteDialogOpen(false);
    try {
      const updatedLoans = await deleteLoan(user.id, loanToDelete.id);
      setLoans(updatedLoans);
      setLoanToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete loan');
      console.error('Error deleting loan:', err);
    }
  };

  const handleCurrencyChange = (currencyCode: string) => {
    const selectedCurrency = CURRENCIES.find(c => c.code === currencyCode);
    if (selectedCurrency) {
      setCurrency(selectedCurrency);
      setStoredCurrency(currencyCode);
    } else if (currencyCode === 'NONE') {
      // Handle NONE currency option
      setCurrency({ code: 'NONE', symbol: '', name: 'No Currency' });
      setStoredCurrency('NONE');
    }
  };

  const handleStockYearDeleteClick = (year: string) => {
    setStockYearToDelete(year);
    setStockYearDeleteDialogOpen(true);
  };

  const handleStockYearDeleteCancel = () => {
    setStockYearDeleteDialogOpen(false);
    setStockYearToDelete(null);
  };

  const handleStockYearDeleteConfirm = () => {
    if (!stockYearToDelete) return;

    // Remove year from localStorage
    const updatedYears = stocksYears.filter(y => y !== stockYearToDelete);
    setStocksYears(updatedYears);
    localStorage.setItem('stocks_years', JSON.stringify(updatedYears));

    // Remove all stocks for that year from localStorage
    const storedStocks = localStorage.getItem('stocks_data');
    if (storedStocks) {
      try {
        const stocks = JSON.parse(storedStocks);
        const updatedStocks = stocks.filter((s: any) => s.year !== stockYearToDelete);
        localStorage.setItem('stocks_data', JSON.stringify(updatedStocks));
      } catch (e) {
        console.error('Error deleting stocks data:', e);
      }
    }

    setStockYearDeleteDialogOpen(false);
    setStockYearToDelete(null);
  };

  return (
    <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
      <Navbar />
      <Box sx={{
        padding: isMobile ? '1rem' : '2rem',
        flex: 1,
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%'
      }}>
        <Box sx={{ marginBottom: isMobile ? '1.5rem' : '2rem' }}>
          <Typography
            sx={{
              color: theme.palette.text.primary,
              marginBottom: '0.5rem',
              fontWeight: 600
            }}
            variant={isMobile ? "h5" : "h4"}
          >
            Settings
          </Typography>
          <Typography
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9rem'
            }}
          >
            Manage your preferences, budgets, and loans
          </Typography>
        </Box>

        <Paper
          sx={{
            bgcolor: theme.palette.background.paper,
            padding: isMobile ? '1.5rem' : '2rem',
            marginBottom: isMobile ? '1.5rem' : '2rem',
            borderRadius: '12px',
            boxShadow: `0 2px 8px ${theme.palette.text.primary}10`,
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: `0 4px 16px ${theme.palette.text.primary}15`,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: '1.5rem' }}>
            <CurrencyExchangeIcon sx={{ color: theme.palette.primary.main, fontSize: '1.5rem' }} />
            <Typography sx={{ color: theme.palette.text.primary, fontWeight: 600 }} variant="h6">
              Currency
            </Typography>
          </Box>
          <FormControl fullWidth sx={{ maxWidth: '400px' }}>
            <InputLabel
              sx={{
                color: theme.palette.text.secondary,
                '&.Mui-focused': {
                  color: theme.palette.primary.main,
                },
              }}
            >
              Select Currency
            </InputLabel>
            <Select
              value={currency.code}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              label="Select Currency"
              sx={{
                color: theme.palette.text.primary,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.secondary.main,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                },
                '& .MuiSvgIcon-root': {
                  color: theme.palette.text.primary,
                },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                  }
                }
              }}
            >
              {CURRENCIES.map((curr) => (
                <MenuItem
                  key={curr.code}
                  value={curr.code}
                  sx={{
                    color: theme.palette.text.primary,
                    '&:hover': {
                      bgcolor: theme.palette.background.default,
                    },
                    '&.Mui-selected': {
                      bgcolor: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                      '&:hover': {
                        bgcolor: theme.palette.primary.dark,
                      },
                    },
                  }}
                >
                  {curr.code === 'NONE'
                    ? curr.name
                    : `${curr.symbol} ${curr.name} (${curr.code})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        {error && (
          <Paper
            sx={{
              bgcolor: theme.palette.error.main,
              color: theme.palette.error.contrastText,
              padding: '1rem 1.5rem',
              marginBottom: isMobile ? '1.5rem' : '2rem',
              borderRadius: '8px',
              boxShadow: `0 2px 8px ${theme.palette.error.main}30`,
            }}
          >
            <Typography sx={{ fontWeight: 500 }}>{error}</Typography>
          </Paper>
        )}

        <Paper
          sx={{
            bgcolor: theme.palette.background.paper,
            padding: isMobile ? '1.5rem' : '2rem',
            marginBottom: isMobile ? '1.5rem' : '2rem',
            borderRadius: '12px',
            boxShadow: `0 2px 8px ${theme.palette.text.primary}10`,
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: `0 4px 16px ${theme.palette.text.primary}15`,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: '1.5rem' }}>
            <AddCircleOutlineIcon sx={{ color: theme.palette.success.main, fontSize: '1.5rem' }} />
            <Typography sx={{ color: theme.palette.text.primary, fontWeight: 600 }} variant="h6">
              Create New Budget
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', marginBottom: '2rem' }}>
            <TextField
              label="Budget Year"
              variant="outlined"
              value={budgetYear}
              onChange={(e) => setBudgetYear(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !creating) {
                  handleCreateBudget();
                }
              }}
              disabled={creating}
              placeholder="e.g., 2025"
              sx={{
                flex: 1,
                width: isMobile ? '100%' : 'auto',
                '& .MuiOutlinedInput-root': {
                  color: theme.palette.text.primary,
                  borderRadius: '8px',
                  '& fieldset': {
                    borderColor: theme.palette.secondary.main,
                  },
                  '&:hover fieldset': {
                    borderColor: theme.palette.primary.main,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: '2px',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                  '&.Mui-focused': {
                    color: theme.palette.primary.main,
                  },
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleCreateBudget}
              disabled={creating || !budgetYear || !isLoaded || !user?.id}
              startIcon={creating ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : <AddCircleOutlineIcon />}
              sx={{
                bgcolor: theme.palette.success.main,
                color: theme.palette.success.contrastText || theme.palette.text.primary,
                borderRadius: '8px',
                padding: '10px 24px',
                textTransform: 'none',
                fontWeight: 600,
                width: isMobile ? '100%' : 'auto',
                '&:hover': {
                  bgcolor: theme.palette.success.dark,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 12px ${theme.palette.success.main}40`,
                },
                '&:disabled': {
                  bgcolor: theme.palette.background.default,
                  color: theme.palette.text.secondary,
                },
                transition: 'all 0.2s ease',
              }}
            >
              {creating ? 'Creating...' : 'Create Budget'}
            </Button>
          </Box>

          <Divider sx={{ marginBottom: '1.5rem', opacity: 0.3 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: '1.5rem' }}>
            <FolderIcon sx={{ color: theme.palette.info.main, fontSize: '1.5rem' }} />
            <Typography sx={{ color: theme.palette.text.primary, fontWeight: 600 }} variant="h6">
              Existing Budgets
            </Typography>
            {budgets.length > 0 && (
              <Chip
                label={budgets.length}
                size="small"
                sx={{
                  bgcolor: theme.palette.info.main,
                  color: theme.palette.info.contrastText || theme.palette.text.primary,
                  fontWeight: 600
                }}
              />
            )}
          </Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <CircularProgress sx={{ color: theme.palette.primary.main }} />
            </Box>
          ) : (
            <List sx={{ padding: 0 }}>
              {budgets.length === 0 ? (
                <Box sx={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: theme.palette.text.secondary
                }}>
                  <FolderIcon sx={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                  <Typography>No budgets created yet</Typography>
                  <Typography variant="body2" sx={{ marginTop: '0.5rem', opacity: 0.7 }}>
                    Create your first budget above
                  </Typography>
                </Box>
              ) : (
                budgets.map((year, index) => (
                  <Box key={year}>
                    <ListItem
                      secondaryAction={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ 
                              fontSize: '0.7rem',
                              fontWeight: activeBudget === year ? 600 : 400,
                              color: activeBudget === year ? theme.palette.primary.main : theme.palette.text.secondary
                            }}>
                              Active
                            </Typography>
                            <Switch
                              checked={activeBudget === year}
                              onChange={(e) => handleToggleActiveBudget(year, e)}
                              onClick={(e) => e.stopPropagation()}
                              size="small"
                              sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': {
                                  color: theme.palette.primary.main,
                                },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                  backgroundColor: theme.palette.primary.main,
                                },
                              }}
                            />
                          </Box>
                          <IconButton
                            edge="end"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(year);
                            }}
                            sx={{
                              color: theme.palette.error.main,
                              '&:hover': {
                                bgcolor: theme.palette.error.main,
                                color: theme.palette.error.contrastText,
                                transform: 'scale(1.1)',
                              },
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      }
                      sx={{
                        cursor: 'pointer',
                        borderRadius: '8px',
                        marginBottom: index < budgets.length - 1 ? '0.5rem' : 0,
                        padding: '12px 16px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: theme.palette.background.default,
                          transform: 'translateX(4px)',
                          boxShadow: `0 2px 8px ${theme.palette.text.primary}10`,
                        },
                      }}
                      onClick={() => handleNavigateToBudget(year)}
                    >
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        flex: 1
                      }}>
                        <FolderIcon sx={{
                          color: theme.palette.info.main,
                          fontSize: '1.25rem'
                        }} />
                        <ListItemText
                          primary={
                            <Typography sx={{
                              color: theme.palette.text.primary,
                              fontWeight: 500,
                              fontSize: '1rem'
                            }}>
                              Budget {year}
                            </Typography>
                          }
                          secondary={
                            <Typography sx={{
                              color: theme.palette.text.secondary,
                              fontSize: '0.85rem',
                              marginTop: '2px'
                            }}>
                              Click to view
                            </Typography>
                          }
                        />
                      </Box>
                    </ListItem>
                    {index < budgets.length - 1 && (
                      <Divider sx={{
                        marginLeft: '56px',
                        opacity: 0.3
                      }} />
                    )}
                  </Box>
                ))
              )}
            </List>
          )}
        </Paper>

        <Paper
          sx={{
            bgcolor: theme.palette.background.paper,
            padding: isMobile ? '1.5rem' : '2rem',
            marginBottom: isMobile ? '1.5rem' : '2rem',
            borderRadius: '12px',
            boxShadow: `0 2px 8px ${theme.palette.text.primary}10`,
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: `0 4px 16px ${theme.palette.text.primary}15`,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: '1.5rem' }}>
            <CreditCardIcon sx={{ color: theme.palette.warning.main, fontSize: '1.5rem' }} />
            <Typography sx={{ color: theme.palette.text.primary, fontWeight: 600 }} variant="h6">
              Existing Loans
            </Typography>
            {loans.length > 0 && (
              <Chip
                label={loans.length}
                size="small"
                sx={{
                  bgcolor: theme.palette.warning.main,
                  color: theme.palette.warning.contrastText || theme.palette.text.primary,
                  fontWeight: 600
                }}
              />
            )}
          </Box>
          {loansLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <CircularProgress sx={{ color: theme.palette.primary.main }} />
            </Box>
          ) : (
            <List sx={{ padding: 0 }}>
              {loans.length === 0 ? (
                <Box sx={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: theme.palette.text.secondary
                }}>
                  <CreditCardIcon sx={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                  <Typography>No loans created yet</Typography>
                  <Typography variant="body2" sx={{ marginTop: '0.5rem', opacity: 0.7 }}>
                    Create loans from the Loans page
                  </Typography>
                </Box>
              ) : (
                loans.map((loan, index) => (
                  <Box key={loan.id}>
                    <ListItem
                      secondaryAction={
                        <IconButton
                          edge="end"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoanDeleteClick(loan);
                          }}
                          sx={{
                            color: theme.palette.error.main,
                            '&:hover': {
                              bgcolor: theme.palette.error.main,
                              color: theme.palette.error.contrastText,
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                      sx={{
                        cursor: 'pointer',
                        borderRadius: '8px',
                        marginBottom: index < loans.length - 1 ? '0.5rem' : 0,
                        padding: '12px 16px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: theme.palette.background.default,
                          transform: 'translateX(4px)',
                          boxShadow: `0 2px 8px ${theme.palette.text.primary}10`,
                        },
                      }}
                      onClick={() => navigate('/loans')}
                    >
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        flex: 1
                      }}>
                        <AccountBalanceIcon sx={{
                          fontSize: '1.25rem',
                          color: theme.palette.info.main
                        }} />
                        <ListItemText
                          primary={
                            <Typography sx={{
                              color: theme.palette.text.primary,
                              fontWeight: 500,
                              fontSize: '1rem'
                            }}>
                              {loan.name}
                            </Typography>
                          }
                          secondary={
                            <Typography sx={{
                              color: theme.palette.text.secondary,
                              fontSize: '0.85rem',
                              marginTop: '2px'
                            }}>
                              {loan.createdAt
                                ? `Created: ${new Date(loan.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}`
                                : 'Click to view details'}
                            </Typography>
                          }
                        />
                      </Box>
                    </ListItem>
                    {index < loans.length - 1 && (
                      <Divider sx={{
                        marginLeft: '56px',
                        opacity: 0.3
                      }} />
                    )}
                  </Box>
                ))
              )}
            </List>
          )}
        </Paper>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          PaperProps={{
            sx: {
              bgcolor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              borderRadius: '12px',
              minWidth: isMobile ? 'auto' : '400px',
            }
          }}
        >
          <DialogTitle sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <DeleteIcon sx={{ color: theme.palette.error.main }} />
            Delete Budget
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: theme.palette.text.secondary }}>
              Are you sure you want to delete Budget {budgetToDelete}? This action cannot be undone and will delete all associated data.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ padding: '1.5rem', gap: 1 }}>
            <Button
              onClick={handleDeleteCancel}
              sx={{
                color: theme.palette.text.secondary,
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 500,
                padding: '8px 20px',
                '&:hover': {
                  bgcolor: theme.palette.background.default,
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              variant="contained"
              color="error"
              sx={{
                bgcolor: theme.palette.error.main,
                color: theme.palette.error.contrastText,
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                padding: '8px 20px',
                '&:hover': {
                  bgcolor: theme.palette.error.dark,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 12px ${theme.palette.error.main}40`,
                },
                transition: 'all 0.2s ease',
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Loan Delete Confirmation Dialog */}
        <Dialog
          open={loanDeleteDialogOpen}
          onClose={handleLoanDeleteCancel}
          PaperProps={{
            sx: {
              bgcolor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              borderRadius: '12px',
              minWidth: isMobile ? 'auto' : '400px',
            }
          }}
        >
          <DialogTitle sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <DeleteIcon sx={{ color: theme.palette.error.main }} />
            Delete Loan
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: theme.palette.text.secondary }}>
              Are you sure you want to delete the loan "{loanToDelete?.name}"? This action cannot be undone and will remove all payment history associated with this loan.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ padding: '1.5rem', gap: 1 }}>
            <Button
              onClick={handleLoanDeleteCancel}
              sx={{
                color: theme.palette.text.secondary,
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 500,
                padding: '8px 20px',
                '&:hover': {
                  bgcolor: theme.palette.background.default,
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLoanDeleteConfirm}
              variant="contained"
              color="error"
              sx={{
                bgcolor: theme.palette.error.main,
                color: theme.palette.error.contrastText,
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                padding: '8px 20px',
                '&:hover': {
                  bgcolor: theme.palette.error.dark,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 12px ${theme.palette.error.main}40`,
                },
                transition: 'all 0.2s ease',
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Stocks Years Section */}
        <Paper
          sx={{
            bgcolor: theme.palette.background.paper,
            padding: isMobile ? '1.5rem' : '2rem',
            marginBottom: isMobile ? '1.5rem' : '2rem',
            borderRadius: '12px',
            boxShadow: `0 2px 8px ${theme.palette.text.primary}10`,
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: `0 4px 16px ${theme.palette.text.primary}15`,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: '1.5rem' }}>
            <TrendingUpIcon sx={{ color: theme.palette.success.main, fontSize: '1.5rem' }} />
            <Typography sx={{ color: theme.palette.text.primary, fontWeight: 600 }} variant="h6">
              Stocks Years
            </Typography>
            {stocksYears.length > 0 && (
              <Chip
                label={stocksYears.length}
                size="small"
                sx={{
                  bgcolor: theme.palette.success.main,
                  color: theme.palette.success.contrastText || theme.palette.text.primary,
                  fontWeight: 600
                }}
              />
            )}
          </Box>
          <List sx={{ padding: 0 }}>
            {stocksYears.length === 0 ? (
              <Box sx={{
                padding: '2rem',
                textAlign: 'center',
                color: theme.palette.text.secondary
              }}>
                <TrendingUpIcon sx={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                <Typography>No stocks years created yet</Typography>
                <Typography variant="body2" sx={{ marginTop: '0.5rem', opacity: 0.7 }}>
                  Create years from the Stocks page
                </Typography>
              </Box>
            ) : (
              stocksYears.map((year, index) => (
                <Box key={year}>
                  <ListItem
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStockYearDeleteClick(year);
                        }}
                        sx={{
                          color: theme.palette.error.main,
                          '&:hover': {
                            bgcolor: theme.palette.error.main,
                            color: theme.palette.error.contrastText,
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                    sx={{
                      cursor: 'pointer',
                      borderRadius: '8px',
                      marginBottom: index < stocksYears.length - 1 ? '0.5rem' : 0,
                      padding: '12px 16px',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: theme.palette.background.default,
                        transform: 'translateX(4px)',
                        boxShadow: `0 2px 8px ${theme.palette.text.primary}10`,
                      },
                    }}
                    onClick={() => navigate('/stocks')}
                  >
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      flex: 1
                    }}>
                      <TrendingUpIcon sx={{
                        fontSize: '1.25rem',
                        color: theme.palette.success.main
                      }} />
                      <ListItemText
                        primary={
                          <Typography sx={{
                            color: theme.palette.text.primary,
                            fontWeight: 500,
                            fontSize: '1rem'
                          }}>
                            Stocks {year}
                          </Typography>
                        }
                        secondary={
                          <Typography sx={{
                            color: theme.palette.text.secondary,
                            fontSize: '0.85rem',
                            marginTop: '2px'
                          }}>
                            Click to view
                          </Typography>
                        }
                      />
                    </Box>
                  </ListItem>
                  {index < stocksYears.length - 1 && (
                    <Divider sx={{
                      marginLeft: '56px',
                      opacity: 0.3
                    }} />
                  )}
                </Box>
              ))
            )}
          </List>
        </Paper>

        {/* Stock Year Delete Confirmation Dialog */}
        <Dialog
          open={stockYearDeleteDialogOpen}
          onClose={handleStockYearDeleteCancel}
          PaperProps={{
            sx: {
              bgcolor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              borderRadius: '12px',
              minWidth: isMobile ? 'auto' : '400px',
            }
          }}
        >
          <DialogTitle sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <DeleteIcon sx={{ color: theme.palette.error.main }} />
            Delete Stocks Year
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: theme.palette.text.secondary }}>
              Are you sure you want to delete Stocks {stockYearToDelete}? This action cannot be undone and will delete all stocks and data for this year.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ padding: '1.5rem', gap: 1 }}>
            <Button
              onClick={handleStockYearDeleteCancel}
              sx={{
                color: theme.palette.text.secondary,
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 500,
                padding: '8px 20px',
                '&:hover': {
                  bgcolor: theme.palette.background.default,
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStockYearDeleteConfirm}
              variant="contained"
              color="error"
              sx={{
                bgcolor: theme.palette.error.main,
                color: theme.palette.error.contrastText,
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                padding: '8px 20px',
                '&:hover': {
                  bgcolor: theme.palette.error.dark,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 12px ${theme.palette.error.main}40`,
                },
                transition: 'all 0.2s ease',
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}

