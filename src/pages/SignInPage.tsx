import { SignIn } from '@clerk/clerk-react';
import { Box, Container } from '@mui/material';
import { theme } from '../ColorTheme';

export default function SignInPage() {
  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.default,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Container maxWidth="sm">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SignIn
            appearance={{
              elements: {
                rootBox: {
                  width: '100%',
                },
                card: {
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                },
                headerTitle: {
                  color: theme.palette.text.primary,
                },
                headerSubtitle: {
                  color: theme.palette.text.secondary,
                },
                socialButtonsBlockButton: {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                },
                formButtonPrimary: {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                },
                formFieldInput: {
                  backgroundColor: theme.palette.background.default,
                  color: theme.palette.text.primary,
                },
                formFieldLabel: {
                  color: theme.palette.text.primary,
                },
                dividerLine: {
                  backgroundColor: theme.palette.secondary.main,
                },
                dividerText: {
                  color: theme.palette.text.secondary,
                },
                footerActionLink: {
                  color: theme.palette.primary.light,
                  '&:hover': {
                    color: theme.palette.primary.main,
                  },
                },
              },
            }}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
          />
        </Box>
      </Container>
    </Box>
  );
}



