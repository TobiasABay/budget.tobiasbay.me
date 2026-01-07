import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, useMediaQuery, useTheme, Button, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, TextField, Paper, Table, TableBody, TableCell, TableHead, TableRow, IconButton } from "@mui/material";
import React, { useState, useEffect } from "react";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

interface StockEntry {
    id: string;
    name: string;
    year: string;
    months: { [key: string]: number };
}

const MONTHS = ['jan', 'feb', 'marts', 'april', 'maj', 'juni', 'juli', 'aug', 'sept', 'okt', 'nov'];

export default function Stocks() {
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

    const [newYearModalOpen, setNewYearModalOpen] = useState(false);
    const [newStockModalOpen, setNewStockModalOpen] = useState(false);
    const [deleteYearModalOpen, setDeleteYearModalOpen] = useState(false);
    const [yearToDelete, setYearToDelete] = useState<string | null>(null);
    const [yearName, setYearName] = useState('');
    const [stockName, setStockName] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [years, setYears] = useState<string[]>([]);
    const [stocks, setStocks] = useState<StockEntry[]>([]);
    const [editingCell, setEditingCell] = useState<{ stockId: string; month: string } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Load stocks data from localStorage on mount
    useEffect(() => {
        const storedYears = localStorage.getItem('stocks_years');
        const storedStocks = localStorage.getItem('stocks_data');
        if (storedYears) {
            setYears(JSON.parse(storedYears));
        }
        if (storedStocks) {
            setStocks(JSON.parse(storedStocks));
        }
    }, []);

    // Save years to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('stocks_years', JSON.stringify(years));
    }, [years]);

    // Save stocks to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('stocks_data', JSON.stringify(stocks));
    }, [stocks]);

    const handleAddYear = () => {
        if (!yearName.trim()) return;

        // Check if year already exists
        if (years.includes(yearName.trim())) {
            alert('Year already exists');
            return;
        }

        setYears([...years, yearName.trim()].sort((a, b) => a.localeCompare(b)));
        setYearName('');
        setNewYearModalOpen(false);
    };

    const handleAddStock = () => {
        if (!stockName.trim() || !selectedYear) return;

        // Check if stock already exists for this year
        if (stocks.some(s => s.name === stockName.trim() && s.year === selectedYear)) {
            alert('Stock already exists for this year');
            return;
        }

        const newStock: StockEntry = {
            id: Date.now().toString(),
            name: stockName.trim(),
            year: selectedYear,
            months: {},
        };

        // Initialize all months to 0
        MONTHS.forEach(month => {
            newStock.months[month] = 0;
        });

        setStocks([...stocks, newStock]);

        setStockName('');
        setSelectedYear('');
        setNewStockModalOpen(false);
    };

    const getStocksForYear = (year: string) => {
        return stocks.filter(s => s.year === year);
    };

    const getMonthTotal = (year: string, month: string) => {
        const yearStocks = getStocksForYear(year);
        return yearStocks.reduce((sum, stock) => {
            return sum + (stock.months[month] || 0);
        }, 0);
    };

    const handleCellClick = (stockId: string, month: string) => {
        const stock = stocks.find(s => s.id === stockId);
        if (!stock) return;

        const value = stock.months[month] || 0;
        setEditingCell({ stockId, month });
        setEditValue(value.toString());
    };

    const handleCellSave = () => {
        if (!editingCell) return;

        const trimmedValue = editValue.trim();
        const numericValue = parseFloat(trimmedValue) || 0;

        const updatedStocks = stocks.map(stock => {
            if (stock.id === editingCell.stockId) {
                return {
                    ...stock,
                    months: {
                        ...stock.months,
                        [editingCell.month]: numericValue,
                    },
                };
            }
            return stock;
        });

        setStocks(updatedStocks);
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

    const handleDeleteYearClick = (year: string) => {
        setYearToDelete(year);
        setDeleteYearModalOpen(true);
    };

    const handleDeleteYearCancel = () => {
        setDeleteYearModalOpen(false);
        setYearToDelete(null);
    };

    const handleDeleteYearConfirm = () => {
        if (!yearToDelete) return;

        // Remove year from years array
        setYears(years.filter(y => y !== yearToDelete));

        // Remove all stocks for that year
        setStocks(stocks.filter(s => s.year !== yearToDelete));

        // If the year being deleted was selected, clear selection
        if (selectedYear === yearToDelete) {
            setSelectedYear('');
        }

        setDeleteYearModalOpen(false);
        setYearToDelete(null);
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
                        Stocks
                    </Typography>
                    <Button
                        onClick={() => setNewStockModalOpen(true)}
                        variant="contained"
                        startIcon={<AddIcon />}
                        sx={{
                            bgcolor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            '&:hover': {
                                bgcolor: theme.palette.primary.dark,
                            },
                        }}
                    >
                        Enter a new stock
                    </Button>
                    <Button
                        onClick={() => setNewYearModalOpen(true)}
                        variant="contained"
                        startIcon={<AddIcon />}
                        sx={{
                            bgcolor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            '&:hover': {
                                bgcolor: theme.palette.primary.dark,
                            },
                        }}
                    >
                        Add a new year
                    </Button>
                </Box>

                {/* Display table with years and months */}
                {years.length > 0 && (
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
                                    <TableCell sx={{
                                        color: theme.palette.text.primary,
                                        fontWeight: 'bold',
                                        position: 'sticky',
                                        left: 0,
                                        bgcolor: theme.palette.background.paper,
                                        zIndex: 3,
                                        width: isMobile ? '150px' : '15%',
                                        minWidth: isMobile ? '150px' : 'auto',
                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                    }}>
                                        Year / Company
                                    </TableCell>
                                    {MONTHS.map(month => (
                                        <TableCell
                                            key={month}
                                            align="right"
                                            sx={{
                                                color: theme.palette.text.primary,
                                                fontWeight: 'bold',
                                                width: isMobile ? '80px' : `${85 / 11}%`,
                                                minWidth: isMobile ? '80px' : 'auto',
                                                padding: isMobile ? '8px 4px' : '12px 8px',
                                            }}
                                        >
                                            {isMobile ? month.substring(0, 3) : month}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {years.map((year) => {
                                    const yearStocks = getStocksForYear(year);

                                    return (
                                        <React.Fragment key={year}>
                                            <TableRow>
                                                <TableCell colSpan={MONTHS.length + 1} sx={{
                                                    color: theme.palette.text.primary,
                                                    fontWeight: 'bold',
                                                    bgcolor: theme.palette.background.default,
                                                    position: 'sticky',
                                                    top: 0,
                                                    zIndex: 2,
                                                }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span>{year}</span>
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteYearClick(year);
                                                            }}
                                                            sx={{
                                                                color: theme.palette.error.main,
                                                                '&:hover': {
                                                                    bgcolor: theme.palette.error.main,
                                                                    color: theme.palette.error.contrastText,
                                                                },
                                                            }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                            {yearStocks.map(stock => (
                                                <TableRow key={stock.id}>
                                                    <TableCell sx={{
                                                        color: theme.palette.text.primary,
                                                        position: 'sticky',
                                                        left: 0,
                                                        bgcolor: theme.palette.background.paper,
                                                        zIndex: 1,
                                                        width: isMobile ? '150px' : '15%',
                                                        minWidth: isMobile ? '150px' : 'auto',
                                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                    }}>
                                                        {stock.name}
                                                    </TableCell>
                                                    {MONTHS.map(month => {
                                                        const isEditing = editingCell?.stockId === stock.id && editingCell?.month === month;
                                                        const value = stock.months[month] || 0;

                                                        return (
                                                            <TableCell
                                                                key={month}
                                                                align="right"
                                                                onClick={() => handleCellClick(stock.id, month)}
                                                                sx={{
                                                                    color: theme.palette.text.primary,
                                                                    cursor: 'pointer',
                                                                    width: isMobile ? '80px' : `${85 / 11}%`,
                                                                    minWidth: isMobile ? '80px' : 'auto',
                                                                    padding: isMobile ? '8px 4px' : '12px 8px',
                                                                    '&:hover': {
                                                                        bgcolor: theme.palette.action.hover,
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
                                                                    />
                                                                ) : (
                                                                    value === 0 ? '' : value.toFixed(2)
                                                                )}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}
                                            {yearStocks.length > 0 && (
                                                <TableRow>
                                                    <TableCell sx={{
                                                        color: theme.palette.text.primary,
                                                        fontWeight: 'bold',
                                                        position: 'sticky',
                                                        left: 0,
                                                        bgcolor: theme.palette.background.default,
                                                        borderTop: `2px solid ${theme.palette.secondary.main}`,
                                                        zIndex: 1,
                                                        width: isMobile ? '150px' : '15%',
                                                        minWidth: isMobile ? '150px' : 'auto',
                                                        borderRight: `1px solid ${theme.palette.secondary.main}`,
                                                    }}>
                                                        Total
                                                    </TableCell>
                                                    {MONTHS.map(month => {
                                                        const total = getMonthTotal(year, month);
                                                        return (
                                                            <TableCell
                                                                key={month}
                                                                align="right"
                                                                sx={{
                                                                    color: theme.palette.text.primary,
                                                                    fontWeight: 'bold',
                                                                    bgcolor: theme.palette.background.default,
                                                                    borderTop: `2px solid ${theme.palette.secondary.main}`,
                                                                    width: isMobile ? '80px' : `${85 / 11}%`,
                                                                    minWidth: isMobile ? '80px' : 'auto',
                                                                    padding: isMobile ? '8px 4px' : '12px 8px',
                                                                }}
                                                            >
                                                                {total === 0 ? '' : total.toFixed(2)}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Paper>
                )}

                {/* Add New Year Modal */}
                <Dialog
                    open={newYearModalOpen}
                    onClose={() => {
                        setNewYearModalOpen(false);
                        setYearName('');
                    }}
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
                        Add a New Year
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: isMobile ? '0.5rem' : '1rem' }}>
                            <TextField
                                label="Year"
                                value={yearName}
                                onChange={(e) => setYearName(e.target.value)}
                                fullWidth
                                autoFocus
                                placeholder="e.g., 2024"
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
                                setNewYearModalOpen(false);
                                setYearName('');
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
                            onClick={handleAddYear}
                            disabled={!yearName.trim()}
                            variant="contained"
                            sx={{
                                bgcolor: theme.palette.primary.main,
                                color: theme.palette.primary.contrastText,
                                '&:hover': {
                                    bgcolor: theme.palette.primary.dark,
                                },
                            }}
                        >
                            Add
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Add New Stock Modal */}
                <Dialog
                    open={newStockModalOpen}
                    onClose={() => {
                        setNewStockModalOpen(false);
                        setStockName('');
                        setSelectedYear('');
                    }}
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
                        Enter a New Stock
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: isMobile ? '0.5rem' : '1rem' }}>
                            <TextField
                                label="Stock Name"
                                value={stockName}
                                onChange={(e) => setStockName(e.target.value)}
                                fullWidth
                                autoFocus
                                placeholder="e.g., Apple, Microsoft"
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
                            {years.length > 0 ? (
                                <TextField
                                    select
                                    label="Year"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    fullWidth
                                    SelectProps={{
                                        native: true,
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
                                >
                                    <option value="">Select a year</option>
                                    {years.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </TextField>
                            ) : (
                                <Typography sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
                                    Please add a year first before adding stocks.
                                </Typography>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => {
                                setNewStockModalOpen(false);
                                setStockName('');
                                setSelectedYear('');
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
                            onClick={handleAddStock}
                            disabled={!stockName.trim() || !selectedYear || years.length === 0}
                            variant="contained"
                            sx={{
                                bgcolor: theme.palette.primary.main,
                                color: theme.palette.primary.contrastText,
                                '&:hover': {
                                    bgcolor: theme.palette.primary.dark,
                                },
                            }}
                        >
                            Add
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete Year Confirmation Dialog */}
                <Dialog
                    open={deleteYearModalOpen}
                    onClose={handleDeleteYearCancel}
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
                    <DialogTitle sx={{ color: theme.palette.text.primary, fontSize: isMobile ? '1.1rem' : '1.25rem', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <DeleteIcon sx={{ color: theme.palette.error.main }} />
                        Delete Year
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText sx={{ color: theme.palette.text.secondary }}>
                            Are you sure you want to delete the year "{yearToDelete}"? This will permanently delete all stocks and data for this year. This action cannot be undone.
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={handleDeleteYearCancel}
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
                            onClick={handleDeleteYearConfirm}
                            variant="contained"
                            sx={{
                                bgcolor: theme.palette.error.main,
                                color: theme.palette.error.contrastText,
                                '&:hover': {
                                    bgcolor: theme.palette.error.dark,
                                },
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

