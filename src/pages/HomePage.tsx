import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, Paper, Button, useMediaQuery, useTheme } from "@mui/material";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

export default function HomePage() {
    const navigate = useNavigate();
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
    const [activeBudget, setActiveBudget] = useState<string | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('activeBudget');
        if (stored) {
            setActiveBudget(stored);
        }
    }, []);

    return (
        <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
            <Navbar />
            <Box sx={{
                padding: isMobile ? '1rem' : '2rem',
                flex: 1,
                maxWidth: '900px',
                margin: '0 auto',
                width: '100%'
            }}>
                {activeBudget ? (
                    <Paper
                        sx={{
                            bgcolor: theme.palette.background.paper,
                            padding: isMobile ? '1.5rem' : '2rem',
                            borderRadius: '12px',
                            boxShadow: `0 2px 8px ${theme.palette.text.primary}10`,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                boxShadow: `0 4px 16px ${theme.palette.text.primary}15`,
                            },
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: '1.5rem' }}>
                            <AccountBalanceIcon sx={{ color: theme.palette.primary.main, fontSize: '1.5rem' }} />
                            <Typography sx={{ color: theme.palette.text.primary, fontWeight: 600 }} variant="h6">
                                Active Budget
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography sx={{ color: theme.palette.text.primary, fontSize: '1.25rem', fontWeight: 500 }}>
                                Budget {activeBudget}
                            </Typography>
                            <Button
                                variant="contained"
                                onClick={() => navigate(`/budgets/${activeBudget}`)}
                                sx={{
                                    bgcolor: theme.palette.primary.main,
                                    color: theme.palette.primary.contrastText,
                                    borderRadius: '8px',
                                    padding: '10px 24px',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    width: isMobile ? '100%' : 'auto',
                                    alignSelf: isMobile ? 'stretch' : 'flex-start',
                                    '&:hover': {
                                        bgcolor: theme.palette.primary.dark,
                                        transform: 'translateY(-2px)',
                                        boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
                                    },
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                View Budget
                            </Button>
                        </Box>
                    </Paper>
                ) : (
                    <Paper
                        sx={{
                            bgcolor: theme.palette.background.paper,
                            padding: isMobile ? '1.5rem' : '2rem',
                            borderRadius: '12px',
                            boxShadow: `0 2px 8px ${theme.palette.text.primary}10`,
                            textAlign: 'center',
                        }}
                    >
                        <AccountBalanceIcon sx={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem', color: theme.palette.text.secondary }} />
                        <Typography sx={{ color: theme.palette.text.secondary, marginBottom: '0.5rem' }}>
                            No active budget set
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, opacity: 0.7 }}>
                            Go to Settings to set an active budget
                        </Typography>
                    </Paper>
                )}
            </Box>
        </Box>
    );
}