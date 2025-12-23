import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, Menu } from "@mui/material";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import EditIcon from '@mui/icons-material/Edit';
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
    formulas?: { [key: string]: string }; // Store formulas like "=2+2" or "=A1+B1"
    linkedLoanId?: string; // ID of the loan this expense is linked to
    isLoan?: boolean; // Deprecated: kept for backward compatibility
    loanTitle?: string; // Deprecated: kept for backward compatibility
    loanStartDate?: string; // Deprecated: kept for backward compatibility
    loanValue?: number; // Deprecated: kept for backward compatibility
    isStaticExpense?: boolean;
    staticExpenseDate?: string; // Format: "YYYY-MM-DD"
    staticExpensePrice?: number;
}

interface Loan {
    id: string;
    userId: string;
    name: string;
    amount: number;
    startDate: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function Budget() {
    const { year } = useParams<{ year: string }>();
    const { user, isLoaded } = useUser();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<'income' | 'expense' | 'loan' | 'staticExpense' | null>(null);
    const [itemName, setItemName] = useState('');
    const [isLoan, setIsLoan] = useState(false);
    const [loanTitle, setLoanTitle] = useState('');
    const [loanStartDate, setLoanStartDate] = useState('');
    const [loanValue, setLoanValue] = useState('');
    const [isStaticExpense, setIsStaticExpense] = useState(false);
    const [staticExpenseName, setStaticExpenseName] = useState('');
    const [staticExpenseDate, setStaticExpenseDate] = useState('');
    const [staticExpensePrice, setStaticExpensePrice] = useState('');
    const [linkedLoanId, setLinkedLoanId] = useState<string>('');
    const [loans, setLoans] = useState<Loan[]>([]);
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [editingCell, setEditingCell] = useState<{ itemId: string; month: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editingFrequency, setEditingFrequency] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [selectedItemForDelete, setSelectedItemForDelete] = useState<string | null>(null);
    const [currency, setCurrency] = useState<Currency>(getStoredCurrency());
    const [editingStaticExpense, setEditingStaticExpense] = useState<string | null>(null);
    const [editStaticExpenseName, setEditStaticExpenseName] = useState('');
    const [editStaticExpenseDate, setEditStaticExpenseDate] = useState('');
    const [editStaticExpensePrice, setEditStaticExpensePrice] = useState('');

    const FREQUENCY_OPTIONS = ['Monthly', 'Quarterly', 'Six-Monthly', 'Yearly'];

    // Evaluate a formula string (e.g., "=2+2" or "=10*1.5")
    const evaluateFormula = (formula: string): number => {
        try {
            // Remove the leading "="
            const expression = formula.substring(1).trim();

            // For now, just evaluate basic math expressions
            // Using Function constructor for safe evaluation (only allows math operations)
            // This is safer than eval() but still allows basic arithmetic
            const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
            if (sanitized !== expression.replace(/\s/g, '')) {
                // If sanitization removed non-whitespace characters, it's not a safe expression
                return 0;
            }

            // Use Function constructor to evaluate the expression
            // This is safer than eval() as it runs in a limited scope
            const result = new Function('return ' + sanitized)();
            return typeof result === 'number' && !isNaN(result) ? result : 0;
        } catch (e) {
            console.error('Error evaluating formula:', e);
            return 0;
        }
    };

    // Get the calculated value for a cell (checks for formula first, then uses direct value)
    const getCellValue = (item: LineItem, month: string): number => {
        // Check if there's a formula for this cell
        // First check the formulas field, then check if stored in months._formulas
        const formula = item.formulas?.[month] || (item.months as any)?._formulas?.[month];
        if (formula) {
            return evaluateFormula(formula);
        }
        // Otherwise return the direct value
        return item.months[month] || 0;
    };

    // Load loans on mount
    useEffect(() => {
        if (isLoaded && user?.id) {
            loadLoans();
        }
    }, [isLoaded, user?.id]);

    // Load budget data on mount
    useEffect(() => {
        if (isLoaded && user?.id && year) {
            loadBudgetData();
        }
    }, [isLoaded, user?.id, year]);

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

    // Save budget data whenever lineItems change
    useEffect(() => {
        if (isLoaded && user?.id && year && lineItems.length >= 0 && !loading) {
            // Debounce saves to avoid too many API calls
            const timeoutId = setTimeout(() => {
                saveBudgetData();
            }, 1000);

            return () => clearTimeout(timeoutId);
        }
    }, [lineItems, isLoaded, user?.id, year]);

    const loadLoans = async () => {
        if (!user?.id) return;

        try {
            const response = await fetch(`${API_BASE_URL}/loans`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
            });

            if (response.ok) {
                const loansData = await response.json();
                setLoans(loansData);
            }
        } catch (error) {
            console.error('Error loading loans:', error);
        }
    };

