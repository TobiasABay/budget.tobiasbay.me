import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, Paper, Button, useMediaQuery, useTheme, CircularProgress, Tooltip } from "@mui/material";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { getStoredCurrency, formatCurrency } from "../utils/currency";
import { summarizeBudgetYear } from "../utils/budgetMath";
import { extractCategoryBudgetsFromItems } from "../utils/categoryBudgets";

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export default function HomePage() {
    const navigate = useNavigate();
    const { user, isLoaded } = useUser();
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
    const [activeBudget, setActiveBudget] = useState<string | null>(null);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [overview, setOverview] = useState<ReturnType<typeof summarizeBudgetYear> | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('activeBudget');
        if (stored) setActiveBudget(stored);
    }, []);

    useEffect(() => {
        if (!isLoaded || !user?.id || !activeBudget) {
            setOverview(null);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoadingOverview(true);
            try {
                const res = await fetch(`${API_BASE_URL}/budgets/${encodeURIComponent(activeBudget)}/data`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': user.id,
                    },
                });
                if (!res.ok) throw new Error('Failed to load budget');
                const raw = await res.json();
                const { items } = extractCategoryBudgetsFromItems(raw);
                if (!cancelled) {
                    setOverview(summarizeBudgetYear(items as any, { budgetYear: activeBudget }));
                }
            } catch {
                if (!cancelled) setOverview(null);
            } finally {
                if (!cancelled) setLoadingOverview(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isLoaded, user?.id, activeBudget]);

    const currency = getStoredCurrency();
    const fmt = (n: number) => formatCurrency(n, currency) || String(n);

    return (
        <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
            <Navbar />
            <Box sx={{
                padding: isMobile ? '1rem' : '2rem',
                flex: 1,
                maxWidth: '960px',
                margin: '0 auto',
                width: '100%'
            }}>
                {activeBudget ? (
                    <Paper
                        sx={{
                            bgcolor: theme.palette.background.paper,
                            padding: isMobile ? '1.5rem' : '2rem',
                            borderRadius: '12px',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <AccountBalanceIcon sx={{ color: theme.palette.primary.main, fontSize: '1.5rem' }} />
                                <Typography sx={{ color: theme.palette.text.primary, fontWeight: 600 }} variant="h6">
                                    Budget {activeBudget}
                                </Typography>
                            </Box>
                            <Button
                                variant="contained"
                                onClick={() => navigate(`/budgets/${activeBudget}`)}
                                sx={{
                                    bgcolor: theme.palette.primary.main,
                                    color: theme.palette.primary.contrastText,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                }}
                            >
                                Open budget
                            </Button>
                        </Box>

                        {loadingOverview ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress size={28} />
                            </Box>
                        ) : overview ? (
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                                    gap: 1.5,
                                }}
                            >
                                {[
                                    { label: 'Income', value: fmt(overview.totalIncome), color: '#4caf50', tip: 'YTD income' },
                                    { label: 'Expenses', value: fmt(overview.totalNetExpense), color: '#f44336', tip: 'Living − Nordnet withdrawals' },
                                    { label: 'Cash', value: fmt(overview.totalCashSavings), color: overview.totalCashSavings >= 0 ? '#4caf50' : '#f44336', tip: 'Cash after living and Nordnet transfers' },
                                    { label: 'Nordnet', value: fmt(overview.totalNordnet), color: '#9c27b0', tip: 'Net stock transfers' },
                                    { label: 'Wealth', value: fmt(overview.wealth), color: '#4caf50', tip: 'Cash + Nordnet' },
                                    { label: 'Save rate', value: `${overview.savingsRate.toFixed(1)}%`, color: '#4caf50', tip: '(Income − living) ÷ income' },
                                ].map((kpi) => (
                                    <Tooltip key={kpi.label} title={kpi.tip} arrow>
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                borderRadius: 1,
                                                border: `1px solid ${theme.palette.secondary.main}55`,
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => navigate(`/budgets/${activeBudget}`)}
                                        >
                                            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, fontWeight: 600 }}>
                                                {kpi.label}
                                            </Typography>
                                            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: kpi.color, mt: 0.5 }}>
                                                {kpi.value}
                                            </Typography>
                                        </Box>
                                    </Tooltip>
                                ))}
                            </Box>
                        ) : (
                            <Typography sx={{ color: theme.palette.text.secondary }}>
                                Could not load overview. Open the budget to register income and expenses.
                            </Typography>
                        )}
                    </Paper>
                ) : (
                    <Paper
                        sx={{
                            bgcolor: theme.palette.background.paper,
                            padding: isMobile ? '1.5rem' : '2rem',
                            borderRadius: '12px',
                            textAlign: 'center',
                        }}
                    >
                        <AccountBalanceIcon sx={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem', color: theme.palette.text.secondary }} />
                        <Typography sx={{ color: theme.palette.text.secondary, marginBottom: '0.5rem' }}>
                            No active budget set
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, opacity: 0.7, mb: 2 }}>
                            Go to Settings to set an active budget for a one-click overview here.
                        </Typography>
                        <Button variant="outlined" onClick={() => navigate('/settings')} sx={{ textTransform: 'none' }}>
                            Open Settings
                        </Button>
                    </Paper>
                )}
            </Box>
        </Box>
    );
}
