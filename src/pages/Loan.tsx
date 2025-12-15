import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Paper, CircularProgress, TextField } from "@mui/material";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { getStoredCurrency, formatCurrency } from "../utils/currency";
import type { Currency } from "../utils/currency";

// Use production API URL so local and production frontends use the same backend and database
// In dev mode, connect directly to production API. In production, use relative path.
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'https://budget.tobiasbay.me/api' : '/api');

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface LineItem {
    id: string;
    name: string;
    type: 'income' | 'expense';
    amount: number;
    frequency: string;
    months: { [key: string]: number };
    isLoan?: boolean;
    loanTitle?: string;
    loanStartDate?: string;
    loanValue?: number;
}

export default function Loan() {
    const { user, isLoaded } = useUser();
    const [budgetItems, setBudgetItems] = useState<LineItem[]>([]);
    const [editingCell, setEditingCell] = useState<{ section: 'outstandingDebtStart' | 'debtPayments', loanName: string; month: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currency, setCurrency] = useState<Currency>(getStoredCurrency());
    const currentYear = new Date().getFullYear().toString();

    // Load budget data on mount
    useEffect(() => {
        if (isLoaded && user?.id) {
            loadBudgetData();
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

        // Check for currency changes periodically (since storage events don't work for same-tab changes)
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

    // Save budget data whenever we edit cells
    useEffect(() => {
        if (isLoaded && user?.id && !loading && budgetItems.length > 0) {
            // Debounce saves to avoid too many API calls
            const timeoutId = setTimeout(() => {
                saveBudgetData();
            }, 1000);

            return () => clearTimeout(timeoutId);
        }
    }, [budgetItems, isLoaded, user?.id]);

    const loadBudgetData = async () => {
        if (!user?.id) return;

        setLoading(true);
        try {
            const encodedYear = encodeURIComponent(currentYear);
            const response = await fetch(`${API_BASE_URL}/budgets/${encodedYear}/data`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
            });

            if (response.ok) {
                const items = await response.json();
                setBudgetItems(items);
            }
        } catch (error) {
            console.error('Error loading budget data:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveBudgetData = async () => {
        if (!user?.id || saving) return;

        setSaving(true);
        try {
            const encodedYear = encodeURIComponent(currentYear);
            const response = await fetch(`${API_BASE_URL}/budgets/${encodedYear}/data`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
                body: JSON.stringify({ items: budgetItems }),
            });

            if (!response.ok) {
                throw new Error('Failed to save budget data');
            }
        } catch (error) {
            console.error('Error saving budget data:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleCellClick = (section: 'outstandingDebtStart' | 'debtPayments', loanName: string, month: string) => {
        if (section === 'outstandingDebtStart') {
            const loanItem = budgetItems.find(item => item.isLoan && item.loanTitle === loanName);
            if (loanItem) {
                const value = getOutstandingDebtStart(loanItem, month);
                setEditingCell({ section, loanName, month });
                setEditValue(value.toString());
            }
        } else {
            const loanItem = budgetItems.find(item => item.isLoan && item.loanTitle === loanName);
            if (loanItem) {
                const value = loanItem.months[month] || 0;
                setEditingCell({ section, loanName, month });
                setEditValue(value.toString());
            }
        }
    };

    const handleCellSave = () => {
        if (!editingCell) return;

        const numericValue = parseFloat(editValue) || 0;
        const loanItem = budgetItems.find(item => item.isLoan && item.loanTitle === editingCell.loanName);

        if (!loanItem) return;

        if (editingCell.section === 'outstandingDebtStart') {
            // Update loan value - this affects the start debt calculation
            // We need to adjust the loan value based on the month
            // For simplicity, we'll update the loan value directly
            setBudgetItems(prev => prev.map(item => {
                if (item.id === loanItem.id) {
                    return {
                        ...item,
                        loanValue: numericValue
                    };
                }
                return item;
            }));
        } else {
            // Update the payment amount in the budget item
            setBudgetItems(prev => prev.map(item => {
                if (item.id === loanItem.id) {
                    return {
                        ...item,
                        months: {
                            ...item.months,
                            [editingCell.month]: numericValue
                        }
                    };
                }
                return item;
            }));
        }

        setEditingCell(null);
        setEditValue('');
    };

    const handleCellCancel = () => {
        setEditingCell(null);
        setEditValue('');
    };

    const handleCellKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCellSave();
        } else if (e.key === 'Escape') {
            handleCellCancel();
        }
    };

    const getLoanItems = (): LineItem[] => {
        return budgetItems.filter(item => item.isLoan);
    };

    const getMonthIndex = (month: string): number => {
        return MONTHS.indexOf(month);
    };

    const getOutstandingDebtStart = (loanItem: LineItem, month: string): number => {
        if (!loanItem.loanStartDate || !loanItem.loanValue) return 0;

        const startDate = new Date(loanItem.loanStartDate);
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth(); // 0-indexed

        const currentYearNum = parseInt(currentYear);
        const monthIndex = getMonthIndex(month);

        // If the loan hasn't started yet this year, return 0
        if (startYear > currentYearNum || (startYear === currentYearNum && startMonth > monthIndex)) {
            return 0;
        }

        // Start with the full loan value
        let outstanding = loanItem.loanValue || 0;

        // If loan started in a previous year, we need to account for all payments made this year before current month
        if (startYear < currentYearNum) {
            // Loan started in a previous year, subtract all payments from January to month before current
            for (let i = 0; i < monthIndex; i++) {
                const prevMonth = MONTHS[i];
                const payment = loanItem.months[prevMonth] || 0;
                outstanding -= payment;
            }
        } else {
            // Loan started this year, only subtract payments from start month to month before current
            for (let i = startMonth; i < monthIndex; i++) {
                const prevMonth = MONTHS[i];
                const payment = loanItem.months[prevMonth] || 0;
                outstanding -= payment;
            }
        }

        return Math.max(0, outstanding);
    };

    const getOutstandingDebtEnd = (loanItem: LineItem, month: string): number => {
        const start = getOutstandingDebtStart(loanItem, month);
        const payment = loanItem.months[month] || 0;
        return Math.max(0, start - payment);
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

    const loanItems = getLoanItems();
    const loanNames = loanItems.map(item => item.loanTitle || item.name).filter(Boolean) as string[];
    const currencyText = `Figures in ${currency.code}`;

    return (
        <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
            <Navbar />
            <Box sx={{ padding: '2rem', flex: 1, width: '100%', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: '2rem' }}>
                    <Typography sx={{ color: theme.palette.text.primary }} variant="h4">
                        Loans
                    </Typography>
                    {saving && (
                        <CircularProgress size={24} sx={{ color: theme.palette.primary.main }} />
                    )}
                </Box>

                <Paper sx={{ bgcolor: theme.palette.background.paper, overflow: 'hidden', width: '100%' }}>
                    <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
                        <TableHead>
                            <TableRow>
                                <TableCell
                                    sx={{
                                        bgcolor: theme.palette.primary.main,
                                        color: theme.palette.primary.contrastText,
                                        fontWeight: 'bold',
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        width: '15%',
                                        padding: '12px 8px',
                                    }}
                                >
                                    {currencyText}
                                </TableCell>
                                {MONTHS.map((month) => (
                                    <TableCell
                                        key={month}
                                        align="center"
                                        sx={{
                                            bgcolor: theme.palette.primary.main,
                                            color: theme.palette.primary.contrastText,
                                            fontWeight: 'bold',
                                            width: `${85 / 12}%`,
                                            padding: '12px 4px',
                                            fontSize: '0.9rem',
                                        }}
                                    >
                                        {month}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {/* Outstanding Debt – Start of Month Section */}
                            <TableRow>
                                <TableCell
                                    colSpan={13}
                                    sx={{
                                        bgcolor: theme.palette.background.default,
                                        color: theme.palette.text.primary,
                                        fontWeight: 'bold',
                                        padding: '12px 8px',
                                        borderBottom: `1px solid ${theme.palette.secondary.main}`,
                                    }}
                                >
                                    Outstanding Debt – Start of Month:
                                </TableCell>
                            </TableRow>
                            {loanNames.map((loanName) => {
                                const loanItem = loanItems.find(item => (item.loanTitle || item.name) === loanName);
                                if (!loanItem) return null;

                                return (
                                    <TableRow key={`start-${loanName}`}>
                                        <TableCell
                                            sx={{
                                                color: theme.palette.text.primary,
                                                borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                padding: '12px 8px',
                                            }}
                                        >
                                            {loanName}
                                        </TableCell>
                                        {MONTHS.map((month) => {
                                            const isEditing = editingCell?.section === 'outstandingDebtStart' && editingCell?.loanName === loanName && editingCell?.month === month;
                                            const cellValue = getOutstandingDebtStart(loanItem, month);

                                            return (
                                                <TableCell
                                                    key={month}
                                                    align="center"
                                                    onClick={() => handleCellClick('outstandingDebtStart', loanName, month)}
                                                    sx={{
                                                        color: cellValue > 0 ? theme.palette.info.main : theme.palette.text.primary,
                                                        padding: '4px',
                                                        fontSize: '0.875rem',
                                                        cursor: 'pointer',
                                                        '&:hover': {
                                                            bgcolor: theme.palette.background.default,
                                                        },
                                                    }}
                                                >
                                                    {isEditing ? (
                                                        <TextField
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onBlur={handleCellSave}
                                                            onKeyDown={handleCellKeyPress}
                                                            autoFocus
                                                            type="number"
                                                            size="small"
                                                            sx={{
                                                                width: '80px',
                                                                '& .MuiOutlinedInput-root': {
                                                                    color: theme.palette.text.primary,
                                                                    bgcolor: theme.palette.background.paper,
                                                                    '& fieldset': {
                                                                        borderColor: theme.palette.primary.main,
                                                                    },
                                                                    '&:hover fieldset': {
                                                                        borderColor: theme.palette.primary.main,
                                                                    },
                                                                    '&.Mui-focused fieldset': {
                                                                        borderColor: theme.palette.primary.main,
                                                                    },
                                                                },
                                                            }}
                                                            inputProps={{
                                                                style: {
                                                                    textAlign: 'center',
                                                                    padding: '4px 8px',
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        cellValue === 0 ? '--' : formatCurrency(cellValue, currency)
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })}
                            {/* Total Outstanding - Start */}
                            <TableRow>
                                <TableCell
                                    sx={{
                                        color: theme.palette.text.primary,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: '12px 8px',
                                        fontWeight: 'bold',
                                        bgcolor: theme.palette.background.default,
                                    }}
                                >
                                    Total Outstanding
                                </TableCell>
                                {MONTHS.map((month) => {
                                    const total = loanItems.reduce((sum, loanItem) => {
                                        return sum + getOutstandingDebtStart(loanItem, month);
                                    }, 0);

                                    return (
                                        <TableCell
                                            key={month}
                                            align="center"
                                            sx={{
                                                color: total > 0 ? theme.palette.info.main : theme.palette.text.primary,
                                                padding: '12px 4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                bgcolor: theme.palette.background.default,
                                            }}
                                        >
                                            {total === 0 ? '--' : formatCurrency(total, currency)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>

                            {/* Debt Payments Section */}
                            <TableRow>
                                <TableCell
                                    colSpan={13}
                                    sx={{
                                        bgcolor: theme.palette.background.default,
                                        color: theme.palette.text.primary,
                                        fontWeight: 'bold',
                                        padding: '12px 8px',
                                        borderTop: `2px solid ${theme.palette.secondary.main}`,
                                        borderBottom: `1px solid ${theme.palette.secondary.main}`,
                                    }}
                                >
                                    Debt Payments:
                                </TableCell>
                            </TableRow>
                            {loanNames.map((loanName) => {
                                const loanItem = loanItems.find(item => (item.loanTitle || item.name) === loanName);
                                if (!loanItem) return null;

                                const paymentName = `Afdrag til ${loanName.toLowerCase()}`;
                                return (
                                    <TableRow key={`payment-${loanName}`}>
                                        <TableCell
                                            sx={{
                                                color: theme.palette.text.primary,
                                                borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                padding: '12px 8px',
                                            }}
                                        >
                                            {paymentName}
                                        </TableCell>
                                        {MONTHS.map((month) => {
                                            const isEditing = editingCell?.section === 'debtPayments' && editingCell?.loanName === loanName && editingCell?.month === month;
                                            const cellValue = loanItem.months[month] || 0;

                                            return (
                                                <TableCell
                                                    key={month}
                                                    align="center"
                                                    onClick={() => handleCellClick('debtPayments', loanName, month)}
                                                    sx={{
                                                        color: theme.palette.text.primary,
                                                        padding: '4px',
                                                        fontSize: '0.875rem',
                                                        cursor: 'pointer',
                                                        '&:hover': {
                                                            bgcolor: theme.palette.background.default,
                                                        },
                                                    }}
                                                >
                                                    {isEditing ? (
                                                        <TextField
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onBlur={handleCellSave}
                                                            onKeyDown={handleCellKeyPress}
                                                            autoFocus
                                                            type="number"
                                                            size="small"
                                                            sx={{
                                                                width: '80px',
                                                                '& .MuiOutlinedInput-root': {
                                                                    color: theme.palette.text.primary,
                                                                    bgcolor: theme.palette.background.paper,
                                                                    '& fieldset': {
                                                                        borderColor: theme.palette.primary.main,
                                                                    },
                                                                    '&:hover fieldset': {
                                                                        borderColor: theme.palette.primary.main,
                                                                    },
                                                                    '&.Mui-focused fieldset': {
                                                                        borderColor: theme.palette.primary.main,
                                                                    },
                                                                },
                                                            }}
                                                            inputProps={{
                                                                style: {
                                                                    textAlign: 'center',
                                                                    padding: '4px 8px',
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        cellValue === 0 ? '--' : formatCurrency(cellValue, currency)
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })}
                            {/* Total Debt Payments */}
                            <TableRow>
                                <TableCell
                                    sx={{
                                        color: theme.palette.text.primary,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: '12px 8px',
                                        fontWeight: 'bold',
                                        bgcolor: theme.palette.background.default,
                                    }}
                                >
                                    Total Debt Payments
                                </TableCell>
                                {MONTHS.map((month) => {
                                    const total = loanItems.reduce((sum, loanItem) => {
                                        return sum + (loanItem.months[month] || 0);
                                    }, 0);

                                    return (
                                        <TableCell
                                            key={month}
                                            align="center"
                                            sx={{
                                                color: theme.palette.text.primary,
                                                padding: '12px 4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                bgcolor: theme.palette.background.default,
                                            }}
                                        >
                                            {total === 0 ? '--' : formatCurrency(total, currency)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>

                            {/* Outstanding Debt – End of Month Section */}
                            <TableRow>
                                <TableCell
                                    colSpan={13}
                                    sx={{
                                        bgcolor: theme.palette.background.default,
                                        color: theme.palette.text.primary,
                                        fontWeight: 'bold',
                                        padding: '12px 8px',
                                        borderTop: `2px solid ${theme.palette.secondary.main}`,
                                        borderBottom: `1px solid ${theme.palette.secondary.main}`,
                                    }}
                                >
                                    Outstanding Debt – End of Month:
                                </TableCell>
                            </TableRow>
                            {loanNames.map((loanName) => {
                                const loanItem = loanItems.find(item => (item.loanTitle || item.name) === loanName);
                                if (!loanItem) return null;

                                return (
                                    <TableRow key={`end-${loanName}`}>
                                        <TableCell
                                            sx={{
                                                color: theme.palette.text.primary,
                                                borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                padding: '12px 8px',
                                            }}
                                        >
                                            {loanName}
                                        </TableCell>
                                        {MONTHS.map((month) => {
                                            const cellValue = getOutstandingDebtEnd(loanItem, month);

                                            return (
                                                <TableCell
                                                    key={month}
                                                    align="center"
                                                    sx={{
                                                        color: cellValue > 0 ? theme.palette.info.main : theme.palette.text.primary,
                                                        padding: '4px',
                                                        fontSize: '0.875rem',
                                                    }}
                                                >
                                                    {cellValue === 0 ? '--' : formatCurrency(cellValue, currency)}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })}
                            {/* Total Outstanding - End */}
                            <TableRow>
                                <TableCell
                                    sx={{
                                        color: theme.palette.text.primary,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: '12px 8px',
                                        fontWeight: 'bold',
                                        bgcolor: theme.palette.background.default,
                                    }}
                                >
                                    Total Outstanding
                                </TableCell>
                                {MONTHS.map((month) => {
                                    const total = loanItems.reduce((sum, loanItem) => {
                                        return sum + getOutstandingDebtEnd(loanItem, month);
                                    }, 0);

                                    return (
                                        <TableCell
                                            key={month}
                                            align="center"
                                            sx={{
                                                color: total > 0 ? theme.palette.info.main : theme.palette.text.primary,
                                                padding: '12px 4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                bgcolor: theme.palette.background.default,
                                            }}
                                        >
                                            {total === 0 ? '--' : formatCurrency(total, currency)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        </TableBody>
                    </Table>
                </Paper>
            </Box>
        </Box>
    );
}
