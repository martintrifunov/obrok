import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Typography,
  Container,
  IconButton,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import useLogout from "@/features/auth/hooks/useLogout";
import MapIcon from "@mui/icons-material/Map";
import LogoutIcon from "@mui/icons-material/Logout";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useThemeStore } from "@/store/themeStore";

const DashboardHeader = () => {
  const navigate = useNavigate();
  const logout = useLogout();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const mode = useThemeStore((state) => state.mode);
  const toggleColorMode = useThemeStore((state) => state.toggleColorMode);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        color: "text.primary",
      }}
    >
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          sx={{
            justifyContent: "space-between",
            minHeight: { xs: 56, md: 64 },
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography
              variant={isMobile ? "subtitle1" : "h6"}
              component="div"
              sx={{
                fontWeight: "bold",
                cursor: "pointer",
                letterSpacing: "-0.5px",
              }}
              onClick={() => navigate("/dashboard")}
            >
              Obrok
            </Typography>

            <IconButton onClick={toggleColorMode} color="inherit" size="small">
              {mode === "dark" ? (
                <LightModeIcon fontSize="small" />
              ) : (
                <DarkModeIcon fontSize="small" />
              )}
            </IconButton>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: { xs: 0.75, md: 2 },
              alignItems: "center",
            }}
          >
            <Tooltip title="Map">
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate("/")}
                startIcon={!isMobile ? <MapIcon /> : null}
                sx={{ minWidth: { xs: 40, md: "auto" }, px: { xs: 1.25, md: 2 } }}
              >
                {isMobile ? <MapIcon fontSize="small" /> : "Map"}
              </Button>
            </Tooltip>
            <Tooltip title="Logout">
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleLogout}
                startIcon={!isMobile ? <LogoutIcon /> : null}
                sx={{ minWidth: { xs: 40, md: "auto" }, px: { xs: 1.25, md: 2 } }}
              >
                {isMobile ? <LogoutIcon fontSize="small" /> : "Logout"}
              </Button>
            </Tooltip>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default DashboardHeader;