    const loadBudgetData = async () => {
        if (!user?.id || !year) return;

        setLoading(true);
        try {
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
                // Ensure items with static expense properties are marked as static expenses
                // This is a safeguard in case the API didn't set the flag
                // Also extract formulas from months._formulas if they exist
                const normalizedItems = items.map((item: LineItem) => {
                    const normalizedItem = { ...item };

                    // Extract formulas from months._formulas if they exist
                    if ((item.months as any)?._formulas) {
                        normalizedItem.formulas = (item.months as any)._formulas;
                        // Remove _formulas from months to keep it clean
                        const { _formulas, ...cleanMonths } = item.months as any;
                        normalizedItem.months = cleanMonths;
                    }

                    if ((item.staticExpenseDate || item.staticExpensePrice) && !item.isStaticExpense) {
                        normalizedItem.isStaticExpense = true;
                    }
                    return normalizedItem;
                });
                // Debug: Log loan items after loading
                const loanItems = normalizedItems.filter((item: LineItem) => item.isLoan);
                if (loanItems.length > 0) {
                } else {
                }
                setLineItems(normalizedItems);
            }
        } catch (error) {
            console.error('Error loading budget data:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveBudgetData = async () => {
        if (!user?.id || !year || saving) return;

        setSaving(true);
        try {
            // Ensure items with static expense properties are marked as static expenses before saving
            // Also merge formulas back into months._formulas for persistence
            const normalizedItems = lineItems.map((item: LineItem) => {
                const normalizedItem = { ...item };

                // Merge formulas back into months._formulas if they exist
                if (item.formulas && Object.keys(item.formulas).length > 0) {
                    const monthsWithFormulas = { ...item.months };
                    (monthsWithFormulas as any)._formulas = item.formulas;
                    normalizedItem.months = monthsWithFormulas;
                }

                if ((item.staticExpenseDate || item.staticExpensePrice) && !item.isStaticExpense) {
                    normalizedItem.isStaticExpense = true;
                }
                return normalizedItem;
            });
            const encodedYear = encodeURIComponent(year);
            const response = await fetch(`${API_BASE_URL}/budgets/${encodedYear}/data`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
                body: JSON.stringify({ items: normalizedItems }),
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

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchor(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
    };

    const handleOpenModal = (type: 'income' | 'expense' | 'loan' | 'staticExpense') => {
        setModalOpen(true);
        setSelectedType(type);
        setItemName('');
        setIsLoan(type === 'loan');
        setIsStaticExpense(type === 'staticExpense');
        setLoanTitle('');
        setLoanStartDate('');
        setLoanValue('');
        setStaticExpenseName('');
        setStaticExpenseDate('');
        setStaticExpensePrice('');
        setLinkedLoanId('');
        handleCloseMenu();
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedType(null);
        setItemName('');
        setIsLoan(false);
        setIsStaticExpense(false);
        setLoanTitle('');
        setLoanStartDate('');
        setLoanValue('');
        setStaticExpenseName('');
        setStaticExpenseDate('');
        setStaticExpensePrice('');
        setLinkedLoanId('');
    };

    const handleCreateItem = () => {
        if (isLoan) {
            if (!loanTitle.trim() || !loanStartDate || !loanValue) return;
        } else if (isStaticExpense) {
            if (!staticExpenseName.trim() || !staticExpenseDate || !staticExpensePrice) return;
        } else {
            if (!itemName.trim() || !selectedType) return;
        }

        let itemType: 'income' | 'expense';
        if (isLoan || isStaticExpense) {
            itemType = 'expense'; // Loans and static expenses are tracked as expenses
        } else if (selectedType === 'loan' || selectedType === 'staticExpense' || !selectedType) {
            itemType = 'expense';
        } else if (selectedType === 'income') {
            itemType = 'income';
        } else {
            itemType = 'expense';
        }

        // For static expenses, determine which month the date falls in
        let months: { [key: string]: number } = {};
        if (isStaticExpense && staticExpenseDate) {
            const date = new Date(staticExpenseDate);
            const monthIndex = date.getMonth();
            const monthName = MONTHS[monthIndex];
            const price = parseFloat(staticExpensePrice) || 0;
            months[monthName] = price;
        }

        const newItem: LineItem = {
            id: Date.now().toString(),
            name: isLoan ? loanTitle.trim() : isStaticExpense ? staticExpenseName.trim() : itemName.trim(),
            type: itemType,
            amount: 0,
            frequency: 'Monthly',
            months: months,
            ...(linkedLoanId && {
                linkedLoanId: linkedLoanId
            }),
            ...(isLoan && {
                isLoan: true,
                loanTitle: loanTitle.trim(),
                loanStartDate: loanStartDate,
                loanValue: parseFloat(loanValue) || 0
            }),
            ...(isStaticExpense && {
                isStaticExpense: true,
                staticExpenseDate: staticExpenseDate,
                staticExpensePrice: parseFloat(staticExpensePrice) || 0
            })
        };

        const updatedItems = [...lineItems, newItem];
        setLineItems(updatedItems);
        handleCloseModal();
    };

    const handleCellClick = (itemId: string, month: string) => {
        const item = lineItems.find(i => i.id === itemId);
        if (!item) return;

        // If there's a formula, show it; otherwise show the calculated value
        // Check both formulas field and months._formulas
        const formula = item.formulas?.[month] || (item.months as any)?._formulas?.[month];
        const displayValue = formula || (item.months[month] || 0).toString();

        setEditingCell({ itemId, month });
        setEditValue(displayValue);
        setSelectedItemForDelete(null);
    };

    const handleCellSave = () => {
        if (!editingCell) return;

        const trimmedValue = editValue.trim();
        const isFormula = trimmedValue.startsWith('=');

        const updatedItems = lineItems.map(item => {
            if (item.id === editingCell.itemId) {
                const updatedItem = { ...item };
                const monthsCopy = { ...updatedItem.months };

                if (isFormula) {
                    // Store the formula in months._formulas (so it persists in database)
                    // Also store in formulas field for easy access
                    if (!(monthsCopy as any)._formulas) {
                        (monthsCopy as any)._formulas = {};
                    }
                    (monthsCopy as any)._formulas[editingCell.month] = trimmedValue;

                    updatedItem.formulas = {
                        ...(updatedItem.formulas || {}),
                        [editingCell.month]: trimmedValue
                    };
                    // Calculate and store the result
                    const calculatedValue = evaluateFormula(trimmedValue);
                    monthsCopy[editingCell.month] = calculatedValue;
                    updatedItem.months = monthsCopy;
                } else {
                    // Remove formula if it exists and store direct value
                    if ((monthsCopy as any)._formulas) {
                        delete (monthsCopy as any)._formulas[editingCell.month];
                        // Clean up empty _formulas object
                        if (Object.keys((monthsCopy as any)._formulas).length === 0) {
                            delete (monthsCopy as any)._formulas;
                        }
                    }
                    if (updatedItem.formulas) {
                        const { [editingCell.month]: removed, ...restFormulas } = updatedItem.formulas;
                        updatedItem.formulas = Object.keys(restFormulas).length > 0 ? restFormulas : undefined;
                    }
                    const numericValue = parseFloat(trimmedValue) || 0;
                    monthsCopy[editingCell.month] = numericValue;
                    updatedItem.months = monthsCopy;
                }

                return updatedItem;
            }
            return item;
        });

        setLineItems(updatedItems);
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

    const handleFrequencyClick = (itemId: string) => {
        setEditingFrequency(itemId);
        setSelectedItemForDelete(null);
    };

    const handleFrequencyChange = (itemId: string, frequency: string) => {
        const updatedItems = lineItems.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    frequency: frequency
                };
            }
            return item;
        });
        setLineItems(updatedItems);
        setEditingFrequency(null);
    };

    const handleDeleteItem = (itemId: string) => {
        const updatedItems = lineItems.filter(item => item.id !== itemId);
        setLineItems(updatedItems);
        setSelectedItemForDelete(null);
    };

    const handleNameCellClick = (itemId: string) => {
        setSelectedItemForDelete(selectedItemForDelete === itemId ? null : itemId);
    };

    return (
        <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
            <Navbar />
            <Box sx={{ padding: '2rem', flex: 1, width: '100%', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: '2rem' }}>
                    <Typography sx={{ color: theme.palette.text.primary }} variant="h4">
                        Budget {year}
                    </Typography>
                    <IconButton
                        onClick={handleOpenMenu}
                        disabled={!isLoaded || !user?.id || loading}
                        sx={{
                            color: theme.palette.primary.main,
                            bgcolor: theme.palette.background.paper,
                            '&:hover': {
                                bgcolor: theme.palette.primary.main,
                                color: theme.palette.primary.contrastText,
                            },
                            '&:disabled': {
                                opacity: 0.5,
                            },
                        }}
                    >
                        <AddIcon />
                    </IconButton>
                    <Menu
                        anchorEl={menuAnchor}
                        open={Boolean(menuAnchor)}
                        onClose={handleCloseMenu}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                        }}
                        PaperProps={{
                            sx: {
                                bgcolor: theme.palette.background.paper,
                                color: theme.palette.text.primary,
                            }
                        }}
                    >
                        <MenuItem
                            onClick={() => handleOpenModal('income')}
                            sx={{
                                color: theme.palette.success.main,
                                '&:hover': {
                                    bgcolor: theme.palette.success.main,
                                    color: theme.palette.success.contrastText,
                                },
                            }}
                        >
                            Add Income
                        </MenuItem>
                        <MenuItem
                            onClick={() => handleOpenModal('expense')}
                            sx={{
                                color: theme.palette.error.main,
                                '&:hover': {
                                    bgcolor: theme.palette.error.main,
                                    color: theme.palette.error.contrastText,
                                },
                            }}
                        >
                            Add Expense
                        </MenuItem>
                        <MenuItem
                            onClick={() => handleOpenModal('staticExpense')}
                            sx={{
                                color: theme.palette.warning.main,
                                '&:hover': {
                                    bgcolor: theme.palette.warning.main,
                                    color: theme.palette.warning.contrastText,
                                },
                            }}
                        >
                            Add Fun Expense
                        </MenuItem>
                    </Menu>
                </Box>

