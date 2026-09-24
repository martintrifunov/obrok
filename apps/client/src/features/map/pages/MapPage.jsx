import { useState, useRef, useCallback } from "react";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import GlobalLoadingProgress from "@/components/ui/GlobalLoadingProgress";
import LocateUser from "@/features/map/components/LocateUser";
import MarketMarkers from "@/features/map/components/MarketMarkers";
import CreditMarker from "@/features/map/components/CreditMarker";
import RoutingEngine from "@/features/map/components/RoutingEngine";
import RouteControls from "@/features/map/components/RouteControls";
import MapSettingsMenu from "@/features/map/components/MapSettingsMenu";
import AISearchButton from "@/features/map/components/AISearchButton";
import useFeatureFlag from "@/hooks/useFeatureFlag";
import GlobalAISearchDialog from "@/features/map/components/GlobalAISearchDialog";
import RouteConfirmDialog from "@/features/map/components/RouteConfirmDialog";
import SharedMarketProductsModal from "@/components/ui/SharedMarketProductsModal";
import useVisibleChains from "@/features/map/hooks/useVisibleChains";
import { add3dBuildingsLayer } from "@/features/map/utils/add3dBuildingsLayer";
import { getMapPopupStyles } from "@/features/map/config/mapPopupStyles";
import "@/assets/map.css";

const INITIAL_VIEW_STATE = {
  longitude: 21.409471852749466,
  latitude: 42.00430265307896,
  zoom: 16,
  pitch: 0,
  bearing: 0,
};

const MapPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [userLocation, setUserLocation] = useState(null);
  const [routeStart, setRouteStart] = useState(null);
  const [routeEnd, setRouteEnd] = useState(null);
  const [routingMode, setRoutingMode] = useState("walking");
  const [isLoading, setIsLoading] = useState(false);
  const [isDisabledRoutingButton, setIsDisabledRoutingButton] = useState(false);
  const { visibleChains, toggleChain } = useVisibleChains();
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const aiSearchEnabled = useFeatureFlag("ai-search");

  const [routeConfirm, setRouteConfirm] = useState(null);
  const [productModalTarget, setProductModalTarget] = useState(null);
  const [activeSmartRouteContext, setActiveSmartRouteContext] = useState(null);

  const mapRef = useRef(null);

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

    add3dBuildingsLayer(map);
    map.setPitch(45);
  }, []);

  const hasRoute = routeStart !== null && routeEnd !== null;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100dvh",
        position: "relative",
        ...getMapPopupStyles(theme),
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
        <RouteControls
          routingMode={routingMode}
          onRoutingModeChange={setRoutingMode}
          onCancel={handleCancelRoute}
          isMobile={isMobile}
        />
      )}
      {!isLoading && (
        <MapSettingsMenu
          visibleChains={visibleChains}
          onToggleChain={toggleChain}
        />
      )}
      {aiSearchEnabled && !isLoading && (
        <AISearchButton
          active={aiSearchOpen}
          onClick={() => setAiSearchOpen(true)}
        />
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

export default MapPage;
