import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    typography: {
        allVariants: {
            color: '#6DA5C0', // Using a lighter color for typography
        },
    },
    palette: {
        primary: {
            light: '#10AFB0',  // Brighter accent color
            main: '#0C7978',   // Main primary color
            dark: '#05181A',   // Darker shade for contrast
            contrastText: '#6DA5C0', // Light color for text on primary
        },
        secondary: {
            light: '#6DA5C0',  // Lighter secondary accent
            main: '#537080',   // Darker main color for secondary
            dark: '#072E33',   // Darkest shade
            contrastText: '#FFFFFF', // White text for contrast
        },
        background: {
            default: '#05181A', // Dark background color
            paper: '#072E33',   // Slightly lighter for paper elements
        },
        error: {
            main: '#eb2352', // Keeping the original error color
        },
        info: {
            main: '#10AFB0', // Using an accent from the palette for info
        },
        success: {
            main: '#0C7978', // Using a darker greenish shade for success
        },
        text: {
            primary: '#6DA5C0', // Using a lighter text color for better readability
            secondary: '#ffffff', // White text for contrast
            disabled: '#000000', // Black text for contrast on light backgrounds
        },
    },
});
