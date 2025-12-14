import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl } from "@mui/material";
import { useParams } from "react-router-dom";
import { useState } from "react";
import AddIcon from '@mui/icons-material/Add';

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
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<'income' | 'expense' | null>(null);
    const [itemName, setItemName] = useState('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [editingCell, setEditingCell] = useState<{ itemId: string; month: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editingFrequency, setEditingFrequency] = useState<string | null>(null);

    const FREQUENCY_OPTIONS = ['Monthly', 'Quarterly', 'Six-Monthly', 'Yearly'];

    const handleOpenModal = () => {
        setModalOpen(true);
        setSelectedType(null);
        setItemName('');
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedType(null);
        setItemName('');
    };

    const handleSelectIncome = () => {
        setSelectedType('income');
    };

    const handleSelectExpense = () => {
        setSelectedType('expense');
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

        setLineItems([...lineItems, newItem]);
        handleCloseModal();
    };

    const handleCellClick = (itemId: string, month: string) => {
        const item = lineItems.find(i => i.id === itemId);
        const currentValue = item?.months[month] || 0;
        setEditingCell({ itemId, month });
        setEditValue(currentValue.toString());
    };

    const handleCellSave = () => {
        if (!editingCell) return;

        const numericValue = parseFloat(editValue) || 0;

        setLineItems(lineItems.map(item => {
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
        }));

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
    };

    const handleFrequencyChange = (itemId: string, frequency: string) => {
        setLineItems(lineItems.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    frequency: frequency
                };
            }
            return item;
        }));
        setEditingFrequency(null);
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
                        onClick={handleOpenModal}
                        sx={{
                            color: theme.palette.primary.main,
                            bgcolor: theme.palette.background.paper,
                            '&:hover': {
                                bgcolor: theme.palette.primary.main,
                                color: theme.palette.primary.contrastText,
                            },
                        }}
                    >
                        <AddIcon />
                    </IconButton>
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
                            {lineItems.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell
                                        sx={{
                                            color: item.type === 'income' ? theme.palette.success.main : theme.palette.error.main,
                                            borderRight: `1px solid ${theme.palette.secondary.main}`,
                                            padding: '12px 8px',
                                        }}
                                    >
                                        {item.name}
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
                            {lineItems.some(item => item.type === 'income') && (
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
                            )}
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
                        {!selectedType ? (
                            <>
                                <Typography sx={{ color: theme.palette.text.secondary, marginBottom: '1rem' }}>
                                    Choose the type of line item you want to create:
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '300px' }}>
                                    <Button
                                        variant="contained"
                                        onClick={handleSelectIncome}
                                        sx={{
                                            bgcolor: theme.palette.success.main,
                                            color: theme.palette.success.contrastText,
                                            '&:hover': {
                                                bgcolor: theme.palette.success.dark,
                                            },
                                            padding: '12px 24px',
                                        }}
                                    >
                                        Income
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleSelectExpense}
                                        sx={{
                                            bgcolor: theme.palette.error.main,
                                            color: theme.palette.error.contrastText,
                                            '&:hover': {
                                                bgcolor: theme.palette.error.dark,
                                            },
                                            padding: '12px 24px',
                                        }}
                                    >
                                        Expense
                                    </Button>
                                </Box>
                            </>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '300px', marginTop: '1rem' }}>
                                <TextField
                                    label="Name"
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value)}
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
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        {selectedType && (
                            <Button
                                onClick={() => setSelectedType(null)}
                                sx={{
                                    color: theme.palette.text.secondary,
                                    '&:hover': {
                                        bgcolor: theme.palette.background.default,
                                    },
                                }}
                            >
                                Back
                            </Button>
                        )}
                        <Button
                            onClick={selectedType ? handleCreateItem : handleCloseModal}
                            disabled={selectedType !== null && !itemName.trim()}
                            variant={selectedType ? 'contained' : 'text'}
                            sx={{
                                color: selectedType
                                    ? (selectedType === 'income' ? theme.palette.success.contrastText : theme.palette.error.contrastText)
                                    : theme.palette.text.secondary,
                                bgcolor: selectedType
                                    ? (selectedType === 'income' ? theme.palette.success.main : theme.palette.error.main)
                                    : 'transparent',
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
                            {selectedType ? 'Create' : 'Cancel'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
}

