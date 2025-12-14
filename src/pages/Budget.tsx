import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box, Typography } from "@mui/material";
import { useParams } from "react-router-dom";

export default function Budget() {
    const { year } = useParams<{ year: string }>();

    return (
        <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
            <Navbar />
            <Box sx={{ padding: '2rem', flex: 1 }}>
                <Typography sx={{ color: theme.palette.text.primary }} variant="h4">
                    Budget {year}
                </Typography>
            </Box>
        </Box>
    );
}

