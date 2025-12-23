import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Paper, CircularProgress, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, useMediaQuery, useTheme } from "@mui/material";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { getStoredCurrency, formatCurrency } from "../utils/currency";
import type { Currency } from "../utils/currency";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

// Use production API URL so local and production frontends use the same backend and database
// In dev mode, connect directly to production API. In production, use relative path.
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'https://budget.tobiasbay.me/api' : '/api');

interface Loan {
    id: string;
    userId: string;
    name: string;
    amount: number;
    startDate: string;
    createdAt?: string;
    updatedAt?: string;
}

interface BudgetItem {
    id: string;
    name: string;
    type: 'income' | 'expense';
    months: { [key: string]: number };
    linkedLoanId?: string;
}

interface LoanPayment {
    year: string;
    loanId: string;
    loanName: string;
    totalPayment: number;
    remaining: number;
    createdAt?: string;
}

export default function Loan() {
    const { user, isLoaded } = useUser();
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
    const [loans, setLoans] = useState<Loan[]>([]);
    const [budgetData, setBudgetData] = useState<{ [year: string]: BudgetItem[] }>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currency, setCurrency] = useState<Currency>(getStoredCurrency());
    const [modalOpen, setModalOpen] = useState(false);
    const [loanName, setLoanName] = useState('');
    const [loanAmount, setLoanAmount] = useState('');
    const [loanStartDate, setLoanStartDate] = useState('');

    // Load loans and budget data on mount
    useEffect(() => {
        if (isLoaded && user?.id) {
            loadData();
        }
    }, [isLoaded, user?.id]);

    // Listen for currency changes in localStorage
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'budget_currency' && e.newValue) {
                const newCurrency = getStoredCurrency();
                setCurrency(newCurrency);
            }
        };

        const interval = setInterval(() => {
            const currentCurrency = getStoredCurrency();
            if (currentCurrency.code !== currency.code) {
                setCurrency(currentCurrency);
            }
        }, 500);

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [currency.code]);

    const loadData = async () => {
        if (!user?.id) return;

        setLoading(true);
        try {
            // Load loans
            const loansResponse = await fetch(`${API_BASE_URL}/loans`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
            });

            if (loansResponse.ok) {
                const loansData = await loansResponse.json();
                setLoans(loansData);
            }

            // Load all budgets
            const budgetsResponse = await fetch(`${API_BASE_URL}/budgets`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
            });

            if (budgetsResponse.ok) {
                const years = await budgetsResponse.json();
                const budgetDataMap: { [year: string]: BudgetItem[] } = {};

                // Load data for each year
                for (const year of years) {
                    const encodedYear = encodeURIComponent(year);
                    const response = await fetch(`${API_BASE_URL}/budgets/${encodedYear}/data`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-User-Id': user.id,
                        },
                    });

                    if (response.ok) {
                        const items = await response.json();
                        budgetDataMap[year] = items;
                    }
                }

                setBudgetData(budgetDataMap);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLoan = async () => {
        if (!user?.id || !loanName.trim() || !loanAmount || !loanStartDate) return;

        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/loans`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
                body: JSON.stringify({
                    name: loanName.trim(),
                    amount: parseFloat(loanAmount),
                    startDate: loanStartDate,
                }),
            });

            if (response.ok) {
                const newLoan = await response.json();
                setLoans([...loans, newLoan]);
                setModalOpen(false);
                setLoanName('');
                setLoanAmount('');
                setLoanStartDate('');
            }
        } catch (error) {
            console.error('Error creating loan:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteLoan = async (loanId: string) => {
        if (!user?.id || !confirm('Are you sure you want to delete this loan?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/loans/${loanId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
            });

            if (response.ok) {
                setLoans(loans.filter(loan => loan.id !== loanId));
            }
        } catch (error) {
            console.error('Error deleting loan:', error);
        }
    };

    // Calculate payments and remaining balance for each loan
    const calculateLoanPayments = (): LoanPayment[] => {
        const payments: LoanPayment[] = [];
        const years = Object.keys(budgetData).sort();

        for (const loan of loans) {
            let remaining = loan.amount;
            const startDate = new Date(loan.startDate);
            const startYear = startDate.getFullYear().toString();

            for (const year of years) {
                if (parseInt(year) < parseInt(startYear)) continue;

                const items = budgetData[year] || [];
                const linkedItems = items.filter(item => item.linkedLoanId === loan.id && item.type === 'expense');

                // Calculate total payment for this year
                let totalPayment = 0;
                for (const item of linkedItems) {
                    for (const month in item.months) {
                        totalPayment += item.months[month] || 0;
                    }
                }

                if (totalPayment > 0 || parseInt(year) === parseInt(startYear)) {
                    remaining = Math.max(0, remaining - totalPayment);
                    payments.push({
                        year,
                        loanId: loan.id,
                        loanName: loan.name,
                        totalPayment,
                        remaining,
                        createdAt: loan.createdAt,
                    });
                }
            }
        }

        // Sort by year descending (most recent first), then by loan name
        return payments.sort((a, b) => {
            const yearDiff = parseInt(b.year) - parseInt(a.year);
            if (yearDiff !== 0) return yearDiff;
            return a.loanName.localeCompare(b.loanName);
        });
    };

    if (loading) {
        return (
            <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
                <Navbar />
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <CircularProgress sx={{ color: theme.palette.primary.main }} />
                </Box>
            </Box>
        );
    }

    const loanPayments = calculateLoanPayments();
    const currencyText = currency.code === 'NONE' ? 'Figures' : `Figures in ${currency.code}`;

    return (
        <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
            <Navbar />
            <Box sx={{
                padding: isMobile ? '1rem' : '2rem',
                flex: 1,
                width: '100%',
                overflow: 'hidden',
                maxWidth: '100%'
            }}>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: isMobile ? '1rem' : '2rem',
                    flexWrap: 'wrap',
                    gap: 2
                }}>
                    <Typography sx={{ color: theme.palette.text.primary }} variant={isMobile ? "h5" : "h4"}>
                        Loans
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setModalOpen(true)}
                        size={isMobile ? "small" : "medium"}
                        sx={{
                            bgcolor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            '&:hover': {
                                bgcolor: theme.palette.primary.dark,
                            },
                        }}
                    >
                        Create Loan
                    </Button>
                </Box>

                <Paper sx={{
                    bgcolor: theme.palette.background.paper,
                    overflow: 'auto',
                    width: '100%',
                    maxWidth: '100%',
                    '&::-webkit-scrollbar': {
                        height: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: theme.palette.background.default,
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: theme.palette.secondary.main,
                        borderRadius: '4px',
                    },
                }}>
                    <Table stickyHeader sx={{
                        tableLayout: isMobile ? 'auto' : 'fixed',
                        width: isMobile ? 'max-content' : '100%',
                        minWidth: isMobile ? '600px' : 'auto'
                    }}>
                        <TableHead>
                            <TableRow>
                                <TableCell
                                    sx={{
                                        bgcolor: theme.palette.primary.main,
                                        color: theme.palette.primary.contrastText,
                                        fontWeight: 'bold',
                                        width: isMobile ? '100px' : '20%',
                                        minWidth: isMobile ? '100px' : 'auto',
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                    }}
                                >
                                    Budget Year
                                </TableCell>
                                <TableCell
                                    sx={{
                                        bgcolor: theme.palette.primary.main,
                                        color: theme.palette.primary.contrastText,
                                        fontWeight: 'bold',
                                        width: isMobile ? '120px' : '25%',
                                        minWidth: isMobile ? '120px' : 'auto',
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                    }}
                                >
                                    Loan Name
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{
                                        bgcolor: theme.palette.primary.main,
                                        color: theme.palette.primary.contrastText,
                                        fontWeight: 'bold',
                                        width: isMobile ? '100px' : '25%',
                                        minWidth: isMobile ? '100px' : 'auto',
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                    }}
                                >
                                    {isMobile ? 'Afdrag' : `Afdrag (${currencyText})`}
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{
                                        bgcolor: theme.palette.primary.main,
                                        color: theme.palette.primary.contrastText,
                                        fontWeight: 'bold',
                                        width: isMobile ? '100px' : '20%',
                                        minWidth: isMobile ? '100px' : 'auto',
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                    }}
                                >
                                    {isMobile ? 'Remaining' : `Remaining (${currencyText})`}
                                </TableCell>
                                <TableCell
                                    sx={{
                                        bgcolor: theme.palette.primary.main,
                                        color: theme.palette.primary.contrastText,
                                        fontWeight: 'bold',
                                        width: isMobile ? '90px' : '15%',
                                        minWidth: isMobile ? '90px' : 'auto',
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                    }}
                                >
                                    Created
                                </TableCell>
                                <TableCell
                                    sx={{
                                        bgcolor: theme.palette.primary.main,
                                        color: theme.palette.primary.contrastText,
                                        fontWeight: 'bold',
                                        width: isMobile ? '50px' : '5%',
                                        minWidth: isMobile ? '50px' : 'auto',
                                        padding: isMobile ? '8px 2px' : '12px 8px',
                                    }}
                                >
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loanPayments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic', padding: '2rem' }}>
                                        No loan payments found. Create a loan and link expenses to it in the budget page.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                loanPayments.map((payment, index) => (
                                    <TableRow key={`${payment.loanId}-${payment.year}-${index}`}>
                                        <TableCell sx={{
                                            color: theme.palette.text.primary,
                                            padding: isMobile ? '8px 4px' : '12px 8px',
                                            fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        }}>
                                            {payment.year}
                                        </TableCell>
                                        <TableCell sx={{
                                            color: theme.palette.text.primary,
                                            padding: isMobile ? '8px 4px' : '12px 8px',
                                            fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        }}>
                                            {payment.loanName}
                                        </TableCell>
                                        <TableCell align="right" sx={{
                                            color: theme.palette.text.primary,
                                            padding: isMobile ? '8px 4px' : '12px 8px',
                                            fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        }}>
                                            {formatCurrency(payment.totalPayment, currency)}
                                        </TableCell>
                                        <TableCell align="right" sx={{
                                            color: payment.remaining > 0 ? theme.palette.info.main : theme.palette.text.primary,
                                            padding: isMobile ? '8px 4px' : '12px 8px',
                                            fontWeight: payment.remaining > 0 ? 'bold' : 'normal',
                                            fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        }}>
                                            {formatCurrency(payment.remaining, currency)}
                                        </TableCell>
                                        <TableCell sx={{
                                            color: theme.palette.text.primary,
                                            padding: isMobile ? '8px 4px' : '12px 8px',
                                            fontSize: isMobile ? '0.7rem' : '0.875rem',
                                        }}>
                                            {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: isMobile ? 'numeric' : 'short',
                                                day: 'numeric'
                                            }) : '-'}
                                        </TableCell>
                                        <TableCell sx={{ padding: isMobile ? '4px 2px' : '4px' }}>
                                            {index === 0 || loanPayments[index - 1].loanId !== payment.loanId ? (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteLoan(payment.loanId)}
                                                    sx={{
                                                        color: theme.palette.error.main,
                                                        '&:hover': {
                                                            bgcolor: theme.palette.error.light,
                                                        },
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Paper>

                {/* Create Loan Dialog */}
                <Dialog
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    maxWidth="sm"
                    fullWidth
                    fullScreen={isMobile}
                    PaperProps={{
                        sx: {
                            margin: isMobile ? 0 : 'auto',
                            width: isMobile ? '100%' : 'auto',
                            maxHeight: isMobile ? '100%' : '90vh',
                        }
                    }}
                >
                    <DialogTitle sx={{ color: theme.palette.text.primary, fontSize: isMobile ? '1.1rem' : '1.25rem' }}>
                        Create New Loan
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: isMobile ? '0.5rem' : '1rem' }}>
                            <TextField
                                label="Loan Name"
                                value={loanName}
                                onChange={(e) => setLoanName(e.target.value)}
                                fullWidth
                                autoFocus
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        color: theme.palette.text.primary,
                                        '& fieldset': {
                                            borderColor: theme.palette.secondary.main,
                                        },
                                        '&:hover fieldset': {
                                            borderColor: theme.palette.primary.main,
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: theme.palette.primary.main,
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
                            <TextField
                                label="Loan Amount"
                                type="number"
                                value={loanAmount}
                                onChange={(e) => setLoanAmount(e.target.value)}
                                fullWidth
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        color: theme.palette.text.primary,
                                        '& fieldset': {
                                            borderColor: theme.palette.secondary.main,
                                        },
                                        '&:hover fieldset': {
                                            borderColor: theme.palette.primary.main,
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: theme.palette.primary.main,
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
                            <TextField
                                label="Start Date"
                                type="date"
                                value={loanStartDate}
                                onChange={(e) => setLoanStartDate(e.target.value)}
                                fullWidth
                                InputLabelProps={{
                                    shrink: true,
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        color: theme.palette.text.primary,
                                        '& fieldset': {
                                            borderColor: theme.palette.secondary.main,
                                        },
                                        '&:hover fieldset': {
                                            borderColor: theme.palette.primary.main,
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: theme.palette.primary.main,
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
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => {
                                setModalOpen(false);
                                setLoanName('');
                                setLoanAmount('');
                                setLoanStartDate('');
                            }}
                            sx={{
                                color: theme.palette.text.secondary,
                                '&:hover': {
                                    bgcolor: theme.palette.background.default,
                                },
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateLoan}
                            disabled={!loanName.trim() || !loanAmount || !loanStartDate || saving}
                            variant="contained"
                            sx={{
                                bgcolor: theme.palette.primary.main,
                                color: theme.palette.primary.contrastText,
                                '&:hover': {
                                    bgcolor: theme.palette.primary.dark,
                                },
                            }}
                        >
                            Create
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
}
