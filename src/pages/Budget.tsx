import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, CircularProgress, Menu } from "@mui/material";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

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
}

export default function Budget() {
    const { year } = useParams<{ year: string }>();
    const { user, isLoaded } = useUser();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<'income' | 'expense' | null>(null);
    const [itemName, setItemName] = useState('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [editingCell, setEditingCell] = useState<{ itemId: string; month: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editingFrequency, setEditingFrequency] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [selectedItemForDelete, setSelectedItemForDelete] = useState<string | null>(null);

    const FREQUENCY_OPTIONS = ['Monthly', 'Quarterly', 'Six-Monthly', 'Yearly'];

    // Load budget data on mount
    useEffect(() => {
        if (isLoaded && user?.id && year) {
            loadBudgetData();
        }
    }, [isLoaded, user?.id, year]);

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
                setLineItems(items);
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
            const encodedYear = encodeURIComponent(year);
            const response = await fetch(`${API_BASE_URL}/budgets/${encodedYear}/data`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id,
                },
                body: JSON.stringify({ items: lineItems }),
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

    const handleOpenModal = (type: 'income' | 'expense') => {
        setModalOpen(true);
        setSelectedType(type);
        setItemName('');
        handleCloseMenu();
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedType(null);
        setItemName('');
    };

    const handleCreateItem = () => {
        if (!itemName.trim() || !selectedType) return;

        const newItem: LineItem = {
            id: Date.now().toString(),
            name: itemName.trim(),
            type: selectedType,
            amount: 0,
            frequency: 'Monthly',
            months: {}
        };

        const updatedItems = [...lineItems, newItem];
        setLineItems(updatedItems);
        handleCloseModal();
    };

    const handleCellClick = (itemId: string, month: string) => {
        const item = lineItems.find(i => i.id === itemId);
        const currentValue = item?.months[month] || 0;
        setEditingCell({ itemId, month });
        setEditValue(currentValue.toString());
        setSelectedItemForDelete(null);
    };

    const handleCellSave = () => {
        if (!editingCell) return;

        const numericValue = parseFloat(editValue) || 0;

        const updatedItems = lineItems.map(item => {
            if (item.id === editingCell.itemId) {
                return {
                    ...item,
                    months: {
                        ...item.months,
                        [editingCell.month]: numericValue
                    }
                };
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
                    </Menu>
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
                                        bgcolor: theme.palette.background.paper,
                                        color: theme.palette.text.primary,
                                        fontWeight: 'bold',
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                        width: '15%',
                                        padding: '12px 8px',
                                    }}
                                >
                                    Figures in dollars
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
                                            const cellValue = item.months[month] || 0;

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
                                                        cellValue === 0 ? '' : `$${cellValue.toFixed(2)}`
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
                                            {totalIncome === 0 ? '-' : `$${totalIncome.toFixed(2)}`}
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
                            {/* Expense Items */}
                            {lineItems
                                .filter(item => item.type === 'expense')
                                .map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell
                                            onClick={() => handleNameCellClick(item.id)}
                                            sx={{
                                                color: theme.palette.error.main,
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
                                            const cellValue = item.months[month] || 0;

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
                                                        cellValue === 0 ? '' : `$${cellValue.toFixed(2)}`
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
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
                                            {totalExpense === 0 ? '-' : `$${totalExpense.toFixed(2)}`}
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
                                            {savings === 0 ? '-' : `$${savings.toFixed(2)}`}
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
                                            {cumulativeSavings === 0 ? '-' : `$${cumulativeSavings.toFixed(2)}`}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        </TableBody>
                    </Table>
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
                        {selectedType ? `Create New ${selectedType === 'income' ? 'Income' : 'Expense'}` : 'Create New Line Item'}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '300px', marginTop: '1rem' }}>
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
                            disabled={!selectedType || !itemName.trim()}
                            variant="contained"
                            sx={{
                                color: selectedType
                                    ? (selectedType === 'income' ? theme.palette.success.contrastText : theme.palette.error.contrastText)
                                    : theme.palette.text.secondary,
                                bgcolor: selectedType
                                    ? (selectedType === 'income' ? theme.palette.success.main : theme.palette.error.main)
                                    : theme.palette.background.default,
                                '&:hover': {
                                    bgcolor: selectedType
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

