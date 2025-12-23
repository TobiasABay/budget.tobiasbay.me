import MenuIcon from '@mui/icons-material/Menu';
import { Box, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, useMediaQuery, useTheme, Menu, MenuItem } from '@mui/material';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme as customTheme } from '../ColorTheme.tsx';
import CustomButton from '../components/buttons/CustomButton.tsx';
import SettingsIcon from '@mui/icons-material/Settings';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { UserButton, useUser } from '@clerk/clerk-react';
import PaymentsIcon from '@mui/icons-material/Payments';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';


// Use production API URL so local and production frontends use the same backend and database
// In dev mode, connect directly to production API. In production, use relative path.
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'https://budget.tobiasbay.me/api' : '/api');

async function fetchBudgets(userId: string): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/budgets`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export default function Navbar() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useUser();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [budgetMenuAnchor, setBudgetMenuAnchor] = useState<null | HTMLElement>(null);
  const [budgets, setBudgets] = useState<string[]>([]);

  const menuItems = [
    { text: 'Loans', icon: <PaymentsIcon />, path: '/loans' },
    { text: 'Salary', icon: <RequestQuoteIcon />, path: '/salary' },
    { text: 'Insurance', icon: <AssignmentIndIcon />, path: '/insurance' },

  ];

  useEffect(() => {
    if (user?.id) {
      loadBudgets();
    }
  }, [user?.id]);

  const loadBudgets = async () => {
    if (!user?.id) return;
    try {
      const budgetList = await fetchBudgets(user.id);
      setBudgets(budgetList);
    } catch (error) {
      console.error('Error loading budgets:', error);
    }
  };

  const budgetItems = budgets.map(year => ({
    text: `Budget ${year}`,
    path: `/budgets/${year}`,
  }));

  const handleBudgetMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setBudgetMenuAnchor(event.currentTarget);
  };

  const handleBudgetMenuClose = () => {
    setBudgetMenuAnchor(null);
  };

  const handleBudgetMenuItemClick = (path: string) => {
    navigate(path);
    handleBudgetMenuClose();
  };

  return (
    <Box
      sx={{
        bgcolor: customTheme.palette.background.default,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        padding: '1rem'
      }}
    >
      {/* Logo/Title */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer'
        }}
        onClick={() => navigate('/')}
      >
        <Typography sx={{ color: customTheme.palette.text.primary, fontWeight: 'bold' }} variant="h6">Tobias Bay</Typography>
        <Typography sx={{ color: customTheme.palette.secondary.contrastText }} variant="h6">Budget</Typography>
      </Box>

      {isSmallScreen ? (
        // Burger menu for small screens
        <Box>
          <IconButton onClick={() => setDrawerOpen(true)}>
            <MenuIcon sx={{ color: customTheme.palette.secondary.contrastText }} />
          </IconButton>
          <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <List sx={{ width: 350, bgcolor: "#072E33", height: "100%" }}>
              {budgets.map((year) => (
                <ListItem key={year} disablePadding>
                  <ListItemButton onClick={() => { navigate(`/budgets/${year}`); setDrawerOpen(false); }}>
                    <ListItemIcon sx={{ color: customTheme.palette.secondary.contrastText }}>
                      <RequestQuoteIcon />
                    </ListItemIcon>
                    <ListItemText sx={{ color: customTheme.palette.secondary.contrastText }} primary={`Budget ${year}`} />
                  </ListItemButton>
                </ListItem>
              ))}
              {menuItems.map((item) => (
                <ListItem key={item.text} disablePadding>
                  <ListItemButton onClick={() => { navigate(item.path); setDrawerOpen(false); }}>
                    <ListItemIcon sx={{ color: customTheme.palette.secondary.contrastText }}>{item.icon}</ListItemIcon>
                    <ListItemText sx={{ color: customTheme.palette.secondary.contrastText }} primary={item.text} />
                  </ListItemButton>
                </ListItem>
              ))}
              <ListItem disablePadding>
                <ListItemButton onClick={() => { navigate('/settings'); setDrawerOpen(false); }}>
                  <ListItemIcon sx={{ color: customTheme.palette.secondary.contrastText }}>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText sx={{ color: customTheme.palette.secondary.contrastText }} primary="Settings" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <Box sx={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <UserButton />
                </Box>
              </ListItem>
            </List>
          </Drawer>
        </Box>
      ) : (
        // Full menu for larger screens
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 2
          }}
        >
          <CustomButton onClick={handleBudgetMenuOpen}>
            Budgets  <ArrowDropDownIcon />
          </CustomButton>
          <Menu
            anchorEl={budgetMenuAnchor}
            open={Boolean(budgetMenuAnchor)}
            onClose={handleBudgetMenuClose}
            disableScrollLock={true}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            sx={{
              '& .MuiPaper-root': {
                bgcolor: customTheme.palette.background.paper,
                color: customTheme.palette.text.primary,
              },
            }}
          >
            {budgetItems.map((item) => (
              <MenuItem
                key={item.text}
                onClick={() => handleBudgetMenuItemClick(item.path)}
                sx={{
                  color: customTheme.palette.text.primary,
                  '&:hover': {
                    bgcolor: customTheme.palette.primary.main,
                    color: customTheme.palette.primary.contrastText,
                  },
                }}
              >
                {item.text}
              </MenuItem>
            ))}
          </Menu>
          {menuItems.map((item) => (
            <CustomButton key={item.text} onClick={() => navigate(item.path)}>
              {item.text} {item.icon}
            </CustomButton>
          ))}
          <CustomButton onClick={() => navigate('/settings')}>
            Settings <SettingsIcon />
          </CustomButton>
          <UserButton />
        </Box>
      )}
    </Box>
  );
}