import { useState, useRef, useCallback, useEffect } from "react";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Box,
  Button,
  styled,
  Stack,
  useTheme,
  Collapse,
  IconButton,
  useMediaQuery,
  Popover,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HomeIcon from "@mui/icons-material/Home";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import DirectionsBikeIcon from "@mui/icons-material/DirectionsBike";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import TuneIcon from "@mui/icons-material/Tune";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useNavigate } from "react-router-dom";
import GlobalLoadingProgress from "@/components/ui/GlobalLoadingProgress";
import LocateUser from "@/features/map/components/LocateUser";
import MarketMarkers from "@/features/map/components/MarketMarkers";
import CreditMarker from "@/features/map/components/CreditMarker";
import RoutingEngine from "@/features/map/components/RoutingEngine";
import useAuth from "@/features/auth/hooks/useAuth";
import useLogout from "@/features/auth/hooks/useLogout";
import { useThemeStore } from "@/store/themeStore";
import useFeatureFlag from "@/hooks/useFeatureFlag";
import GlobalAISearchDialog from "@/features/map/components/GlobalAISearchDialog";
import RouteConfirmDialog from "@/features/map/components/RouteConfirmDialog";
import SharedMarketProductsModal from "@/components/ui/SharedMarketProductsModal";
import { getChainColor } from "@/features/map/config/markerColors";
import {
  DEFAULT_VISIBLE_CHAINS,
  KNOWN_CHAIN_NAMES,
  toCanonicalChainName,
} from "@/features/map/config/defaultVisibleChains";
import "@/assets/map.css";

const INITIAL_VIEW_STATE = {
  longitude: 21.409471852749466,
  latitude: 42.00430265307896,
  zoom: 16,
  pitch: 0,
  bearing: 0,
};

const VISIBLE_CHAINS_STORAGE_KEY = "obrok.map.visibleChains";

const getInitialVisibleChains = () => {
  try {
    const raw = window.localStorage.getItem(VISIBLE_CHAINS_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE_CHAINS);

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(DEFAULT_VISIBLE_CHAINS);

    if (parsed.length === 0) return new Set();

    const valid = parsed
      .map((name) => toCanonicalChainName(name))
      .filter(Boolean);

    return valid.length > 0 ? new Set(valid) : new Set(DEFAULT_VISIBLE_CHAINS);
  } catch {
    return new Set(DEFAULT_VISIBLE_CHAINS);
  }
};

const MapPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const mode = useThemeStore((state) => state.mode);
  const toggleColorMode = useThemeStore((state) => state.toggleColorMode);
  const logout = useLogout();
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [userLocation, setUserLocation] = useState(null);
  const [routeStart, setRouteStart] = useState(null);
  const [routeEnd, setRouteEnd] = useState(null);
  const [routingMode, setRoutingMode] = useState("walking");
  const [isLoading, setIsLoading] = useState(false);
  const [isDisabledRoutingButton, setIsDisabledRoutingButton] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [visibleChains, setVisibleChains] = useState(
    getInitialVisibleChains,
  );
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const aiSearchEnabled = useFeatureFlag("ai-search");

  const [routeConfirm, setRouteConfirm] = useState(null);
  const [productModalTarget, setProductModalTarget] = useState(null);
  const [activeSmartRouteContext, setActiveSmartRouteContext] = useState(null);

  const mapRef = useRef(null);

  const handleToggleChain = useCallback((name) => {
    setVisibleChains((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        VISIBLE_CHAINS_STORAGE_KEY,
        JSON.stringify(Array.from(visibleChains)),
      );
    } catch {
      // Storage can be unavailable (private mode, quota); the filter still works in memory.
    }
  }, [visibleChains]);

  const handleUserLocation = useCallback((location) => {
    setUserLocation(location);
  }, []);

  const handleChainLocation = useCallback(
    (location) => {
      if (!userLocation) return;
      setRouteStart([userLocation[0], userLocation[1]]);
      setRouteEnd([location[0], location[1]]);
      setIsDisabledRoutingButton(true);
    },
    [userLocation],
  );

  const handleCancelRoute = useCallback(() => {
    setRouteStart(null);
    setRouteEnd(null);
    setRoutingMode("walking");
    setIsDisabledRoutingButton(false);
    setActiveSmartRouteContext(null);
  }, []);

  const handleDashboardClick = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  const handleLoginClick = useCallback(() => {
    navigate("/login");
  }, [navigate]);

  const handleLogoutClick = async () => {
    await logout();
    navigate("/login");
  };

  const disableRouting = useCallback(() => {
    setIsDisabledRoutingButton(true);
  }, []);

  const enableRouting = useCallback(() => {
    setIsDisabledRoutingButton(false);
  }, []);

  const handleSetIsLoading = useCallback((val) => {
    setIsLoading(val);
  }, []);

  const handleRequestRoute = useCallback(
    ({ market, distance, products, searchTerm }) => {
      setRouteConfirm({ market, distance, products, searchTerm });
    },
    [],
  );

  const handleRouteConfirm = useCallback(() => {
    if (!routeConfirm?.market?.location) return;
    const [mLat, mLon] = routeConfirm.market.location;
    if (userLocation) {
      setRouteStart([userLocation[0], userLocation[1]]);
      setRouteEnd([mLon, mLat]);
      setIsDisabledRoutingButton(true);
    }

    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({ center: [mLon, mLat], zoom: 17, duration: 1500 });
    }

    setProductModalTarget({
      marketId: routeConfirm.market._id,
      marketName: routeConfirm.market.name || "Маркет",
      searchTerm: routeConfirm.searchTerm || "",
      shoppingList: routeConfirm.products || [],
      initialAiMode: false,
    });
    setActiveSmartRouteContext({
      marketId: routeConfirm.market._id,
      searchTerm: routeConfirm.searchTerm || "",
      shoppingList: routeConfirm.products || [],
      initialAiMode: false,
    });
    setRouteConfirm(null);
    setAiSearchOpen(false);
  }, [routeConfirm, userLocation]);

  const handleAiSearchClose = useCallback(() => {
    setAiSearchOpen(false);
  }, []);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (!map.getLayer("3d-buildings")) {
      map.addLayer({
        id: "3d-buildings",
        source: "openmaptiles",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#aaa",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.05,
            ["get", "height"],
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.05,
            ["get", "min_height"],
          ],
          "fill-extrusion-opacity": 0.6,
        },
      });
    }

    map.setPitch(45);
  }, []);

  const hasRoute = routeStart !== null && routeEnd !== null;
  const isDark = theme.palette.mode === "dark";
  const isLoggedIn = !!auth?.accessToken;

  const filterButton = (
    <IconButton
      onClick={(e) =>
        setFilterAnchor(filterAnchor ? null : e.currentTarget)
      }
      sx={{
        color: theme.palette.text.primary,
        backgroundColor: filterAnchor
          ? theme.palette.action.selected
          : isDark
            ? "#0f172a"
            : theme.palette.action.hover,
      }}
    >
      <TuneIcon />
    </IconButton>
  );

  return (
    <Box
      sx={{
        width: "100%",
        height: "100dvh",
        position: "relative",
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
      }}
    >
      {isLoading && <GlobalLoadingProgress />}
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        onLoad={onMapLoad}
        minZoom={10}
        maxZoom={18}
      >
        <LocateUser
          onUserLocation={handleUserLocation}
          setIsLoading={handleSetIsLoading}
          disableRouting={disableRouting}
          enableRouting={enableRouting}
          followUser={!hasRoute}
        />
        <CreditMarker />
        <MarketMarkers
          onChainLocation={handleChainLocation}
          isDisabledRoutingButton={isDisabledRoutingButton || hasRoute}
          visibleChains={visibleChains}
          activeSmartRouteContext={activeSmartRouteContext}
        />
        {hasRoute && (
          <RoutingEngine
            startLng={routeStart[0]}
            startLat={routeStart[1]}
            endLng={routeEnd[0]}
            endLat={routeEnd[1]}
            mode={routingMode}
          />
        )}
      </Map>
      {hasRoute && (
        <>
          <ModeSelectorContainer direction="row" spacing={1}>
            <ModeButton
              active={routingMode === "walking"}
              onClick={() => setRoutingMode("walking")}
              disabled={routingMode === "walking"}
            >
              <DirectionsWalkIcon />
            </ModeButton>
            <ModeButton
              active={routingMode === "car"}
              onClick={() => setRoutingMode("car")}
              disabled={routingMode === "car"}
            >
              <DirectionsCarIcon />
            </ModeButton>
            <ModeButton
              active={routingMode === "cycling"}
              onClick={() => setRoutingMode("cycling")}
              disabled={routingMode === "cycling"}
            >
              <DirectionsBikeIcon />
            </ModeButton>
          </ModeSelectorContainer>

          {isMobile ? (
            <CancelRouteIconButton onClick={handleCancelRoute}>
              <CloseIcon />
            </CancelRouteIconButton>
          ) : (
            <CancelRouteButton variant="contained" onClick={handleCancelRoute}>
              <CloseIcon sx={{ marginRight: "5px" }} /> Откажи ја рутата
            </CancelRouteButton>
          )}
        </>
      )}
      {!isLoading && (
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
            onClick={() => {
              setMenuExpanded(!menuExpanded);
              setFilterAnchor(null);
            }}
            $expanded={menuExpanded}
            $isDark={isDark}
          >
            <SettingsIcon
              sx={{
                fontSize: 28,
                transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transform: menuExpanded ? "rotate(90deg)" : "rotate(0deg)",
              }}
            />
          </MenuToggleButton>

          <Collapse in={menuExpanded} orientation="horizontal" timeout={350}>
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
              {isLoggedIn ? (
                <>
                  <IconButton
                    onClick={handleDashboardClick}
                    color="primary"
                    sx={{
                      backgroundColor: isDark
                        ? "#0f172a"
                        : theme.palette.action.hover,
                    }}
                  >
                    <HomeIcon />
                  </IconButton>
                  <IconButton
                    onClick={toggleColorMode}
                    sx={{
                      color: theme.palette.text.primary,
                      backgroundColor: isDark
                        ? "#0f172a"
                        : theme.palette.action.hover,
                    }}
                  >
                    {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
                  </IconButton>
                  {filterButton}
                  <IconButton
                    onClick={handleLogoutClick}
                    color="error"
                    sx={{
                      backgroundColor: isDark
                        ? "#0f172a"
                        : theme.palette.action.hover,
                    }}
                  >
                    <LogoutIcon />
                  </IconButton>
                </>
              ) : (
                <>
                  <IconButton
                    onClick={toggleColorMode}
                    sx={{
                      color: theme.palette.text.primary,
                      backgroundColor: isDark
                        ? "#0f172a"
                        : theme.palette.action.hover,
                    }}
                  >
                    {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
                  </IconButton>
                  {filterButton}
                  <IconButton
                    onClick={handleLoginClick}
                    color="primary"
                    sx={{
                      backgroundColor: isDark
                        ? "#0f172a"
                        : theme.palette.action.hover,
                    }}
                  >
                    <LoginIcon />
                  </IconButton>
                </>
              )}
            </Box>
          </Collapse>

          <Popover
            open={Boolean(filterAnchor)}
            anchorEl={filterAnchor}
            onClose={() => setFilterAnchor(null)}
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
                    onClick={() => handleToggleChain(name)}
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
                      backgroundColor: isDark
                        ? "#334155"
                        : theme.palette.action.hover,
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
        </Box>
      )}
      {aiSearchEnabled && !isLoading && (
        <IconButton
          onClick={() => setAiSearchOpen(true)}
          sx={{
            position: "absolute",
            bottom: "100px",
            left: "20px",
            zIndex: 1000,
            width: 56,
            height: 56,
            backgroundColor: aiSearchOpen
              ? theme.palette.primary.main
              : isDark
                ? "#1e293b"
                : "#ffffff",
            color: aiSearchOpen
              ? theme.palette.mode === "dark"
                ? "#000"
                : "#fff"
              : isDark
                ? "#f8fafc"
                : theme.palette.text.primary,
            border: `1px solid ${aiSearchOpen ? "transparent" : isDark ? "#334155" : theme.palette.divider}`,
            boxShadow: theme.shadows[6],
            "&:hover": {
              backgroundColor: aiSearchOpen
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
      )}
      <GlobalAISearchDialog
        open={aiSearchOpen}
        onClose={handleAiSearchClose}
        onDismiss={handleAiSearchClose}
        onRequestRoute={handleRequestRoute}
        userLocation={userLocation}
      />
      <SharedMarketProductsModal
        open={!!productModalTarget}
        onClose={() => setProductModalTarget(null)}
        marketId={productModalTarget?.marketId}
        title={`${productModalTarget?.marketName || "Маркет"} Продукти`}
        initialSearch={productModalTarget?.searchTerm}
        initialAiMode={productModalTarget?.initialAiMode}
        initialShoppingList={productModalTarget?.shoppingList}
      />
      <RouteConfirmDialog
        open={!!routeConfirm}
        onClose={() => setRouteConfirm(null)}
        onConfirm={handleRouteConfirm}
        marketName={routeConfirm?.market?.name || ""}
        distance={routeConfirm?.distance}
      />
    </Box>
  );
};

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

export default MapPage;
