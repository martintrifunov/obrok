import { Box, Popover, Typography, useTheme } from "@mui/material";
import { getChainColor } from "@/features/map/config/markerColors";
import { KNOWN_CHAIN_NAMES } from "@/features/map/config/defaultVisibleChains";

const ChainFilterPopover = ({ anchorEl, onClose, visibleChains, onToggleChain }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "left" }}
      transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            p: 1.5,
            minWidth: 160,
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            border: `1px solid ${isDark ? "#334155" : theme.palette.divider}`,
            boxShadow: theme.shadows[8],
            mb: 1,
          },
        },
      }}
    >
      {KNOWN_CHAIN_NAMES.map((name) => {
        const color = getChainColor(name);
        const active = visibleChains.has(name);
        return (
          <Box
            key={name}
            role="checkbox"
            aria-checked={active}
            onClick={() => onToggleChain(name)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 1.5,
              py: 0.8,
              borderRadius: 2,
              cursor: "pointer",
              transition: "background-color 0.15s",
              "&:hover": {
                backgroundColor: isDark ? "#334155" : theme.palette.action.hover,
              },
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: active ? color : "transparent",
                border: `2px solid ${color}`,
                flexShrink: 0,
                transition: "background-color 0.15s",
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: active
                  ? theme.palette.text.primary
                  : theme.palette.text.disabled,
                userSelect: "none",
              }}
            >
              {name}
            </Typography>
          </Box>
        );
      })}
    </Popover>
  );
};

export default ChainFilterPopover;
