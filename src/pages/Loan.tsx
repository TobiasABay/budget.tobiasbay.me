import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import {
    Box,
    Typography,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Paper,
    CircularProgress,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Chip,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/clerk-react";
import { getStoredCurrency, formatCurrency } from "../utils/currency";
import type { Currency } from "../utils/currency";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { extractCategoryBudgetsFromItems } from "../utils/categoryBudgets";
import { buildLoanSummaries, type BudgetItemLike } from "../utils/loanPayments";

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface Loan {
    id: string;
    userId: string;
    name: string;
    amount: number;
    startDate: string;
    createdAt?: string;
    updatedAt?: string;
}

function formatPaymentDate(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Loan() {
    const { user, isLoaded } = useUser();
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
    const [loans, setLoans] = useState<Loan[]>([]);
    const [budgetData, setBudgetData] = useState<{ [year: string]: BudgetItemLike[] }>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currency, setCurrency] = useState<Currency>(getStoredCurrency());
    const [modalOpen, setModalOpen] = useState(false);
    const [loanName, setLoanName] = useState('');
    const [loanAmount, setLoanAmount] = useState('');
    const [loanStartDate, setLoanStartDate] = useState('');

    useEffect(() => {
        if (isLoaded && user?.id) {
            loadData();
        }
    }, [isLoaded, user?.id]);

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'budget_currency' && e.newValue) {
                setCurrency(getStoredCurrency());
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
            const loansResponse = await fetch(`${API_BASE_URL}/loans`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
            });

            if (loansResponse.ok) {
                setLoans(await loansResponse.json());
            }

            const budgetsResponse = await fetch(`${API_BASE_URL}/budgets`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
            });

            if (budgetsResponse.ok) {
                const years = await budgetsResponse.json();
                const budgetDataMap: { [year: string]: BudgetItemLike[] } = {};

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
                        const raw = await response.json();
                        budgetDataMap[year] = extractCategoryBudgetsFromItems(raw).items as BudgetItemLike[];
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

    const loanSummaries = useMemo(
        () => buildLoanSummaries(loans, budgetData),
        [loans, budgetData]
    );

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

    return (
        <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
            <Navbar />
            <Box sx={{
                padding: isMobile ? '1rem' : '2rem',
                flex: 1,
                width: '100%',
                maxWidth: '960px',
                margin: '0 auto',
            }}>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: isMobile ? '1rem' : '1.5rem',
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
                            textTransform: 'none',
                            '&:hover': {
                                bgcolor: theme.palette.primary.dark,
                            },
                        }}
                    >
                        Create Loan
                    </Button>
                </Box>

                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem', mb: 2 }}>
                    Payments appear here when you enter amounts on budget expenses linked to a loan.
                </Typography>

                {loans.length === 0 ? (
                    <Paper sx={{ bgcolor: theme.palette.background.paper, p: 4, textAlign: 'center' }}>
                        <AccountBalanceIcon sx={{ fontSize: 48, color: theme.palette.text.secondary, opacity: 0.4, mb: 1 }} />
                        <Typography sx={{ color: theme.palette.text.secondary }}>
                            No loans yet. Create a loan, then link an expense to it on the Budget page.
                        </Typography>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {loanSummaries.map((summary) => (
                            <Paper
                                key={summary.loan.id}
                                sx={{
                                    bgcolor: theme.palette.background.paper,
                                    p: isMobile ? 1.5 : 2,
                                    borderRadius: '12px',
                                }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: isMobile ? 'flex-start' : 'center',
                                        justifyContent: 'space-between',
                                        gap: 1.5,
                                        flexWrap: 'wrap',
                                        mb: 1.5,
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                        <AccountBalanceIcon sx={{ color: theme.palette.info.main }} />
                                        <Typography sx={{ color: theme.palette.text.primary, fontWeight: 700, fontSize: '1.1rem' }}>
                                            {summary.loan.name}
                                        </Typography>
                                        {summary.isDone ? (
                                            <Chip
                                                label="Loan done"
                                                size="small"
                                                sx={{
                                                    bgcolor: theme.palette.success.main,
                                                    color: theme.palette.success.contrastText || '#fff',
                                                    fontWeight: 600,
                                                }}
                                            />
                                        ) : (
                                            <Chip
                                                label="Active"
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                    borderColor: theme.palette.info.main,
                                                    color: theme.palette.info.main,
                                                }}
                                            />
                                        )}
                                    </Box>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleDeleteLoan(summary.loan.id)}
                                        aria-label={`Delete ${summary.loan.name}`}
                                        sx={{
                                            color: theme.palette.error.main,
                                            '&:hover': { bgcolor: theme.palette.error.light },
                                        }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>

                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: isMobile ? 1.5 : 3,
                                        mb: 1.5,
                                        color: theme.palette.text.secondary,
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
                                        Original:{' '}
                                        <strong style={{ color: theme.palette.text.primary }}>
                                            {formatCurrency(summary.loan.amount, currency)}
                                        </strong>
                                    </Typography>
                                    <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
                                        Paid:{' '}
                                        <strong style={{ color: theme.palette.text.primary }}>
                                            {formatCurrency(summary.totalPaid, currency)}
                                        </strong>
                                    </Typography>
                                    <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
                                        Remaining:{' '}
                                        <strong
                                            style={{
                                                color: summary.isDone
                                                    ? theme.palette.success.main
                                                    : theme.palette.info.main,
                                            }}
                                        >
                                            {summary.isDone
                                                ? 'Loan done'
                                                : formatCurrency(summary.remaining, currency)}
                                        </strong>
                                    </Typography>
                                    <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
                                        Started:{' '}
                                        {summary.loan.startDate
                                            ? formatPaymentDate(summary.loan.startDate)
                                            : '—'}
                                    </Typography>
                                </Box>

                                {summary.payments.length === 0 ? (
                                    <Typography sx={{ color: theme.palette.text.secondary, fontStyle: 'italic', fontSize: '0.875rem' }}>
                                        No payments yet. Enter amounts on a linked expense in Budget.
                                    </Typography>
                                ) : (
                                    <Box sx={{ overflowX: 'auto' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>
                                                        Date
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>
                                                        Loan
                                                    </TableCell>
                                                    <TableCell
                                                        align="right"
                                                        sx={{ fontWeight: 700, color: theme.palette.text.secondary }}
                                                    >
                                                        Amount
                                                    </TableCell>
                                                    {!isMobile && (
                                                        <TableCell
                                                            align="right"
                                                            sx={{ fontWeight: 700, color: theme.palette.text.secondary }}
                                                        >
                                                            Remaining after
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {summary.payments.map((payment) => (
                                                    <TableRow key={payment.key}>
                                                        <TableCell sx={{ color: theme.palette.text.primary }}>
                                                            {formatPaymentDate(payment.date)}
                                                        </TableCell>
                                                        <TableCell sx={{ color: theme.palette.text.primary }}>
                                                            <Box>
                                                                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                                                    {payment.loanName}
                                                                </Typography>
                                                                {payment.expenseName !== payment.loanName && (
                                                                    <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                                                                        {payment.expenseName}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                                                            {formatCurrency(payment.amount, currency)}
                                                        </TableCell>
                                                        {!isMobile && (
                                                            <TableCell
                                                                align="right"
                                                                sx={{
                                                                    color:
                                                                        payment.remainingAfter <= 0
                                                                            ? theme.palette.success.main
                                                                            : theme.palette.text.secondary,
                                                                    fontWeight: payment.remainingAfter <= 0 ? 600 : 400,
                                                                }}
                                                            >
                                                                {payment.remainingAfter <= 0
                                                                    ? 'Loan done'
                                                                    : formatCurrency(payment.remainingAfter, currency)}
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                )}
                            </Paper>
                        ))}
                    </Box>
                )}

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
                            bgcolor: theme.palette.background.paper,
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
                            />
                            <TextField
                                label="Loan Amount"
                                type="number"
                                value={loanAmount}
                                onChange={(e) => setLoanAmount(e.target.value)}
                                fullWidth
                            />
                            <TextField
                                label="Start Date"
                                type="date"
                                value={loanStartDate}
                                onChange={(e) => setLoanStartDate(e.target.value)}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
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
                            sx={{ textTransform: 'none', color: theme.palette.text.secondary }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateLoan}
                            disabled={!loanName.trim() || !loanAmount || !loanStartDate || saving}
                            variant="contained"
                            sx={{ textTransform: 'none' }}
                        >
                            Create
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
}