                <Paper sx={{ bgcolor: theme.palette.background.paper, overflow: 'hidden', width: '100%' }}>
                    <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
                        <TableHead>
                            <TableRow>
                                <TableCell
                                    sx={{
                                        bgcolor: theme.palette.background.paper,
                                        color: theme.palette.text.primary,
                                        fontWeight: 'bold',
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        width: '15%',
                                        padding: '12px 8px',
                                    }}
                                >
                                    Amount
                                </TableCell>
                                <TableCell
                                    sx={{
                                        bgcolor: theme.palette.background.paper,
                                        color: theme.palette.text.primary,
                                        fontWeight: 'bold',
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        width: '12%',
                                        padding: '12px 8px',
                                    }}
                                >
                                    Frequency
                                </TableCell>
                                {MONTHS.map((month) => (
                                    <TableCell
                                        key={month}
                                        align="center"
                                        sx={{
                                            bgcolor: theme.palette.background.paper,
                                            color: theme.palette.text.primary,
                                            fontWeight: 'bold',
                                            width: `${73 / 12}%`,
                                            padding: '12px 4px',
                                            fontSize: '0.8rem',
                                        }}
                                    >
                                        {month.substring(0, 3)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {/* Income Items */}
                            {lineItems
                                .filter(item => item.type === 'income')
                                .map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell
                                            onClick={() => handleNameCellClick(item.id)}
                                            sx={{
                                                color: theme.palette.success.main,
                                                borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                padding: '12px 8px',
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    bgcolor: theme.palette.background.default,
                                                },
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <span style={{ flex: 1 }}>{item.name}</span>
                                                {selectedItemForDelete === item.id && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteItem(item.id);
                                                        }}
                                                        sx={{
                                                            color: theme.palette.error.main,
                                                            padding: '4px',
                                                            '&:hover': {
                                                                bgcolor: theme.palette.error.main,
                                                                color: theme.palette.error.contrastText,
                                                            },
                                                        }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell
                                            onClick={() => handleFrequencyClick(item.id)}
                                            sx={{
                                                color: theme.palette.text.primary,
                                                borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                padding: '12px 8px',
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    bgcolor: theme.palette.background.default,
                                                },
                                            }}
                                        >
                                            {editingFrequency === item.id ? (
                                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                                    <Select
                                                        value={item.frequency}
                                                        onChange={(e) => handleFrequencyChange(item.id, e.target.value)}
                                                        onBlur={() => setEditingFrequency(null)}
                                                        autoFocus
                                                        sx={{
                                                            color: theme.palette.text.primary,
                                                            '& .MuiOutlinedInput-notchedOutline': {
                                                                borderColor: theme.palette.primary.main,
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
                                                        {FREQUENCY_OPTIONS.map((option) => (
                                                            <MenuItem
                                                                key={option}
                                                                value={option}
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
                                                                {option}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            ) : (
                                                item.frequency
                                            )}
                                        </TableCell>
                                        {MONTHS.map((month) => {
                                            const isEditing = editingCell?.itemId === item.id && editingCell?.month === month;
                                            const cellValue = getCellValue(item, month);

                                            return (
                                                <TableCell
                                                    key={month}
                                                    align="center"
                                                    onClick={() => handleCellClick(item.id, month)}
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
                                                            type="text"
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
                                                        formatCurrency(cellValue, currency)
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            {/* Total Income Row */}
                            <TableRow>
                                <TableCell
                                    colSpan={2}
                                    sx={{
                                        color: theme.palette.success.main,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: '12px 8px',
                                        fontWeight: 'bold',
                                        bgcolor: theme.palette.background.default,
                                    }}
                                >
                                    Total Income
                                </TableCell>
                                {MONTHS.map((month) => {
                                    const totalIncome = lineItems
                                        .filter(item => item.type === 'income')
                                        .reduce((sum, item) => sum + (item.months[month] || 0), 0);

                                    return (
                                        <TableCell
                                            key={month}
                                            align="center"
                                            sx={{
                                                color: theme.palette.success.main,
                                                padding: '12px 4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                bgcolor: theme.palette.background.default,
                                            }}
                                        >
                                            {totalIncome === 0 ? '-' : formatCurrency(totalIncome, currency)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                            {/* Separator Row */}
                            <TableRow>
                                <TableCell
                                    colSpan={14}
                                    sx={{
                                        padding: '24px 8px',
                                        bgcolor: theme.palette.background.default,
                                        borderTop: `2px solid ${theme.palette.secondary.main}`,
                                        borderBottom: `2px solid ${theme.palette.secondary.main}`,
                                    }}
                                />
                            </TableRow>
                            {/* Regular Expense Items */}
                            {lineItems
                                .filter(item => item.type === 'expense' && !item.isLoan && !item.isStaticExpense)
                                .map((item) => {
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell
                                                onClick={() => handleNameCellClick(item.id)}
                                                sx={{
                                                    color: item.linkedLoanId ? theme.palette.info.main : theme.palette.error.main,
                                                    borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                    padding: '12px 8px',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        bgcolor: theme.palette.background.default,
                                                    },
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {item.linkedLoanId && (
                                                        <AccountBalanceIcon
                                                            sx={{
                                                                fontSize: '1rem',
                                                                color: theme.palette.info.main,
                                                                opacity: 0.8
                                                            }}
                                                        />
                                                    )}
                                                    <span style={{ flex: 1 }}>
                                                        {item.name}
                                                    </span>
                                                    {selectedItemForDelete === item.id && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteItem(item.id);
                                                            }}
                                                            sx={{
                                                                color: item.linkedLoanId ? theme.palette.info.main : theme.palette.error.main,
                                                                padding: '4px',
                                                                '&:hover': {
                                                                    bgcolor: item.linkedLoanId ? theme.palette.info.main : theme.palette.error.main,
                                                                    color: item.linkedLoanId ? theme.palette.info.contrastText : theme.palette.error.contrastText,
                                                                },
                                                            }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell
                                                onClick={() => handleFrequencyClick(item.id)}
                                                sx={{
                                                    color: theme.palette.text.primary,
                                                    borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                    padding: '12px 8px',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        bgcolor: theme.palette.background.default,
                                                    },
                                                }}
                                            >
                                                {editingFrequency === item.id ? (
                                                    <FormControl size="small" sx={{ minWidth: 120 }}>
                                                        <Select
                                                            value={item.frequency}
                                                            onChange={(e) => handleFrequencyChange(item.id, e.target.value)}
                                                            onBlur={() => setEditingFrequency(null)}
                                                            autoFocus
                                                            sx={{
                                                                color: theme.palette.text.primary,
                                                                '& .MuiOutlinedInput-notchedOutline': {
                                                                    borderColor: theme.palette.primary.main,
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
                                                            {FREQUENCY_OPTIONS.map((option) => (
                                                                <MenuItem
                                                                    key={option}
                                                                    value={option}
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
                                                                    {option}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                ) : (
                                                    item.frequency
                                                )}
                                            </TableCell>
                                            {MONTHS.map((month) => {
                                                const isEditing = editingCell?.itemId === item.id && editingCell?.month === month;
                                                const cellValue = getCellValue(item, month);

                                                return (
                                                    <TableCell
                                                        key={month}
                                                        align="center"
                                                        onClick={() => handleCellClick(item.id, month)}
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
                                                                type="text"
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
                                                            formatCurrency(cellValue, currency)
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
                            {/* Static Expenses Summary Row (above loans) */}
                            {(() => {
                                const staticExpenses = lineItems.filter(item => item.type === 'expense' && item.isStaticExpense);
                                if (staticExpenses.length === 0) return null;

                                return (
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                color: theme.palette.warning.main,
                                                borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                padding: '12px 8px',
                                                fontWeight: 'bold',
                                                bgcolor: theme.palette.background.default,
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <LocalActivityIcon
                                                    sx={{
                                                        fontSize: '1rem',
                                                        color: theme.palette.warning.main,
                                                        opacity: 0.8
                                                    }}
                                                />
                                                <span>Fun Expenses</span>
                                            </Box>
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                color: theme.palette.text.primary,
                                                borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                padding: '12px 8px',
                                                bgcolor: theme.palette.background.default,
                                            }}
                                        >
                                            -
                                        </TableCell>
                                        {MONTHS.map((month) => {
                                            const totalStaticExpense = staticExpenses.reduce((sum, item) => sum + (item.months[month] || 0), 0);
                                            return (
                                                <TableCell
                                                    key={month}
                                                    align="center"
                                                    sx={{
                                                        color: theme.palette.warning.main,
                                                        padding: '12px 4px',
                                                        fontSize: '0.875rem',
                                                        fontWeight: 'bold',
                                                        bgcolor: theme.palette.background.default,
                                                    }}
                                                >
                                                    {totalStaticExpense === 0 ? '-' : formatCurrency(totalStaticExpense, currency)}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })()}
                            {/* Loan Items (at bottom of expenses) */}
                            {lineItems
                                .filter(item => item.type === 'expense' && item.isLoan)
                                .map((item) => {
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell
                                                onClick={() => handleNameCellClick(item.id)}
                                                sx={{
                                                    color: theme.palette.info.main,
                                                    borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                    padding: '12px 8px',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        bgcolor: theme.palette.background.default,
                                                    },
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <AccountBalanceIcon
                                                        sx={{
                                                            fontSize: '1rem',
                                                            color: theme.palette.info.main,
                                                            opacity: 0.8
                                                        }}
                                                    />
                                                    <span style={{ flex: 1 }}>
                                                        {item.loanTitle || item.name}
                                                    </span>
                                                    {selectedItemForDelete === item.id && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteItem(item.id);
                                                            }}
                                                            sx={{
                                                                color: theme.palette.info.main,
                                                                padding: '4px',
                                                                '&:hover': {
                                                                    bgcolor: theme.palette.info.main,
                                                                    color: theme.palette.info.contrastText,
                                                                },
                                                            }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell
                                                onClick={() => handleFrequencyClick(item.id)}
                                                sx={{
                                                    color: theme.palette.text.primary,
                                                    borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                    padding: '12px 8px',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        bgcolor: theme.palette.background.default,
                                                    },
                                                }}
                                            >
                                                {editingFrequency === item.id ? (
                                                    <FormControl size="small" sx={{ minWidth: 120 }}>
                                                        <Select
                                                            value={item.frequency}
                                                            onChange={(e) => handleFrequencyChange(item.id, e.target.value)}
                                                            onBlur={() => setEditingFrequency(null)}
                                                            autoFocus
                                                            sx={{
                                                                color: theme.palette.text.primary,
                                                                '& .MuiOutlinedInput-notchedOutline': {
                                                                    borderColor: theme.palette.primary.main,
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
                                                            {FREQUENCY_OPTIONS.map((option) => (
                                                                <MenuItem
                                                                    key={option}
                                                                    value={option}
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
                                                                    {option}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                ) : (
                                                    item.frequency
                                                )}
                                            </TableCell>
                                            {MONTHS.map((month) => {
                                                const isEditing = editingCell?.itemId === item.id && editingCell?.month === month;
                                                const cellValue = getCellValue(item, month);

                                                return (
                                                    <TableCell
                                                        key={month}
                                                        align="center"
                                                        onClick={() => handleCellClick(item.id, month)}
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
                                                                type="text"
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
                                                            formatCurrency(cellValue, currency)
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
                            {/* Total Expense Row */}
                            <TableRow>
                                <TableCell
                                    colSpan={2}
                                    sx={{
                                        color: theme.palette.error.main,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: '12px 8px',
                                        fontWeight: 'bold',
                                        bgcolor: theme.palette.background.default,
                                    }}
                                >
                                    Total Expense
                                </TableCell>
                                {MONTHS.map((month) => {
                                    const totalExpense = lineItems
                                        .filter(item => item.type === 'expense')
                                        .reduce((sum, item) => sum + (item.months[month] || 0), 0);

                                    return (
                                        <TableCell
                                            key={month}
                                            align="center"
                                            sx={{
                                                color: theme.palette.error.main,
                                                padding: '12px 4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                bgcolor: theme.palette.background.default,
                                            }}
                                        >
                                            {totalExpense === 0 ? '-' : formatCurrency(totalExpense, currency)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                            {/* Separator Row */}
                            <TableRow>
                                <TableCell
                                    colSpan={14}
                                    sx={{
                                        padding: '24px 8px',
                                        bgcolor: theme.palette.background.default,
                                        borderTop: `2px solid ${theme.palette.secondary.main}`,
                                        borderBottom: `2px solid ${theme.palette.secondary.main}`,
                                    }}
                                />
                            </TableRow>
                            {/* Savings Row */}
                            <TableRow>
                                <TableCell
                                    colSpan={2}
                                    sx={{
                                        color: theme.palette.info.main,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: '12px 8px',
                                        fontWeight: 'bold',
                                        bgcolor: theme.palette.background.default,
                                    }}
                                >
                                    Savings
                                </TableCell>
                                {MONTHS.map((month) => {
                                    const totalIncome = lineItems
                                        .filter(item => item.type === 'income')
                                        .reduce((sum, item) => sum + (item.months[month] || 0), 0);
                                    const totalExpense = lineItems
                                        .filter(item => item.type === 'expense')
                                        .reduce((sum, item) => sum + (item.months[month] || 0), 0);
                                    const savings = totalIncome - totalExpense;

                                    return (
                                        <TableCell
                                            key={month}
                                            align="center"
                                            sx={{
                                                color: savings >= 0 ? theme.palette.success.main : theme.palette.error.main,
                                                padding: '12px 4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                bgcolor: theme.palette.background.default,
                                            }}
                                        >
                                            {savings === 0 ? '-' : formatCurrency(savings, currency)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                            {/* Cumulative Savings Row */}
                            <TableRow>
                                <TableCell
                                    colSpan={2}
                                    sx={{
                                        color: theme.palette.info.main,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: '12px 8px',
                                        fontWeight: 'bold',
                                        bgcolor: theme.palette.background.default,
                                    }}
                                >
                                    Cumulative Savings
                                </TableCell>
                                {MONTHS.map((month, monthIndex) => {
                                    let cumulativeSavings = 0;
                                    for (let i = 0; i <= monthIndex; i++) {
                                        const currentMonth = MONTHS[i];
                                        const totalIncome = lineItems
                                            .filter(item => item.type === 'income')
                                            .reduce((sum, item) => sum + (item.months[currentMonth] || 0), 0);
                                        const totalExpense = lineItems
                                            .filter(item => item.type === 'expense')
                                            .reduce((sum, item) => sum + (item.months[currentMonth] || 0), 0);
                                        cumulativeSavings += totalIncome - totalExpense;
                                    }

                                    return (
                                        <TableCell
                                            key={month}
                                            align="center"
                                            sx={{
                                                color: cumulativeSavings >= 0 ? theme.palette.success.main : theme.palette.error.main,
                                                padding: '12px 4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                bgcolor: theme.palette.background.default,
                                            }}
                                        >
                                            {cumulativeSavings === 0 ? '-' : formatCurrency(cumulativeSavings, currency)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        </TableBody>
                    </Table>
                </Paper>

                {/* Static Expenses List */}
                <Paper sx={{ bgcolor: theme.palette.background.paper, padding: '2rem', marginTop: '2rem' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: '1.5rem' }}>
                        <LocalActivityIcon sx={{ color: theme.palette.warning.main }} />
                        <Typography sx={{ color: theme.palette.text.primary }} variant="h5">
                            Fun Expenses
                        </Typography>
                    </Box>
                    {lineItems.filter(item => item.type === 'expense' && item.isStaticExpense).length === 0 ? (
                        <Typography sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
                            No static expenses added yet. Click the add button to create one.
                        </Typography>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {lineItems
                                .filter(item => item.type === 'expense' && item.isStaticExpense)
                                .sort((a, b) => {
                                    const dateA = a.staticExpenseDate || '';
                                    const dateB = b.staticExpenseDate || '';
                                    return dateA.localeCompare(dateB);
                                })
                                .map((item) => {
                                    const isEditing = editingStaticExpense === item.id;
                                    return (
                                        <Paper
                                            key={item.id}
                                            sx={{
                                                bgcolor: theme.palette.background.default,
                                                padding: '1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 2,
                                                '&:hover': {
                                                    bgcolor: theme.palette.background.paper,
                                                },
                                            }}
                                        >
                                            {isEditing ? (
                                                <>
                                                    <TextField
                                                        label="Name"
                                                        value={editStaticExpenseName}
                                                        onChange={(e) => setEditStaticExpenseName(e.target.value)}
                                                        size="small"
                                                        sx={{
                                                            flex: 1,
                                                            '& .MuiOutlinedInput-root': {
                                                                color: theme.palette.text.primary,
                                                                '& fieldset': {
                                                                    borderColor: theme.palette.secondary.main,
                                                                },
                                                            },
                                                        }}
                                                    />
                                                    <TextField
                                                        label="Date"
                                                        type="date"
                                                        value={editStaticExpenseDate}
                                                        onChange={(e) => setEditStaticExpenseDate(e.target.value)}
                                                        size="small"
                                                        InputLabelProps={{ shrink: true }}
                                                        sx={{
                                                            '& .MuiOutlinedInput-root': {
                                                                color: theme.palette.text.primary,
                                                                '& fieldset': {
                                                                    borderColor: theme.palette.secondary.main,
                                                                },
                                                            },
                                                        }}
                                                    />
                                                    <TextField
                                                        label="Price"
                                                        type="number"
                                                        value={editStaticExpensePrice}
                                                        onChange={(e) => setEditStaticExpensePrice(e.target.value)}
                                                        size="small"
                                                        sx={{
                                                            width: '120px',
                                                            '& .MuiOutlinedInput-root': {
                                                                color: theme.palette.text.primary,
                                                                '& fieldset': {
                                                                    borderColor: theme.palette.secondary.main,
                                                                },
                                                            },
                                                        }}
                                                    />
                                                    <Button
                                                        onClick={() => {
                                                            if (!editStaticExpenseName.trim() || !editStaticExpenseDate || !editStaticExpensePrice) return;

                                                            const date = new Date(editStaticExpenseDate);
                                                            const monthIndex = date.getMonth();
                                                            const monthName = MONTHS[monthIndex];
                                                            const price = parseFloat(editStaticExpensePrice) || 0;

                                                            const updatedItems = lineItems.map(li => {
                                                                if (li.id === item.id) {
                                                                    const newMonths: { [key: string]: number } = {};
                                                                    newMonths[monthName] = price;
                                                                    return {
                                                                        ...li,
                                                                        name: editStaticExpenseName.trim(),
                                                                        staticExpenseDate: editStaticExpenseDate,
                                                                        staticExpensePrice: price,
                                                                        months: newMonths,
                                                                        isStaticExpense: true, // Explicitly preserve the flag
                                                                    };
                                                                }
                                                                return li;
                                                            });
                                                            setLineItems(updatedItems);
                                                            setEditingStaticExpense(null);
                                                            setEditStaticExpenseName('');
                                                            setEditStaticExpenseDate('');
                                                            setEditStaticExpensePrice('');
                                                        }}
                                                        variant="contained"
                                                        size="small"
                                                        sx={{
                                                            bgcolor: theme.palette.primary.main,
                                                            color: theme.palette.primary.contrastText,
                                                        }}
                                                    >
                                                        Save
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            setEditingStaticExpense(null);
                                                            setEditStaticExpenseName('');
                                                            setEditStaticExpenseDate('');
                                                            setEditStaticExpensePrice('');
                                                        }}
                                                        size="small"
                                                        sx={{
                                                            color: theme.palette.text.secondary,
                                                        }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                        <Typography sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                                                            {item.name}
                                                        </Typography>
                                                        <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                                                            {item.staticExpenseDate ? new Date(item.staticExpenseDate).toLocaleDateString() : 'No date'}
                                                        </Typography>
                                                    </Box>
                                                    <Typography sx={{ color: theme.palette.warning.main, fontWeight: 'bold', minWidth: '100px', textAlign: 'right' }}>
                                                        {formatCurrency(item.staticExpensePrice || 0, currency)}
                                                    </Typography>
                                                    <IconButton
                                                        onClick={() => {
                                                            setEditingStaticExpense(item.id);
                                                            setEditStaticExpenseName(item.name);
                                                            setEditStaticExpenseDate(item.staticExpenseDate || '');
                                                            setEditStaticExpensePrice((item.staticExpensePrice || 0).toString());
                                                        }}
                                                        size="small"
                                                        sx={{
                                                            color: theme.palette.primary.main,
                                                        }}
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                    <IconButton
                                                        onClick={() => handleDeleteItem(item.id)}
                                                        size="small"
                                                        sx={{
                                                            color: theme.palette.error.main,
                                                        }}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </>
                                            )}
                                        </Paper>
                                    );
                                })}
                        </Box>
                    )}
                </Paper>

                <Dialog
                    open={modalOpen}
                    onClose={handleCloseModal}
                    PaperProps={{
                        sx: {
                            bgcolor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                        }
                    }}
                >
                    <DialogTitle sx={{ color: theme.palette.text.primary }}>
                        {selectedType === 'loan' ? 'Create New Loan' : selectedType === 'staticExpense' ? 'Create New Static Expense' : selectedType ? `Create New ${selectedType === 'income' ? 'Income' : 'Expense'}` : 'Create New Line Item'}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '300px', marginTop: '1rem' }}>
                            {isStaticExpense ? (
                                <>
                                    <TextField
                                        label="Name"
                                        value={staticExpenseName}
                                        onChange={(e) => setStaticExpenseName(e.target.value)}
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
                                        label="Date"
                                        type="date"
                                        value={staticExpenseDate}
                                        onChange={(e) => setStaticExpenseDate(e.target.value)}
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
                                    <TextField
                                        label="Price"
                                        type="number"
                                        value={staticExpensePrice}
                                        onChange={(e) => setStaticExpensePrice(e.target.value)}
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
                                </>
                            ) : isLoan ? (
                                <>
                                    <TextField
                                        label="Loan Title"
                                        value={loanTitle}
                                        onChange={(e) => setLoanTitle(e.target.value)}
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
                                    <TextField
                                        label="Loan Value"
                                        type="number"
                                        value={loanValue}
                                        onChange={(e) => setLoanValue(e.target.value)}
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
                                </>
                            ) : (
                                <>
                                    <TextField
                                        label="Name"
                                        value={itemName}
                                        onChange={(e) => setItemName(e.target.value)}
                                        fullWidth
                                        autoFocus
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && itemName.trim() && selectedType) {
                                                handleCreateItem();
                                            }
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
                                    {selectedType === 'expense' && loans.length > 0 && (
                                        <FormControl fullWidth>
                                            <Select
                                                value={linkedLoanId}
                                                onChange={(e) => setLinkedLoanId(e.target.value)}
                                                displayEmpty
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
                                                }}
                                            >
                                                <MenuItem value="">
                                                    <em>No loan (optional)</em>
                                                </MenuItem>
                                                {loans.map((loan) => (
                                                    <MenuItem key={loan.id} value={loan.id}>
                                                        {loan.name}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}
                                </>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={handleCloseModal}
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
                            onClick={handleCreateItem}
                            disabled={isLoan ? (!loanTitle.trim() || !loanStartDate || !loanValue) : isStaticExpense ? (!staticExpenseName.trim() || !staticExpenseDate || !staticExpensePrice) : (!selectedType || !itemName.trim())}
                            variant="contained"
                            sx={{
                                color: isLoan
                                    ? theme.palette.info.contrastText
                                    : isStaticExpense
                                        ? theme.palette.warning.contrastText
                                        : selectedType
                                            ? (selectedType === 'income' ? theme.palette.success.contrastText : theme.palette.error.contrastText)
                                            : theme.palette.text.secondary,
                                bgcolor: isLoan
                                    ? theme.palette.info.main
                                    : isStaticExpense
                                        ? theme.palette.warning.main
                                        : selectedType
                                            ? (selectedType === 'income' ? theme.palette.success.main : theme.palette.error.main)
                                            : theme.palette.background.default,
                                '&:hover': {
                                    bgcolor: isLoan
                                        ? theme.palette.info.dark
                                        : isStaticExpense
                                            ? theme.palette.warning.dark
                                            : selectedType
                                                ? (selectedType === 'income' ? theme.palette.success.dark : theme.palette.error.dark)
                                                : theme.palette.background.default,
                                },
                                '&:disabled': {
                                    bgcolor: theme.palette.background.default,
                                    color: theme.palette.text.secondary,
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

