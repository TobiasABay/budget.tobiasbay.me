import MenuIcon from '@mui/icons-material/Menu';
import { Box, Container, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme as customTheme } from '../ColorTheme.tsx';
import CustomButton from '../components/buttons/CustomButton.tsx';
import AppsIcon from '@mui/icons-material/Apps';
import PersonIcon from '@mui/icons-material/Person';

export default function Navbar() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));

  const [drawerOpen, setDrawerOpen] = useState(false);

  const menuItems = [
    { text: 'Budgets', icon: <AppsIcon />, path: '/budgets' },
    { text: 'Loans', icon: <PersonIcon />, path: '/loans' },
  ];

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
      <Container
        sx={{
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer'
        }}
        onClick={() => navigate('/')}
      >
        <Typography sx={{ color: customTheme.palette.text.primary, fontWeight: 'bold' }} variant="h6">Tobias Bay</Typography>
        <Typography sx={{ color: customTheme.palette.secondary.contrastText }} variant="h6">Budget</Typography>
      </Container>

      {isSmallScreen ? (
        // Burger menu for small screens
        <Box>
          <IconButton onClick={() => setDrawerOpen(true)}>
            <MenuIcon sx={{ color: customTheme.palette.secondary.contrastText }} />
          </IconButton>
          <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <List sx={{ width: 350, bgcolor: "#072E33", height: "100%" }}>
              {menuItems.map((item) => (
                <ListItem key={item.text} disablePadding>
                  <ListItemButton onClick={() => { navigate(item.path); setDrawerOpen(false); }}>
                    <ListItemIcon sx={{ color: customTheme.palette.secondary.contrastText }}>{item.icon}</ListItemIcon>
                    <ListItemText sx={{ color: customTheme.palette.secondary.contrastText }} primary={item.text} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Drawer>
        </Box>
      ) : (
        // Full menu for larger screens
        <Container
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 2
          }}
        >
          {menuItems.map((item) => (
            <CustomButton key={item.text} onClick={() => navigate(item.path)}>
              {item.text} {item.icon}
            </CustomButton>
          ))}
        </Container>
      )}
    </Box>
  );
}