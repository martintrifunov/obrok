import { IconButton, useTheme } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

const AISearchButton = ({ active, onClick }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <IconButton
      aria-label="AI Пребарување"
      onClick={onClick}
      sx={{
        position: "absolute",
        bottom: "100px",
        left: "20px",
        zIndex: 1000,
        width: 56,
        height: 56,
        backgroundColor: active
          ? theme.palette.primary.main
          : isDark
            ? "#1e293b"
            : "#ffffff",
        color: active
          ? isDark
            ? "#000"
            : "#fff"
          : isDark
            ? "#f8fafc"
            : theme.palette.text.primary,
        border: `1px solid ${active ? "transparent" : isDark ? "#334155" : theme.palette.divider}`,
        boxShadow: theme.shadows[6],
        "&:hover": {
          backgroundColor: active
            ? theme.palette.primary.dark
            : isDark
              ? "#334155"
              : theme.palette.grey[100],
          transform: "scale(1.05)",
        },
        transition: "all 0.2s ease",
        [theme.breakpoints.down("sm")]: {
          bottom: "84px",
          left: "12px",
          width: 48,
          height: 48,
        },
      }}
    >
      <AutoAwesomeIcon />
    </IconButton>
  );
};

export default AISearchButton;
