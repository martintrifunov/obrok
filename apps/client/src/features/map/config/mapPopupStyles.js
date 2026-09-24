// MapLibre renders popups and attribution outside React, so they're themed via global selectors.
export const getMapPopupStyles = (theme) => ({
  "& .maplibregl-popup-content": {
    backgroundColor: "background.paper",
    color: "text.primary",
    borderRadius: 3,
    boxShadow: theme.shadows[6],
    padding: 0,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
  },
  "& .maplibregl-popup-tip": {
    borderTopColor: theme.palette.divider,
    borderBottomColor: theme.palette.divider,
  },
  "& .maplibregl-popup-close-button": {
    color: `${theme.palette.text.secondary} !important`,
    fontSize: "20px",
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    top: "8px",
    right: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent !important",
    border: "none",
    outline: "none",
    transition: "all 0.2s ease",
  },
  "& .maplibregl-popup-close-button:hover": {
    backgroundColor: `${theme.palette.action.hover} !important`,
    color: `${theme.palette.text.primary} !important`,
  },
  "& .maplibregl-ctrl-attrib": {
    backgroundColor: "rgba(255, 255, 255, 0.8) !important",
    color: "rgba(0, 0, 0, 0.8) !important",
  },
  "& .maplibregl-ctrl-attrib a": {
    color: "rgba(0, 0, 0, 0.8) !important",
  },
});
