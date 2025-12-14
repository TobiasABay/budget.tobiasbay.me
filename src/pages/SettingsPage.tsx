import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography, TextField, Button, Paper, List, ListItem, ListItemText, IconButton, CircularProgress } from "@mui/material";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import DeleteIcon from '@mui/icons-material/Delete';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchBudgets(userId: string): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/budgets`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch budgets');
  }

  return response.json();
}

async function createBudget(userId: string, year: string): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/budgets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify({ year }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create budget');
  }

  const data = await response.json();
  return data.budgets;
}

async function deleteBudget(userId: string, year: string): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/budgets/${year}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete budget');
  }

  const data = await response.json();
  return data.budgets;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [budgetYear, setBudgetYear] = useState<string>('');
  const [budgets, setBudgets] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (user?.id) {
      loadBudgets();
    }
  }, [user?.id]);

  const loadBudgets = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError('');
    try {
      const budgetList = await fetchBudgets(user.id);
      setBudgets(budgetList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
      console.error('Error loading budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async () => {
    if (!user?.id || !budgetYear) return;
    
    if (budgets.includes(budgetYear)) {
      setError('Budget already exists');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const updatedBudgets = await createBudget(user.id, budgetYear);
      setBudgets(updatedBudgets);
      setBudgetYear('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget');
      console.error('Error creating budget:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBudget = async (year: string) => {
    if (!user?.id) return;

    setError('');
    try {
      const updatedBudgets = await deleteBudget(user.id, year);
      setBudgets(updatedBudgets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete budget');
      console.error('Error deleting budget:', err);
    }
  };

  const handleNavigateToBudget = (year: string) => {
    navigate(`/budgets/${year}`);
  };

  return (
    <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
      <Navbar />
      <Box sx={{ padding: '2rem', flex: 1, maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <Typography sx={{ color: theme.palette.text.primary, marginBottom: '2rem' }} variant="h4">
          Settings
        </Typography>

        {error && (
          <Paper
            sx={{
              bgcolor: theme.palette.error.main,
              color: theme.palette.error.contrastText,
              padding: '1rem',
              marginBottom: '2rem',
            }}
          >
            <Typography>{error}</Typography>
          </Paper>
        )}

        <Paper
          sx={{
            bgcolor: theme.palette.background.paper,
            padding: '2rem',
            marginBottom: '2rem',
          }}
        >
          <Typography sx={{ color: theme.palette.text.primary, marginBottom: '1rem' }} variant="h6">
            Create New Budget
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label="Budget Year"
              variant="outlined"
              value={budgetYear}
              onChange={(e) => setBudgetYear(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !creating) {
                  handleCreateBudget();
                }
              }}
              disabled={creating}
              sx={{
                flex: 1,
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
            <Button
              variant="contained"
              onClick={handleCreateBudget}
              disabled={creating || !budgetYear}
              sx={{
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                '&:hover': {
                  bgcolor: theme.palette.primary.dark,
                },
                '&:disabled': {
                  bgcolor: theme.palette.background.default,
                  color: theme.palette.text.secondary,
                },
              }}
            >
              {creating ? <CircularProgress size={24} /> : 'Create'}
            </Button>
          </Box>
        </Paper>

        <Paper
          sx={{
            bgcolor: theme.palette.background.paper,
            padding: '2rem',
          }}
        >
          <Typography sx={{ color: theme.palette.text.primary, marginBottom: '1rem' }} variant="h6">
            Existing Budgets
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <CircularProgress sx={{ color: theme.palette.primary.main }} />
            </Box>
          ) : (
            <List>
              {budgets.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary="No budgets created yet"
                    sx={{ color: theme.palette.text.secondary }}
                  />
                </ListItem>
              ) : (
                budgets.map((year) => (
                <ListItem
                  key={year}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteBudget(year)}
                      sx={{
                        color: theme.palette.error.main,
                        '&:hover': {
                          bgcolor: theme.palette.error.main,
                          color: theme.palette.error.contrastText,
                        },
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: theme.palette.background.default,
                    },
                  }}
                  onClick={() => handleNavigateToBudget(year)}
                >
                  <ListItemText
                    primary={`Budget ${year}`}
                    sx={{ color: theme.palette.text.primary }}
                  />
                </ListItem>
                ))
              )}
            </List>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

