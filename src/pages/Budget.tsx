import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, Menu, useMediaQuery, useTheme, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import EditIcon from '@mui/icons-material/Edit';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [selectedItemForDelete, setSelectedItemForDelete] = useState<string | null>(null);
    const [currency, setCurrency] = useState<Currency>(getStoredCurrency());
    const [editingStaticExpense, setEditingStaticExpense] = useState<string | null>(null);
    const [editStaticExpenseName, setEditStaticExpenseName] = useState('');
    const [editStaticExpenseDate, setEditStaticExpenseDate] = useState('');
    const [editStaticExpensePrice, setEditStaticExpensePrice] = useState('');
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);


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

        // Insert the new item in the correct position based on its type
        let updatedItems: LineItem[];
        if (itemType === 'income') {
            // Insert income items at the end of all income items
            const incomeItems = lineItems.filter(item => item.type === 'income');
            const expenseItems = lineItems.filter(item => item.type === 'expense');
            updatedItems = [...incomeItems, newItem, ...expenseItems];
        } else {
            // For expenses, insert based on the expense type
            const incomeItems = lineItems.filter(item => item.type === 'income');
            const regularExpenses = lineItems.filter(item =>
                item.type === 'expense' && !item.isLoan && !item.isStaticExpense && !item.linkedLoanId
            );
            const loanLinkedExpenses = lineItems.filter(item =>
                item.type === 'expense' && !item.isLoan && !item.isStaticExpense && item.linkedLoanId
            );
            const staticExpenses = lineItems.filter(item =>
                item.type === 'expense' && item.isStaticExpense
            );
            const loanItems = lineItems.filter(item =>
                item.type === 'expense' && item.isLoan
            );

            // Insert new expense in the appropriate section
            if (isStaticExpense) {
                // Static expenses go before loans
                updatedItems = [...incomeItems, ...regularExpenses, ...loanLinkedExpenses, ...staticExpenses, newItem, ...loanItems];
            } else if (isLoan) {
                // Loan items go at the end of expenses
                updatedItems = [...incomeItems, ...regularExpenses, ...loanLinkedExpenses, ...staticExpenses, ...loanItems, newItem];
            } else if (linkedLoanId) {
                // Loan-linked expenses go after regular expenses
                updatedItems = [...incomeItems, ...regularExpenses, ...loanLinkedExpenses, newItem, ...staticExpenses, ...loanItems];
            } else {
                // Regular expenses go first in the expense section
                updatedItems = [...incomeItems, ...regularExpenses, newItem, ...loanLinkedExpenses, ...staticExpenses, ...loanItems];
            }
        }

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


    const handleDeleteItem = (itemId: string) => {
        const updatedItems = lineItems.filter(item => item.id !== itemId);
        setLineItems(updatedItems);
        setSelectedItemForDelete(null);
    };

    const handleNameCellClick = (itemId: string) => {
        setSelectedItemForDelete(selectedItemForDelete === itemId ? null : itemId);
    };

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        setDraggedItemId(itemId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', itemId);
    };

    const handleDragOver = (e: React.DragEvent, itemId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedItemId && draggedItemId !== itemId) {
            setDragOverItemId(itemId);
        }
    };

    const handleDragLeave = () => {
        setDragOverItemId(null);
    };

    const handleDrop = (e: React.DragEvent, targetItemId: string, itemType: 'income' | 'expense') => {
        e.preventDefault();
        if (!draggedItemId || draggedItemId === targetItemId) {
            setDraggedItemId(null);
            setDragOverItemId(null);
            return;
        }

        const draggedItem = lineItems.find(item => item.id === draggedItemId);
        if (!draggedItem || draggedItem.type !== itemType) {
            setDraggedItemId(null);
            setDragOverItemId(null);
            return;
        }

        // Find the actual indices in the full lineItems array
        const draggedIndex = lineItems.findIndex(item => item.id === draggedItemId);
        const targetIndex = lineItems.findIndex(item => item.id === targetItemId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedItemId(null);
            setDragOverItemId(null);
            return;
        }

        // Only allow reordering within the same type
        if (lineItems[draggedIndex].type !== lineItems[targetIndex].type) {
            setDraggedItemId(null);
            setDragOverItemId(null);
            return;
        }

        // Reorder items in the array
        const updatedItems = [...lineItems];
        const [removed] = updatedItems.splice(draggedIndex, 1);
        updatedItems.splice(targetIndex, 0, removed);

        setLineItems(updatedItems);
        setDraggedItemId(null);
        setDragOverItemId(null);
    };

    const handleDragEnd = () => {
        setDraggedItemId(null);
        setDragOverItemId(null);
    };

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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: isMobile ? '1rem' : '2rem', flexWrap: 'wrap' }}>
                    <Typography sx={{ color: theme.palette.text.primary }} variant={isMobile ? "h5" : "h4"}>
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
                        minWidth: isMobile ? '800px' : 'auto'
                    }}>
                        <TableHead>
                            <TableRow>
                                <TableCell
                                    sx={{
                                        bgcolor: theme.palette.background.paper,
                                        color: theme.palette.text.primary,
                                        fontWeight: 'bold',
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        width: isMobile ? '120px' : '15%',
                                        minWidth: isMobile ? '120px' : 'auto',
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        ...(isMobile && {
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 3,
                                        }),
                                    }}
                                >
                                    Amount
                                </TableCell>
                                {MONTHS.map((month) => (
                                    <TableCell
                                        key={month}
                                        align="center"
                                        sx={{
                                            bgcolor: theme.palette.background.paper,
                                            color: theme.palette.text.primary,
                                            fontWeight: 'bold',
                                            width: isMobile ? '60px' : `${85 / 12}%`,
                                            minWidth: isMobile ? '60px' : 'auto',
                                            padding: isMobile ? '8px 2px' : '12px 4px',
                                            fontSize: isMobile ? '0.7rem' : '0.8rem',
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
                                    <TableRow
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.id)}
                                        onDragOver={(e) => handleDragOver(e, item.id)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, item.id, 'income')}
                                        onDragEnd={handleDragEnd}
                                        sx={{
                                            opacity: draggedItemId === item.id ? 0.5 : 1,
                                            bgcolor: dragOverItemId === item.id ? theme.palette.background.default : 'transparent',
                                            cursor: 'move',
                                            '&:hover': {
                                                bgcolor: dragOverItemId === item.id ? theme.palette.background.default : theme.palette.background.default + '80',
                                            },
                                        }}
                                    >
                                        <TableCell
                                            onClick={() => handleNameCellClick(item.id)}
                                            sx={{
                                                color: theme.palette.success.main,
                                                borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                padding: isMobile ? '8px 4px' : '12px 8px',
                                                cursor: 'pointer',
                                                fontSize: isMobile ? '0.75rem' : '0.875rem',
                                                bgcolor: theme.palette.background.paper,
                                                ...(isMobile && {
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 2,
                                                }),
                                                '&:hover': {
                                                    bgcolor: 'transparent',
                                                },
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {selectedItemForDelete === item.id && item.type === 'income' && (
                                                    <DragIndicatorIcon
                                                        sx={{
                                                            color: theme.palette.text.secondary,
                                                            fontSize: '1.2rem',
                                                            cursor: 'grab',
                                                            '&:active': {
                                                                cursor: 'grabbing',
                                                            },
                                                        }}
                                                    />
                                                )}
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
                                                        padding: isMobile ? '4px 2px' : '4px',
                                                        fontSize: isMobile ? '0.7rem' : '0.875rem',
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
                                    colSpan={1}
                                    sx={{
                                        color: theme.palette.success.main,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontWeight: 'bold',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        bgcolor: theme.palette.background.default,
                                        ...(isMobile && {
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 2,
                                        }),
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
                                    colSpan={13}
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
                                        <TableRow
                                            key={item.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, item.id)}
                                            onDragOver={(e) => handleDragOver(e, item.id)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, item.id, 'expense')}
                                            onDragEnd={handleDragEnd}
                                            sx={{
                                                opacity: draggedItemId === item.id ? 0.5 : 1,
                                                bgcolor: dragOverItemId === item.id ? theme.palette.background.default : 'transparent',
                                                cursor: 'move',
                                                '&:hover': {
                                                    bgcolor: dragOverItemId === item.id ? theme.palette.background.default : theme.palette.background.default + '80',
                                                },
                                            }}
                                        >
                                            <TableCell
                                                onClick={() => handleNameCellClick(item.id)}
                                                sx={{
                                                    color: item.linkedLoanId ? theme.palette.info.main : theme.palette.error.main,
                                                    borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                    padding: isMobile ? '8px 4px' : '12px 8px',
                                                    cursor: 'pointer',
                                                    fontSize: isMobile ? '0.75rem' : '0.875rem',
                                                    bgcolor: theme.palette.background.paper,
                                                    ...(isMobile && {
                                                        position: 'sticky',
                                                        left: 0,
                                                        zIndex: 2,
                                                    }),
                                                    '&:hover': {
                                                        bgcolor: 'transparent',
                                                    },
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {selectedItemForDelete === item.id && item.type === 'expense' && !item.isLoan && !item.isStaticExpense && (
                                                        <DragIndicatorIcon
                                                            sx={{
                                                                color: theme.palette.text.secondary,
                                                                fontSize: '1.2rem',
                                                                cursor: 'grab',
                                                                '&:active': {
                                                                    cursor: 'grabbing',
                                                                },
                                                            }}
                                                        />
                                                    )}
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
                            {/* Fun Expenses Summary Row */}
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
                                                ...(isMobile && {
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 2,
                                                }),
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
                            {/* Loan Items */}
                            {lineItems
                                .filter(item => item.type === 'expense' && item.isLoan)
                                .sort((a, b) => {
                                    // Sort by loan title/name alphabetically
                                    const nameA = a.loanTitle || a.name;
                                    const nameB = b.loanTitle || b.name;
                                    return nameA.localeCompare(nameB);
                                })
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
                                                    bgcolor: theme.palette.background.paper,
                                                    ...(isMobile && {
                                                        position: 'sticky',
                                                        left: 0,
                                                        zIndex: 2,
                                                    }),
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
                                    colSpan={1}
                                    sx={{
                                        color: theme.palette.error.main,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontWeight: 'bold',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        bgcolor: theme.palette.background.default,
                                        ...(isMobile && {
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 2,
                                        }),
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
                                    colSpan={13}
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
                                    colSpan={1}
                                    sx={{
                                        color: theme.palette.info.main,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontWeight: 'bold',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        bgcolor: theme.palette.background.default,
                                        ...(isMobile && {
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 2,
                                        }),
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
                                    colSpan={1}
                                    sx={{
                                        color: theme.palette.info.main,
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        padding: isMobile ? '8px 4px' : '12px 8px',
                                        fontWeight: 'bold',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        bgcolor: theme.palette.background.default,
                                        ...(isMobile && {
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 2,
                                        }),
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
                <Paper sx={{ bgcolor: theme.palette.background.paper, padding: isMobile ? '1rem' : '2rem', marginTop: isMobile ? '1rem' : '2rem' }}>
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
                    ) : (() => {
                        // Group expenses by month
                        const expensesByMonth: { [key: string]: LineItem[] } = {};
                        const staticExpenses = lineItems.filter(item => item.type === 'expense' && item.isStaticExpense);

                        staticExpenses.forEach(item => {
                            if (item.staticExpenseDate) {
                                try {
                                    const date = new Date(item.staticExpenseDate);
                                    if (!isNaN(date.getTime())) {
                                        const monthIndex = date.getMonth();
                                        const monthName = MONTHS[monthIndex];
                                        if (!expensesByMonth[monthName]) {
                                            expensesByMonth[monthName] = [];
                                        }
                                        expensesByMonth[monthName].push(item);
                                    } else {
                                        // Invalid date, add to uncategorized
                                        if (!expensesByMonth['Uncategorized']) {
                                            expensesByMonth['Uncategorized'] = [];
                                        }
                                        expensesByMonth['Uncategorized'].push(item);
                                    }
                                } catch (e) {
                                    // Invalid date format, add to uncategorized
                                    if (!expensesByMonth['Uncategorized']) {
                                        expensesByMonth['Uncategorized'] = [];
                                    }
                                    expensesByMonth['Uncategorized'].push(item);
                                }
                            } else {
                                // No date, add to uncategorized
                                if (!expensesByMonth['Uncategorized']) {
                                    expensesByMonth['Uncategorized'] = [];
                                }
                                expensesByMonth['Uncategorized'].push(item);
                            }
                        });

                        // Sort months and expenses within each month
                        const sortedMonths = Object.keys(expensesByMonth).sort((a, b) => {
                            // Put "Uncategorized" at the end
                            if (a === 'Uncategorized') return 1;
                            if (b === 'Uncategorized') return -1;
                            const indexA = MONTHS.indexOf(a);
                            const indexB = MONTHS.indexOf(b);
                            // If both are valid months, sort by index
                            if (indexA !== -1 && indexB !== -1) {
                                return indexA - indexB;
                            }
                            // Otherwise maintain order
                            return 0;
                        });

                        sortedMonths.forEach(month => {
                            expensesByMonth[month].sort((a, b) => {
                                // For uncategorized, sort by name
                                if (month === 'Uncategorized') {
                                    return (a.name || '').localeCompare(b.name || '');
                                }
                                // For months with dates, sort by date
                                const dateA = a.staticExpenseDate || '';
                                const dateB = b.staticExpenseDate || '';
                                return dateA.localeCompare(dateB);
                            });
                        });

                        return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {sortedMonths.map((month, monthIndex) => {
                                    const monthExpenses = expensesByMonth[month];
                                    const monthTotal = monthExpenses.reduce((sum, item) => sum + (item.staticExpensePrice || 0), 0);

                                    return (
                                        <Accordion
                                            key={month}
                                            defaultExpanded={monthIndex === 0}
                                            sx={{
                                                bgcolor: theme.palette.background.default,
                                                '&:before': {
                                                    display: 'none',
                                                },
                                            }}
                                        >
                                            <AccordionSummary
                                                expandIcon={<ExpandMoreIcon sx={{ color: theme.palette.text.primary }} />}
                                                sx={{
                                                    '& .MuiAccordionSummary-content': {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: 2,
                                                    },
                                                }}
                                            >
                                                <Typography sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                                                    {month}
                                                </Typography>
                                                <Typography sx={{ color: theme.palette.warning.main, fontWeight: 'bold' }}>
                                                    {formatCurrency(monthTotal, currency)}
                                                </Typography>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ padding: '1rem', paddingTop: '0.5rem' }}>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    {monthExpenses.map((item) => {
                                                        const isEditing = editingStaticExpense === item.id;
                                                        return (
                                                            <Paper
                                                                key={item.id}
                                                                sx={{
                                                                    bgcolor: theme.palette.background.paper,
                                                                    padding: '1rem',
                                                                    paddingRight: '0.5rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 2,
                                                                    overflow: 'visible',
                                                                    minWidth: 0,
                                                                    '&:hover': {
                                                                        bgcolor: theme.palette.background.default,
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

                                                                                const price = parseFloat(editStaticExpensePrice) || 0;
                                                                                let monthName = '';

                                                                                // Validate and parse date
                                                                                try {
                                                                                    const date = new Date(editStaticExpenseDate);
                                                                                    if (!isNaN(date.getTime())) {
                                                                                        const monthIndex = date.getMonth();
                                                                                        monthName = MONTHS[monthIndex];
                                                                                    }
                                                                                } catch (e) {
                                                                                    // Invalid date, will be handled as uncategorized
                                                                                }

                                                                                const updatedItems = lineItems.map(li => {
                                                                                    if (li.id === item.id) {
                                                                                        const newMonths: { [key: string]: number } = {};
                                                                                        if (monthName) {
                                                                                            newMonths[monthName] = price;
                                                                                        }
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
                                                                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0, overflow: 'hidden' }}>
                                                                            <Typography sx={{ color: theme.palette.text.primary, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                {item.name}
                                                                            </Typography>
                                                                            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                                                                                {item.staticExpenseDate ? new Date(item.staticExpenseDate).toLocaleDateString() : 'No date'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Typography sx={{ color: theme.palette.warning.main, fontWeight: 'bold', minWidth: '100px', textAlign: 'right', flexShrink: 0 }}>
                                                                            {formatCurrency(item.staticExpensePrice || 0, currency)}
                                                                        </Typography>
                                                                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
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
                                                                        </Box>
                                                                    </>
                                                                )}
                                                            </Paper>
                                                        );
                                                    })}
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                })}
                            </Box>
                        );
                    })()}
                </Paper>

                <Dialog
                    open={modalOpen}
                    onClose={handleCloseModal}
                    fullScreen={isMobile}
                    maxWidth="sm"
                    fullWidth
                    PaperProps={{
                        sx: {
                            bgcolor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                            margin: isMobile ? 0 : 'auto',
                            width: isMobile ? '100%' : 'auto',
                            maxHeight: isMobile ? '100%' : '90vh',
                        }
                    }}
                >
                    <DialogTitle sx={{ color: theme.palette.text.primary, fontSize: isMobile ? '1.1rem' : '1.25rem' }}>
                        {selectedType === 'loan' ? 'Create New Loan' : selectedType === 'staticExpense' ? 'Create New Static Expense' : selectedType ? `Create New ${selectedType === 'income' ? 'Income' : 'Expense'}` : 'Create New Line Item'}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: isMobile ? 'auto' : '300px', marginTop: isMobile ? '0.5rem' : '1rem' }}>
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

