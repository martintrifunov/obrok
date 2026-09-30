import { Button, IconButton, Stack, styled } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import DirectionsBikeIcon from "@mui/icons-material/DirectionsBike";

const ROUTING_MODES = [
  { mode: "walking", label: "Пешки", Icon: DirectionsWalkIcon },
  { mode: "car", label: "Со автомобил", Icon: DirectionsCarIcon },
  { mode: "cycling", label: "Со велосипед", Icon: DirectionsBikeIcon },
];

const RouteControls = ({ routingMode, onRoutingModeChange, onCancel, isMobile }) => (
  <>
    <ModeSelectorContainer direction="row" spacing={1}>
      {ROUTING_MODES.map(({ mode, label, Icon }) => (
        <ModeButton
          key={mode}
          aria-label={label}
          active={routingMode === mode}
          onClick={() => onRoutingModeChange(mode)}
          disabled={routingMode === mode}
        >
          <Icon />
        </ModeButton>
      ))}
    </ModeSelectorContainer>

    {isMobile ? (
      <CancelRouteIconButton aria-label="Откажи ја рутата" onClick={onCancel}>
        <CloseIcon />
      </CancelRouteIconButton>
    ) : (
      <CancelRouteButton variant="contained" onClick={onCancel}>
        <CloseIcon sx={{ marginRight: "5px" }} /> Откажи ја рутата
      </CancelRouteButton>
    )}
  </>
);

const ModeSelectorContainer = styled(Stack)(({ theme }) => ({
  position: "absolute",
  top: "20px",
  left: "20px",
  zIndex: 1000,
  backgroundColor: theme.palette.background.paper,
  padding: "6px",
  borderRadius: "14px",
  boxShadow: theme.shadows[4],
  border: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down("sm")]: {
    top: "12px",
    left: "12px",
    padding: "4px",
  },
}));

const ModeButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "active",
})(({ theme, active }) => ({
  minWidth: "45px",
  height: "45px",
  borderRadius: "10px",
  color: active
    ? theme.palette.mode === "dark"
      ? "#000"
      : "#fff"
    : theme.palette.text.secondary,
  backgroundColor: active ? theme.palette.primary.main : "transparent",
  border: "none",
  "&:disabled": {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.mode === "dark" ? "#000" : "#fff",
    opacity: 1,
  },
  "&:hover": {
    backgroundColor: active
      ? theme.palette.primary.main
      : theme.palette.action.hover,
  },
  [theme.breakpoints.down("sm")]: {
    minWidth: "38px",
    height: "38px",
  },
}));

const CancelRouteButton = styled(Button)(({ theme }) => ({
  position: "absolute",
  top: "20px",
  right: "20px",
  zIndex: 1000,
  backgroundColor: theme.palette.error.main,
  color: "#fff",
  borderRadius: "12px",
  padding: "10px 20px",
  textTransform: "none",
  fontWeight: "bold",
  boxShadow: theme.shadows[4],
  "&:hover": {
    backgroundColor: theme.palette.error.dark,
  },
}));

const CancelRouteIconButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: "12px",
  right: "12px",
  zIndex: 1000,
  backgroundColor: "crimson",
  color: "#fff",
  width: "42px",
  height: "42px",
  boxShadow: theme.shadows[4],
  "&:hover": {
    backgroundColor: "#b71c1c",
  },
}));

export default RouteControls;
