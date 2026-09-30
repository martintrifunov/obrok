import { useState } from "react";
import { Box, Collapse, IconButton, styled, useTheme } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import TuneIcon from "@mui/icons-material/Tune";
import { useNavigate } from "react-router-dom";
import useAuth from "@/features/auth/hooks/useAuth";
import useLogout from "@/features/auth/hooks/useLogout";
import { useThemeStore } from "@/store/themeStore";
import ChainFilterPopover from "@/features/map/components/ChainFilterPopover";

const MapSettingsMenu = ({ visibleChains, onToggleChain }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const mode = useThemeStore((state) => state.mode);
  const toggleColorMode = useThemeStore((state) => state.toggleColorMode);
  const logout = useLogout();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const isLoggedIn = !!auth?.accessToken;

  const [expanded, setExpanded] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState(null);

  const handleLogoutClick = async () => {
    await logout();
    navigate("/login");
  };

  const actionSx = {
    backgroundColor: isDark ? "#0f172a" : theme.palette.action.hover,
  };

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: "30px",
        left: "20px",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        [theme.breakpoints.down("sm")]: {
          bottom: "20px",
          left: "12px",
          gap: 1,
        },
      }}
    >
      <MenuToggleButton
        aria-label="Поставки"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded(!expanded);
          setFilterAnchor(null);
        }}
        $expanded={expanded}
        $isDark={isDark}
      >
        <SettingsIcon
          sx={{
            fontSize: 28,
            transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </MenuToggleButton>

      <Collapse in={expanded} orientation="horizontal" timeout={350}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            padding: "10px 16px",
            borderRadius: "30px",
            boxShadow: theme.shadows[6],
            border: `1px solid ${isDark ? "#334155" : theme.palette.divider}`,
          }}
        >
          {isLoggedIn && (
            <IconButton
              aria-label="Контролна табла"
              onClick={() => navigate("/dashboard")}
              color="primary"
              sx={actionSx}
            >
              <HomeIcon />
            </IconButton>
          )}
          <IconButton
            aria-label="Промени тема"
            onClick={toggleColorMode}
            sx={{ ...actionSx, color: theme.palette.text.primary }}
          >
            {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <IconButton
            aria-label="Филтрирај маркети"
            onClick={(e) => setFilterAnchor(filterAnchor ? null : e.currentTarget)}
            sx={{
              color: theme.palette.text.primary,
              backgroundColor: filterAnchor
                ? theme.palette.action.selected
                : actionSx.backgroundColor,
            }}
          >
            <TuneIcon />
          </IconButton>
          {isLoggedIn ? (
            <IconButton
              aria-label="Одјава"
              onClick={handleLogoutClick}
              color="error"
              sx={actionSx}
            >
              <LogoutIcon />
            </IconButton>
          ) : (
            <IconButton
              aria-label="Најава"
              onClick={() => navigate("/login")}
              color="primary"
              sx={actionSx}
            >
              <LoginIcon />
            </IconButton>
          )}
        </Box>
      </Collapse>

      <ChainFilterPopover
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        visibleChains={visibleChains}
        onToggleChain={onToggleChain}
      />
    </Box>
  );
};

const MenuToggleButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "$expanded" && prop !== "$isDark",
})(({ theme, $expanded, $isDark }) => ({
  backgroundColor: $expanded
    ? theme.palette.primary.main
    : $isDark
      ? "#1e293b"
      : "#ffffff",
  color: $expanded
    ? $isDark
      ? "#000"
      : "#fff"
    : $isDark
      ? "#f8fafc"
      : theme.palette.text.primary,
  borderRadius: "50%",
  width: "60px",
  height: "60px",
  boxShadow: theme.shadows[6],
  border: `1px solid ${$expanded ? "transparent" : $isDark ? "#334155" : theme.palette.divider}`,
  transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
  [theme.breakpoints.down("sm")]: {
    width: "48px",
    height: "48px",
  },
  "&:hover": {
    backgroundColor: $expanded
      ? theme.palette.primary.dark
      : $isDark
        ? "#334155"
        : theme.palette.grey[100],
    transform: "scale(1.05)",
  },
}));

export default MapSettingsMenu;
