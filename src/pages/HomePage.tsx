import { theme } from "../ColorTheme";
import Navbar from "../components/Navbar";
import { Box } from "@mui/material";

export default function HomePage() {

    return (
        <Box sx={{ bgcolor: theme.palette.background.default }} minHeight="100vh" display="flex" flexDirection="column">
            <Navbar />
        </Box>

    );
}