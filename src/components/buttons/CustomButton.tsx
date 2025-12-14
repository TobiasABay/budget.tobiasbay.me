import Button from '@mui/material/Button';
import { theme } from '../../ColorTheme';

import { type MouseEventHandler, type ReactNode } from 'react';

interface CustomButtonProps {
    onClick: MouseEventHandler<HTMLButtonElement>;
    children: ReactNode;
}

export default function CustomButton({ onClick, children }: CustomButtonProps) {

    return (
        <Button
            sx={{
                bgcolor: theme.palette.background.paper,
                display: 'flex',
                color: theme.palette.secondary.contrastText,
                boxShadow: `0 4px 8px ${theme.palette.text.primary}20, 0 8px 16px ${theme.palette.text.primary}15, 0 12px 24px ${theme.palette.text.primary}10`,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                    color: theme.palette.text.disabled,
                    bgcolor: theme.palette.text.primary,
                    opacity: 0.7,
                    boxShadow: `0 6px 12px ${theme.palette.text.primary}30, 0 12px 24px ${theme.palette.text.primary}20, 0 18px 36px ${theme.palette.text.primary}15`,
                    transform: 'translateY(-2px)',
                }
            }}
            variant="contained"
            onClick={onClick}
        >
            {children}
        </Button>
    );
}
