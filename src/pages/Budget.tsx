import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, InputLabel, Menu, useMediaQuery, useTheme, Accordion, AccordionSummary, AccordionDetails, Chip } from "@mui/material";
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
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InsightsIcon from '@mui/icons-material/Insights';
import BarChartIcon from '@mui/icons-material/BarChart';
import CloseIcon from '@mui/icons-material/Close';
import { getStoredCurrency, formatCurrency } from "../utils/currency";
import type { Currency } from "../utils/currency";

// Use production API URL so local and production frontends use the same backend and database
// In dev mode, connect directly to production API. In production, use relative path.
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'https://budget.tobiasbay.me/api' : '/api');

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const EXPENSE_CATEGORIES = [
    'Housing',
    'Insurance',
    'Food',
    'Transportation',
    'Utilities',
    'Healthcare',
    'Fitness',
    'Entertainment',
    'Shopping',
    'Education',
    'Other'
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
    category?: string | null; // Expense category
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
    const isTablet = useMediaQuery(muiTheme.breakpoints.down('md'));
    const isDesktop = useMediaQuery(muiTheme.breakpoints.up('lg'));

    // Helper function to check if an item is Nordnet
    const isNordnetItem = (item: LineItem): boolean => {
        return item.type === 'expense' && item.name.toLowerCase().trim().includes('nordnet');
    };
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
    const [expenseCategory, setExpenseCategory] = useState<string>('');
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
    const [insightsModalOpen, setInsightsModalOpen] = useState(false);
    const [selectedMonthForChart, setSelectedMonthForChart] = useState<string>('all');
    const [editExpenseModalOpen, setEditExpenseModalOpen] = useState(false);
    const [editingExpenseItem, setEditingExpenseItem] = useState<LineItem | null>(null);
    const [editExpenseName, setEditExpenseName] = useState<string>('');
    const [editExpenseCategory, setEditExpenseCategory] = useState<string>('');

    const handleOpenEditExpenseModal = (item: LineItem) => {
        setEditingExpenseItem(item);
        setEditExpenseName(item.name);
        setEditExpenseCategory(item.category || '');
        setEditExpenseModalOpen(true);
    };

    const handleCloseEditExpenseModal = () => {
        setEditExpenseModalOpen(false);
        setEditingExpenseItem(null);
        setEditExpenseName('');
        setEditExpenseCategory('');
    };

    const handleSaveExpenseEdit = () => {
        if (!editingExpenseItem || !editExpenseName.trim()) return;

        const updatedItems = lineItems.map(item => {
            if (item.id === editingExpenseItem.id) {
                return {
                    ...item,
                    name: editExpenseName.trim(),
                    category: editExpenseCategory.trim() || null
                };
            }
            return item;
        });
        setLineItems(updatedItems);
        handleCloseEditExpenseModal();
    };
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
            // Explicitly include category field to ensure it's saved
            const normalizedItems = lineItems.map((item: LineItem) => {
                const normalizedItem: any = { ...item }; // Includes all fields: name, type, months, category, etc.

                // Merge formulas back into months._formulas if they exist
                if (item.formulas && Object.keys(item.formulas).length > 0) {
                    const monthsWithFormulas = { ...item.months };
                    (monthsWithFormulas as any)._formulas = item.formulas;
                    normalizedItem.months = monthsWithFormulas;
                }

                if ((item.staticExpenseDate || item.staticExpensePrice) && !item.isStaticExpense) {
                    normalizedItem.isStaticExpense = true;
                }

                // Explicitly include category field (use null instead of undefined so it's serialized)
                if (item.type === 'expense') {
                    // Normalize category: empty string becomes null, undefined becomes null
                    normalizedItem.category = (item.category && item.category.trim()) || null;
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
        setExpenseCategory('');
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
        setExpenseCategory('');
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
            }),
            ...(itemType === 'expense' && {
                category: (expenseCategory && expenseCategory.trim()) || null
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

    // Calculate insights
    const calculateInsights = (selectedMonth?: string) => {
        const monthlyData = MONTHS.map(month => {
            const totalIncome = lineItems
                .filter(item => item.type === 'income')
                .reduce((sum, item) => sum + (item.months[month] || 0), 0);
            const totalExpense = lineItems
                .filter(item => item.type === 'expense' && !isNordnetItem(item))
                .reduce((sum, item) => sum + (item.months[month] || 0), 0);
            const savings = totalIncome - totalExpense;
            const nordnetSavings = lineItems
                .filter(item => isNordnetItem(item))
                .reduce((sum, item) => sum + Math.abs(item.months[month] || 0), 0);

            return {
                month,
                income: totalIncome,
                expense: totalExpense,
                savings,
                nordnetSavings
            };
        });

        const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
        const totalExpense = monthlyData.reduce((sum, m) => sum + m.expense, 0);
        const totalSavings = totalIncome - totalExpense;
        const totalNordnetSavings = monthlyData.reduce((sum, m) => sum + m.nordnetSavings, 0);
        const averageMonthlySavings = totalSavings / MONTHS.length;
        const averageMonthlyIncome = totalIncome / MONTHS.length;
        const averageMonthlyExpense = totalExpense / MONTHS.length;

        // Find best and worst months
        const bestMonth = monthlyData.reduce((best, current) =>
            current.savings > best.savings ? current : best, monthlyData[0] || { month: '', savings: 0 });
        const worstMonth = monthlyData.reduce((worst, current) =>
            current.savings < worst.savings ? current : worst, monthlyData[0] || { month: '', savings: 0 });

        // Calculate savings rate
        const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

        // Calculate fun expenses breakdown (filter by month if provided)
        const funExpenses = lineItems.filter(item => item.type === 'expense' && item.isStaticExpense);
        const filteredFunExpenses = funExpenses.filter(item => {
            if (!selectedMonth || selectedMonth === 'all') return true; // Show all if no month selected or "all" is selected
            // Check if the expense date falls in the selected month
            if (!item.staticExpenseDate) return false;
            const expenseDate = new Date(item.staticExpenseDate);
            const expenseMonthIndex = expenseDate.getMonth();
            const selectedMonthIndex = MONTHS.indexOf(selectedMonth);
            return expenseMonthIndex === selectedMonthIndex;
        });

        // Calculate total from all filtered items
        const totalFunExpenses = filteredFunExpenses.reduce((sum, item) => sum + (item.staticExpensePrice || 0), 0);

        // Map and sort items
        let funExpensesByItem = filteredFunExpenses
            .map(item => ({
                name: item.name,
                amount: item.staticExpensePrice || 0
            }))
            .sort((a, b) => b.amount - a.amount); // Sort by amount descending (highest percentage first)

        // Limit to top 10 when "all" is selected, and add "Other" for remaining items
        if (selectedMonth === 'all' && funExpensesByItem.length > 10) {
            const top10 = funExpensesByItem.slice(0, 10);
            const remainingItems = funExpensesByItem.slice(10);
            const otherAmount = remainingItems.reduce((sum, item) => sum + item.amount, 0);

            if (otherAmount > 0) {
                funExpensesByItem = [...top10, { name: 'Other', amount: otherAmount }];
            } else {
                funExpensesByItem = top10;
            }
        }

        // Calculate expenses by category
        const expensesByCategory: { [key: string]: number } = {};
        lineItems
            .filter(item => item.type === 'expense' && !isNordnetItem(item))
            .forEach(item => {
                const category = item.category || 'Other';
                const categoryTotal = MONTHS.reduce((sum, month) => {
                    return sum + (item.months[month] || 0);
                }, 0);
                expensesByCategory[category] = (expensesByCategory[category] || 0) + categoryTotal;
            });

        const categoryBreakdown = Object.entries(expensesByCategory)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount);

        return {
            monthlyData,
            totalIncome,
            totalExpense,
            totalSavings,
            totalNordnetSavings,
            averageMonthlySavings,
            averageMonthlyIncome,
            averageMonthlyExpense,
            bestMonth,
            worstMonth,
            savingsRate,
            funExpensesByItem,
            totalFunExpenses,
            categoryBreakdown
        };
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
                        onClick={() => setInsightsModalOpen(true)}
                        disabled={!isLoaded || !user?.id || loading}
                        sx={{
                            color: theme.palette.info.main,
                            bgcolor: theme.palette.background.paper,
                            '&:hover': {
                                bgcolor: theme.palette.info.main,
                                color: theme.palette.info.contrastText || theme.palette.text.primary,
                            },
                            '&:disabled': {
                                opacity: 0.5,
                            },
                        }}
                        title="View Insights"
                    >
                        <InsightsIcon />
                    </IconButton>
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
                    maxHeight: 'calc(100vh - 200px)',
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
                        minWidth: isMobile ? '800px' : 'auto',
                        '& .MuiTableHead-root': {
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                        },
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
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: isMobile ? 11 : 10,
                                        ...(isMobile && {
                                            left: 0,
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
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 10,
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
                                                color: '#4caf50', // Bright green for income
                                                fontWeight: 700,
                                                borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                padding: isMobile ? '6px 2px' : '12px 8px',
                                                cursor: 'pointer',
                                                fontSize: isMobile ? '0.7rem' : '0.875rem',
                                                bgcolor: theme.palette.background.paper,
                                                maxWidth: isMobile ? '120px' : 'none',
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
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 1 }}>
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
                                        color: '#4caf50', // Bright green for total income
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
                                                color: '#4caf50', // Bright green for total income values
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
                                .filter(item => item.type === 'expense' && !item.isLoan && !item.isStaticExpense && !isNordnetItem(item))
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
                                                    color: item.linkedLoanId ? theme.palette.info.main : '#f44336', // Bright red for expenses
                                                    fontWeight: 700,
                                                    borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                    padding: isMobile ? '6px 2px' : '12px 8px',
                                                    cursor: 'pointer',
                                                    fontSize: isMobile ? '0.7rem' : '0.875rem',
                                                    bgcolor: theme.palette.background.paper,
                                                    maxWidth: isMobile ? '120px' : 'none',
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
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 1, minWidth: 0, width: '100%' }}>
                                                    {selectedItemForDelete === item.id && item.type === 'expense' && !item.isLoan && !item.isStaticExpense && (
                                                        <DragIndicatorIcon
                                                            sx={{
                                                                color: theme.palette.text.secondary,
                                                                fontSize: '1.2rem',
                                                                cursor: 'grab',
                                                                flexShrink: 0,
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
                                                                opacity: 0.8,
                                                                flexShrink: 0
                                                            }}
                                                        />
                                                    )}
                                                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {item.name}
                                                    </span>
                                                    {item.category && !isTablet && (
                                                        <Chip
                                                            label={item.category}
                                                            size="small"
                                                            sx={{
                                                                fontSize: '0.7rem',
                                                                height: '24px',
                                                                bgcolor: theme.palette.background.default,
                                                                color: theme.palette.text.primary,
                                                                flexShrink: 0,
                                                                maxWidth: '100%',
                                                            }}
                                                        />
                                                    )}
                                                    {selectedItemForDelete === item.id && (
                                                        <>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenEditExpenseModal(item);
                                                                }}
                                                                sx={{
                                                                    color: theme.palette.primary.main,
                                                                    padding: '4px',
                                                                    '&:hover': {
                                                                        bgcolor: theme.palette.primary.main,
                                                                        color: theme.palette.primary.contrastText,
                                                                    },
                                                                }}
                                                                title="Edit Expense"
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteItem(item.id);
                                                                }}
                                                                sx={{
                                                                    color: item.linkedLoanId ? theme.palette.info.main : '#f44336',
                                                                    padding: '4px',
                                                                    '&:hover': {
                                                                        bgcolor: item.linkedLoanId ? theme.palette.info.main : '#f44336',
                                                                        color: item.linkedLoanId ? theme.palette.info.contrastText : theme.palette.primary.contrastText,
                                                                    },
                                                                }}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </>
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
                            {/* Nordnet Items (Stock Savings) */}
                            {lineItems
                                .filter(item => isNordnetItem(item))
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
                                                    color: '#9c27b0', // Purple color for Nordnet/stock savings
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
                                                    {selectedItemForDelete === item.id && (
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
                                                    <TrendingUpIcon
                                                        sx={{
                                                            fontSize: '1rem',
                                                            color: '#9c27b0',
                                                            opacity: 0.9
                                                        }}
                                                    />
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
                                                                color: '#9c27b0',
                                                                padding: '4px',
                                                                '&:hover': {
                                                                    bgcolor: '#9c27b0',
                                                                    color: theme.palette.primary.contrastText,
                                                                },
                                                            }}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            {MONTHS.map((month) => {
                                                const cellValue = item.months[month] || 0;
                                                const isEditing = editingCell?.itemId === item.id && editingCell?.month === month;
                                                return (
                                                    <TableCell
                                                        key={month}
                                                        onClick={() => !isEditing && handleCellClick(item.id, month)}
                                                        align="center"
                                                        sx={{
                                                            color: '#9c27b0',
                                                            padding: '8px 4px',
                                                            cursor: isEditing ? 'default' : 'pointer',
                                                            bgcolor: theme.palette.background.paper,
                                                            fontSize: isMobile ? '0.75rem' : '0.875rem',
                                                            '&:hover': {
                                                                bgcolor: isEditing ? 'transparent' : theme.palette.background.default,
                                                            },
                                                        }}
                                                    >
                                                        {isEditing ? (
                                                            <TextField
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                onBlur={handleCellSave}
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleCellSave();
                                                                    } else if (e.key === 'Escape') {
                                                                        setEditingCell(null);
                                                                        setEditValue('');
                                                                    }
                                                                }}
                                                                autoFocus
                                                                size="small"
                                                                inputProps={{
                                                                    style: {
                                                                        textAlign: 'center',
                                                                        padding: '4px',
                                                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                                                    }
                                                                }}
                                                                sx={{
                                                                    width: '100%',
                                                                    '& .MuiOutlinedInput-root': {
                                                                        '& fieldset': {
                                                                            borderColor: '#9c27b0',
                                                                        },
                                                                        '&:hover fieldset': {
                                                                            borderColor: '#9c27b0',
                                                                        },
                                                                        '&.Mui-focused fieldset': {
                                                                            borderColor: '#9c27b0',
                                                                        },
                                                                    },
                                                                }}
                                                            />
                                                        ) : (
                                                            cellValue === 0 ? '-' : formatCurrency(cellValue, currency)
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
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
                            {/* Total Expense Row */}
                            <TableRow>
                                <TableCell
                                    colSpan={1}
                                    sx={{
                                        color: '#f44336', // Bright red for total expense
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
                                    // Total expenses excluding Nordnet (Nordnet is savings, not an expense)
                                    const totalExpense = lineItems
                                        .filter(item => item.type === 'expense' && !isNordnetItem(item))
                                        .reduce((sum, item) => sum + (item.months[month] || 0), 0);

                                    return (
                                        <TableCell
                                            key={month}
                                            align="center"
                                            sx={{
                                                color: '#f44336', // Bright red for total expense values
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
                                    // Calculate income (all income items)
                                    const totalIncome = lineItems
                                        .filter(item => item.type === 'income')
                                        .reduce((sum, item) => sum + (item.months[month] || 0), 0);
                                    // Calculate expenses (all expenses EXCEPT Nordnet - Nordnet is savings, not an expense)
                                    const totalExpense = lineItems
                                        .filter(item => item.type === 'expense' && !isNordnetItem(item))
                                        .reduce((sum, item) => sum + (item.months[month] || 0), 0);
                                    // Savings = Income - Expenses (Nordnet excluded)
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
                                        // Calculate income (all income items)
                                        const totalIncome = lineItems
                                            .filter(item => item.type === 'income')
                                            .reduce((sum, item) => sum + (item.months[currentMonth] || 0), 0);
                                        // Calculate expenses (all expenses EXCEPT Nordnet - Nordnet is savings, not an expense)
                                        const totalExpense = lineItems
                                            .filter(item => item.type === 'expense' && !isNordnetItem(item))
                                            .reduce((sum, item) => sum + (item.months[currentMonth] || 0), 0);
                                        // Cumulative Savings = Income - Expenses (Nordnet excluded)
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
                            {/* Nordnet Savings Row */}
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
                                    Nordnet Savings
                                </TableCell>
                                {MONTHS.map((month, monthIndex) => {
                                    let cumulativeNordnetSavings = 0;
                                    for (let i = 0; i <= monthIndex; i++) {
                                        const currentMonth = MONTHS[i];
                                        const nordnetExpense = lineItems
                                            .filter(item => isNordnetItem(item))
                                            .reduce((sum, item) => sum + Math.abs(item.months[currentMonth] || 0), 0);
                                        // Nordnet expenses are actually savings, so we treat them as positive savings
                                        cumulativeNordnetSavings += nordnetExpense;
                                    }

                                    return (
                                        <TableCell
                                            key={month}
                                            align="center"
                                            sx={{
                                                color: cumulativeNordnetSavings >= 0 ? theme.palette.success.main : theme.palette.error.main,
                                                padding: '12px 4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                bgcolor: theme.palette.background.default,
                                                opacity: 0.8,
                                            }}
                                        >
                                            {cumulativeNordnetSavings === 0 ? '-' : formatCurrency(cumulativeNordnetSavings, currency)}
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
                                                                    gap: isMobile ? 1 : 2,
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
                                                                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0, overflow: 'hidden', maxWidth: 'calc(100% - 120px)' }}>
                                                                            <Typography sx={{ color: theme.palette.text.primary, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                                                                                {item.name}
                                                                            </Typography>
                                                                            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                                                                                {item.staticExpenseDate ? new Date(item.staticExpenseDate).toLocaleDateString() : 'No date'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Typography sx={{ color: theme.palette.warning.main, fontWeight: 'bold', minWidth: isMobile ? '60px' : '80px', textAlign: 'right', flexShrink: 0 }}>
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
                    <DialogTitle sx={{ color: theme.palette.text.primary, fontSize: isMobile ? '1.1rem' : '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{selectedType === 'loan' ? 'Create New Loan' : selectedType === 'staticExpense' ? 'Create New Static Expense' : selectedType ? `Create New ${selectedType === 'income' ? 'Income' : 'Expense'}` : 'Create New Line Item'}</span>
                        <IconButton
                            onClick={handleCloseModal}
                            size="small"
                            sx={{
                                color: theme.palette.text.secondary,
                                '&:hover': {
                                    bgcolor: theme.palette.background.default,
                                },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
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
                                    {selectedType === 'expense' && (
                                        <FormControl fullWidth>
                                            <InputLabel sx={{
                                                color: theme.palette.text.secondary,
                                                '&.Mui-focused': {
                                                    color: theme.palette.primary.main,
                                                },
                                            }}>Category</InputLabel>
                                            <Select
                                                value={expenseCategory}
                                                onChange={(e) => setExpenseCategory(e.target.value)}
                                                label="Category"
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
                                                MenuProps={{
                                                    PaperProps: {
                                                        sx: {
                                                            bgcolor: theme.palette.background.paper,
                                                            color: theme.palette.text.primary,
                                                        }
                                                    }
                                                }}
                                            >
                                                {EXPENSE_CATEGORIES.map((category) => (
                                                    <MenuItem key={category} value={category}>
                                                        {category}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}
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
                            onClick={handleCreateItem}
                            disabled={isLoan ? (!loanTitle.trim() || !loanStartDate || !loanValue) : isStaticExpense ? (!staticExpenseName.trim() || !staticExpenseDate || !staticExpensePrice) : (!selectedType || !itemName.trim() || (selectedType === 'expense' && !expenseCategory))}
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

                {/* Insights Modal */}
                <Dialog
                    open={insightsModalOpen}
                    onClose={() => setInsightsModalOpen(false)}
                    fullScreen={isMobile}
                    maxWidth="lg"
                    fullWidth
                    PaperProps={{
                        sx: {
                            bgcolor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                        }
                    }}
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BarChartIcon sx={{ color: theme.palette.info.main }} />
                            <Typography variant="h6">Budget Insights - {year}</Typography>
                        </Box>
                        <IconButton
                            onClick={() => setInsightsModalOpen(false)}
                            size="small"
                            sx={{
                                color: theme.palette.text.secondary,
                                '&:hover': {
                                    bgcolor: theme.palette.background.default,
                                },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent>
                        {(() => {
                            const insights = calculateInsights(selectedMonthForChart);
                            const maxValue = Math.max(
                                ...insights.monthlyData.map(m => Math.max(m.income, m.expense, m.savings)),
                                1
                            );

                            return (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                                    {/* Summary Cards */}
                                    <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 2 }}>
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                                            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                                                Total Income
                                            </Typography>
                                            <Typography sx={{ color: '#4caf50', fontSize: '1.5rem', fontWeight: 'bold', mt: 0.5 }}>
                                                {formatCurrency(insights.totalIncome, currency)}
                                            </Typography>
                                        </Paper>
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                                            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                                                Total Expenses
                                            </Typography>
                                            <Typography sx={{ color: '#f44336', fontSize: '1.5rem', fontWeight: 'bold', mt: 0.5 }}>
                                                {formatCurrency(insights.totalExpense, currency)}
                                            </Typography>
                                        </Paper>
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                                            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                                                Total Savings
                                            </Typography>
                                            <Typography sx={{
                                                color: insights.totalSavings >= 0 ? '#4caf50' : '#f44336',
                                                fontSize: '1.5rem',
                                                fontWeight: 'bold',
                                                mt: 0.5
                                            }}>
                                                {formatCurrency(insights.totalSavings, currency)}
                                            </Typography>
                                        </Paper>
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                                            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                                                Savings Rate
                                            </Typography>
                                            <Typography sx={{
                                                color: insights.savingsRate >= 0 ? '#4caf50' : '#f44336',
                                                fontSize: '1.5rem',
                                                fontWeight: 'bold',
                                                mt: 0.5
                                            }}>
                                                {insights.savingsRate.toFixed(1)}%
                                            </Typography>
                                        </Paper>
                                    </Box>

                                    {/* Monthly Column Chart */}
                                    <Paper sx={{ p: isMobile ? 1.5 : isTablet ? 1.75 : 2, bgcolor: theme.palette.background.default }}>
                                        <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary, fontSize: isMobile ? '1rem' : isTablet ? '1.1rem' : '1.25rem' }}>
                                            Monthly Overview
                                        </Typography>
                                        <Box sx={{
                                            overflowX: 'auto',
                                            overflowY: 'visible',
                                            '&::-webkit-scrollbar': {
                                                height: '6px',
                                            },
                                            '&::-webkit-scrollbar-track': {
                                                background: theme.palette.background.default,
                                            },
                                            '&::-webkit-scrollbar-thumb': {
                                                background: theme.palette.secondary.main,
                                                borderRadius: '3px',
                                            },
                                        }}>
                                            <Box sx={{
                                                display: 'flex',
                                                alignItems: 'flex-end',
                                                gap: isMobile ? 0.5 : isDesktop ? 1 : 0.5,
                                                height: isMobile ? '220px' : isDesktop ? '300px' : '220px',
                                                px: isMobile ? 0.5 : isDesktop ? 1 : 0.5,
                                                mb: 2,
                                                minWidth: isMobile ? '600px' : isDesktop ? 'auto' : '600px'
                                            }}>
                                                {insights.monthlyData.map((data) => {
                                                    const incomeHeight = (data.income / maxValue) * 100;
                                                    const expenseHeight = (data.expense / maxValue) * 100;
                                                    const savings = data.income - data.expense;

                                                    return (
                                                        <Box key={data.month} sx={{
                                                            flex: 1,
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            height: '100%',
                                                            justifyContent: 'flex-end',
                                                            gap: isMobile ? 0.25 : isDesktop ? 0.5 : 0.25,
                                                            minWidth: isMobile ? '40px' : isDesktop ? 'auto' : '40px'
                                                        }}>
                                                            <Box sx={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                width: '100%',
                                                                height: '100%',
                                                                justifyContent: 'flex-end',
                                                                gap: isMobile ? 0.25 : isDesktop ? 0.5 : 0.25,
                                                                position: 'relative'
                                                            }}>
                                                                {/* Income Column */}
                                                                <Box sx={{
                                                                    width: '100%',
                                                                    height: `${incomeHeight}%`,
                                                                    bgcolor: '#4caf50',
                                                                    borderRadius: '4px 4px 0 0',
                                                                    minHeight: incomeHeight > 0 ? '2px' : '0',
                                                                    display: 'flex',
                                                                    alignItems: 'flex-end',
                                                                    justifyContent: 'center',
                                                                    position: 'relative',
                                                                    '&:hover': {
                                                                        opacity: 0.8,
                                                                    }
                                                                }} />
                                                                {/* Expense Column */}
                                                                <Box sx={{
                                                                    width: '100%',
                                                                    height: `${expenseHeight}%`,
                                                                    bgcolor: '#f44336',
                                                                    borderRadius: '4px 4px 0 0',
                                                                    minHeight: expenseHeight > 0 ? '2px' : '0',
                                                                    display: 'flex',
                                                                    alignItems: 'flex-end',
                                                                    justifyContent: 'center',
                                                                    position: 'relative',
                                                                    '&:hover': {
                                                                        opacity: 0.8,
                                                                    }
                                                                }} />
                                                            </Box>
                                                            {/* Month Label */}
                                                            <Typography sx={{
                                                                fontSize: isMobile ? '0.65rem' : isDesktop ? '0.7rem' : '0.65rem',
                                                                color: theme.palette.text.secondary,
                                                                textAlign: 'center',
                                                                mt: 0.5,
                                                                fontWeight: isMobile ? 500 : isDesktop ? 400 : 500
                                                            }}>
                                                                {data.month.substring(0, 3)}
                                                            </Typography>
                                                            {/* Value Labels - Always shown below columns */}
                                                            <Box sx={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                gap: isMobile ? 0.25 : 0.3,
                                                                mt: 0.5,
                                                                width: '100%'
                                                            }}>
                                                                <Typography sx={{
                                                                    fontSize: isMobile ? '0.6rem' : isDesktop ? '0.7rem' : '0.65rem',
                                                                    color: '#4caf50',
                                                                    fontWeight: 'bold',
                                                                    textAlign: 'center',
                                                                    lineHeight: 1.2
                                                                }}>
                                                                    {formatCurrency(data.income, currency).replace(/\s/g, '')}
                                                                </Typography>
                                                                <Typography sx={{
                                                                    fontSize: isMobile ? '0.6rem' : isDesktop ? '0.7rem' : '0.65rem',
                                                                    color: '#f44336',
                                                                    fontWeight: 'bold',
                                                                    textAlign: 'center',
                                                                    lineHeight: 1.2
                                                                }}>
                                                                    {formatCurrency(data.expense, currency).replace(/\s/g, '')}
                                                                </Typography>
                                                                <Typography sx={{
                                                                    fontSize: isMobile ? '0.55rem' : isDesktop ? '0.65rem' : '0.6rem',
                                                                    color: savings >= 0 ? '#4caf50' : '#f44336',
                                                                    fontWeight: 'bold',
                                                                    textAlign: 'center',
                                                                    lineHeight: 1.2,
                                                                    mt: 0.25
                                                                }}>
                                                                    {formatCurrency(savings, currency).replace(/\s/g, '')}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                        {/* Legend */}
                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 2 : isTablet ? 2.5 : 3, mt: 2, flexWrap: 'wrap' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: isMobile ? '12px' : isTablet ? '14px' : '16px', height: isMobile ? '12px' : isTablet ? '14px' : '16px', bgcolor: '#4caf50', borderRadius: '4px' }} />
                                                <Typography sx={{ fontSize: isMobile ? '0.75rem' : isTablet ? '0.8rem' : '0.875rem', color: theme.palette.text.primary }}>
                                                    Income
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: isMobile ? '12px' : isTablet ? '14px' : '16px', height: isMobile ? '12px' : isTablet ? '14px' : '16px', bgcolor: '#f44336', borderRadius: '4px' }} />
                                                <Typography sx={{ fontSize: isMobile ? '0.75rem' : isTablet ? '0.8rem' : '0.875rem', color: theme.palette.text.primary }}>
                                                    Expense
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Paper>

                                    {/* Fun Expenses Pie Chart */}
                                    {insights.totalFunExpenses > 0 && (
                                        <Paper sx={{ p: isMobile ? 1.5 : isTablet ? 1.75 : 2, bgcolor: theme.palette.background.default }}>
                                            <Box sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: (isMobile || isTablet) ? 'flex-start' : 'center',
                                                mb: 2,
                                                flexDirection: (isMobile || isTablet) ? 'column' : 'row',
                                                gap: (isMobile || isTablet) ? 1 : 0
                                            }}>
                                                <Typography variant="h6" sx={{
                                                    color: theme.palette.text.primary,
                                                    fontSize: isMobile ? '1rem' : isTablet ? '1.1rem' : '1.25rem',
                                                    mb: (isMobile || isTablet) ? 1 : 0
                                                }}>
                                                    Fun Expenses Breakdown
                                                </Typography>
                                                <FormControl size="small" sx={{ minWidth: (isMobile || isTablet) ? '100%' : 150 }}>
                                                    <Select
                                                        value={selectedMonthForChart}
                                                        onChange={(e) => setSelectedMonthForChart(e.target.value)}
                                                        sx={{
                                                            color: theme.palette.text.primary,
                                                            fontSize: isMobile ? '0.875rem' : isTablet ? '0.9rem' : '1rem',
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
                                                        MenuProps={{
                                                            PaperProps: {
                                                                sx: {
                                                                    bgcolor: theme.palette.background.paper,
                                                                    color: theme.palette.text.primary,
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <MenuItem value="all">All Months</MenuItem>
                                                        {MONTHS.map((month) => (
                                                            <MenuItem key={month} value={month}>
                                                                {month}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box sx={{ display: 'flex', flexDirection: (isMobile || isTablet) ? 'column' : 'row', gap: isMobile ? 2 : isTablet ? 2.5 : 3, alignItems: 'center' }}>
                                                {/* Pie Chart */}
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: (isMobile || isTablet) ? '100%' : 'auto' }}>
                                                    <Box sx={{
                                                        width: isMobile ? '200px' : isTablet ? '220px' : '250px',
                                                        height: isMobile ? '200px' : isTablet ? '220px' : '250px',
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center'
                                                    }}>
                                                        <svg
                                                            width={isMobile ? "200" : isTablet ? "220" : "250"}
                                                            height={isMobile ? "200" : isTablet ? "220" : "250"}
                                                            viewBox="0 0 250 250"
                                                            style={{ transform: 'rotate(-90deg)', maxWidth: '100%', height: 'auto' }}
                                                        >
                                                            {(() => {
                                                                let currentAngle = 0;
                                                                const colors = [
                                                                    '#2196F3', // Blue
                                                                    '#4CAF50', // Green
                                                                    '#FF9800', // Orange
                                                                    '#9C27B0', // Purple
                                                                    '#F44336', // Red
                                                                    '#00BCD4', // Cyan
                                                                    '#FF5722', // Deep Orange
                                                                    '#8BC34A', // Light Green
                                                                    '#E91E63', // Pink
                                                                    '#3F51B5', // Indigo
                                                                    '#FFC107', // Amber
                                                                    '#009688'  // Teal
                                                                ];
                                                                return insights.funExpensesByItem.map((item, index) => {
                                                                    const percentage = (item.amount / insights.totalFunExpenses) * 100;
                                                                    const angle = (percentage / 100) * 360;
                                                                    const startAngle = currentAngle;
                                                                    const endAngle = currentAngle + angle;
                                                                    currentAngle = endAngle;

                                                                    const startAngleRad = (startAngle * Math.PI) / 180;
                                                                    const endAngleRad = (endAngle * Math.PI) / 180;
                                                                    const largeArcFlag = angle > 180 ? 1 : 0;

                                                                    const x1 = 125 + 100 * Math.cos(startAngleRad);
                                                                    const y1 = 125 + 100 * Math.sin(startAngleRad);
                                                                    const x2 = 125 + 100 * Math.cos(endAngleRad);
                                                                    const y2 = 125 + 100 * Math.sin(endAngleRad);

                                                                    const pathData = [
                                                                        `M 125 125`,
                                                                        `L ${x1} ${y1}`,
                                                                        `A 100 100 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                                                                        `Z`
                                                                    ].join(' ');

                                                                    return (
                                                                        <path
                                                                            key={index}
                                                                            d={pathData}
                                                                            fill={colors[index % colors.length]}
                                                                            stroke={theme.palette.background.paper}
                                                                            strokeWidth={isMobile ? "1.5" : isTablet ? "1.75" : "2"}
                                                                        />
                                                                    );
                                                                });
                                                            })()}
                                                        </svg>
                                                    </Box>
                                                    <Box sx={{ textAlign: 'center' }}>
                                                        <Typography sx={{ fontSize: isMobile ? '0.75rem' : isTablet ? '0.8rem' : '0.875rem', color: theme.palette.text.secondary }}>
                                                            Total
                                                        </Typography>
                                                        <Typography sx={{ fontSize: isMobile ? '1rem' : isTablet ? '1.1rem' : '1.25rem', fontWeight: 'bold', color: theme.palette.warning.main }}>
                                                            {formatCurrency(insights.totalFunExpenses, currency)}
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                {/* Legend */}
                                                <Box sx={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: isMobile ? 0.75 : isTablet ? 0.85 : 1,
                                                    width: (isMobile || isTablet) ? '100%' : 'auto',
                                                    maxHeight: (isMobile || isTablet) ? '300px' : 'none',
                                                    overflowY: (isMobile || isTablet) ? 'auto' : 'visible',
                                                    '&::-webkit-scrollbar': {
                                                        width: '6px',
                                                    },
                                                    '&::-webkit-scrollbar-track': {
                                                        background: theme.palette.background.default,
                                                    },
                                                    '&::-webkit-scrollbar-thumb': {
                                                        background: theme.palette.secondary.main,
                                                        borderRadius: '3px',
                                                    },
                                                }}>
                                                    {insights.funExpensesByItem.map((item, index) => {
                                                        const percentage = (item.amount / insights.totalFunExpenses) * 100;
                                                        const colors = [
                                                            '#2196F3', // Blue
                                                            '#4CAF50', // Green
                                                            '#FF9800', // Orange
                                                            '#9C27B0', // Purple
                                                            '#F44336', // Red
                                                            '#00BCD4', // Cyan
                                                            '#FF5722', // Deep Orange
                                                            '#8BC34A', // Light Green
                                                            '#E91E63', // Pink
                                                            '#3F51B5', // Indigo
                                                            '#FFC107', // Amber
                                                            '#009688'  // Teal
                                                        ];
                                                        return (
                                                            <Box key={index} sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: isMobile ? 0.75 : isTablet ? 0.85 : 1,
                                                                minHeight: (isMobile || isTablet) ? '32px' : 'auto'
                                                            }}>
                                                                <Box sx={{
                                                                    width: isMobile ? '12px' : isTablet ? '14px' : '16px',
                                                                    height: isMobile ? '12px' : isTablet ? '14px' : '16px',
                                                                    borderRadius: '4px',
                                                                    bgcolor: colors[index % colors.length],
                                                                    flexShrink: 0
                                                                }} />
                                                                <Box sx={{
                                                                    flex: 1,
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    gap: isMobile ? 0.5 : isTablet ? 0.75 : 1,
                                                                    minWidth: 0
                                                                }}>
                                                                    <Typography sx={{
                                                                        fontSize: isMobile ? '0.75rem' : isTablet ? '0.8rem' : '0.875rem',
                                                                        color: theme.palette.text.primary,
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap',
                                                                        flex: 1,
                                                                        minWidth: 0
                                                                    }}>
                                                                        {item.name}
                                                                    </Typography>
                                                                    <Box sx={{
                                                                        display: 'flex',
                                                                        gap: isMobile ? 0.5 : isTablet ? 0.75 : 1,
                                                                        alignItems: 'center',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        <Typography sx={{
                                                                            fontSize: isMobile ? '0.7rem' : isTablet ? '0.75rem' : '0.875rem',
                                                                            color: theme.palette.text.secondary,
                                                                            whiteSpace: 'nowrap'
                                                                        }}>
                                                                            {percentage.toFixed(1)}%
                                                                        </Typography>
                                                                        <Typography sx={{
                                                                            fontSize: isMobile ? '0.7rem' : isTablet ? '0.75rem' : '0.875rem',
                                                                            fontWeight: 'bold',
                                                                            color: theme.palette.warning.main,
                                                                            whiteSpace: 'nowrap'
                                                                        }}>
                                                                            {formatCurrency(item.amount, currency)}
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            </Box>
                                                        );
                                                    })}
                                                </Box>
                                            </Box>
                                        </Paper>
                                    )}

                                    {/* Category Breakdown */}
                                    {insights.categoryBreakdown.length > 0 && (
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                                            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary }}>
                                                Expenses by Category
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                                {insights.categoryBreakdown.map((item, index) => {
                                                    const percentage = (item.amount / insights.totalExpense) * 100;
                                                    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50'];
                                                    return (
                                                        <Box key={item.category}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                                <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.primary, fontWeight: 500 }}>
                                                                    {item.category}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                                                    <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
                                                                        {percentage.toFixed(1)}%
                                                                    </Typography>
                                                                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#f44336', minWidth: '80px', textAlign: 'right' }}>
                                                                        {formatCurrency(item.amount, currency)}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                            <Box sx={{
                                                                width: '100%',
                                                                height: '8px',
                                                                bgcolor: theme.palette.background.paper,
                                                                borderRadius: '4px',
                                                                overflow: 'hidden'
                                                            }}>
                                                                <Box sx={{
                                                                    width: `${percentage}%`,
                                                                    height: '100%',
                                                                    bgcolor: colors[index % colors.length],
                                                                    borderRadius: '4px',
                                                                    transition: 'width 0.3s ease'
                                                                }} />
                                                            </Box>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        </Paper>
                                    )}

                                    {/* Statistics */}
                                    <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 2 }}>
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                                            <Typography variant="h6" sx={{ mb: 1, color: theme.palette.text.primary }}>
                                                Averages
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
                                                        Monthly Income
                                                    </Typography>
                                                    <Typography sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                                                        {formatCurrency(insights.averageMonthlyIncome, currency)}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
                                                        Monthly Expense
                                                    </Typography>
                                                    <Typography sx={{ color: '#f44336', fontWeight: 'bold' }}>
                                                        {formatCurrency(insights.averageMonthlyExpense, currency)}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
                                                        Monthly Savings
                                                    </Typography>
                                                    <Typography sx={{
                                                        color: insights.averageMonthlySavings >= 0 ? '#4caf50' : '#f44336',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {formatCurrency(insights.averageMonthlySavings, currency)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Paper>
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                                            <Typography variant="h6" sx={{ mb: 1, color: theme.palette.text.primary }}>
                                                Highlights
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
                                                        Best Month
                                                    </Typography>
                                                    <Typography sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                                                        {insights.bestMonth.month}: {formatCurrency(insights.bestMonth.savings, currency)}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
                                                        Worst Month
                                                    </Typography>
                                                    <Typography sx={{ color: '#f44336', fontWeight: 'bold' }}>
                                                        {insights.worstMonth.month}: {formatCurrency(insights.worstMonth.savings, currency)}
                                                    </Typography>
                                                </Box>
                                                {insights.totalNordnetSavings > 0 && (
                                                    <Box>
                                                        <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
                                                            Nordnet Savings
                                                        </Typography>
                                                        <Typography sx={{ color: '#9c27b0', fontWeight: 'bold' }}>
                                                            {formatCurrency(insights.totalNordnetSavings, currency)}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Box>
                                        </Paper>
                                    </Box>
                                </Box>
                            );
                        })()}
                    </DialogContent>
                </Dialog>

                {/* Edit Expense Modal */}
                <Dialog
                    open={editExpenseModalOpen}
                    onClose={handleCloseEditExpenseModal}
                    fullScreen={isMobile}
                    maxWidth="sm"
                    fullWidth
                    PaperProps={{
                        sx: {
                            bgcolor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                        }
                    }}
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EditIcon sx={{ color: theme.palette.primary.main }} />
                            <Typography variant="h6">Edit Expense</Typography>
                        </Box>
                        <IconButton
                            onClick={handleCloseEditExpenseModal}
                            size="small"
                            sx={{
                                color: theme.palette.text.secondary,
                                '&:hover': {
                                    bgcolor: theme.palette.background.default,
                                },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                            <TextField
                                label="Name"
                                value={editExpenseName}
                                onChange={(e) => setEditExpenseName(e.target.value)}
                                fullWidth
                                autoFocus
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && editExpenseName.trim()) {
                                        handleSaveExpenseEdit();
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
                            <FormControl fullWidth>
                                <InputLabel sx={{
                                    color: theme.palette.text.secondary,
                                    '&.Mui-focused': {
                                        color: theme.palette.primary.main,
                                    },
                                }}>Category</InputLabel>
                                <Select
                                    value={editExpenseCategory}
                                    onChange={(e) => setEditExpenseCategory(e.target.value)}
                                    label="Category"
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
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                bgcolor: theme.palette.background.paper,
                                                color: theme.palette.text.primary,
                                            }
                                        }
                                    }}
                                >
                                    {EXPENSE_CATEGORIES.map((category) => (
                                        <MenuItem key={category} value={category}>
                                            {category}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={handleSaveExpenseEdit}
                            disabled={!editExpenseName.trim()}
                            variant="contained"
                            sx={{
                                bgcolor: '#f44336',
                                color: theme.palette.primary.contrastText,
                                '&:hover': {
                                    bgcolor: '#d32f2f',
                                },
                                '&:disabled': {
                                    bgcolor: theme.palette.background.default,
                                    color: theme.palette.text.secondary,
                                },
                            }}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
}

