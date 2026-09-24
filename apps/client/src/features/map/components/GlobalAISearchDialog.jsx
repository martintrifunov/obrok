import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import {
  useAISearch,
  useSmartSearchBudget,
  useSmartSearch,
} from "@/features/products/hooks/useProductQueries";
import useFeatureFlag from "@/hooks/useFeatureFlag";
import ProductSearchTab from "@/features/map/components/ai-search/ProductSearchTab";
import MealSearchTab from "@/features/map/components/ai-search/MealSearchTab";

export const PRODUCT_SEARCH_DEBOUNCE_MS = 500;
export const MEAL_SEARCH_DEBOUNCE_MS = 700;

// Rounded so small GPS jitter doesn't create a new query (and a new AI call).
const roundLocation = ([lon, lat]) => ({
  lat: Number(lat.toFixed(4)),
  lon: Number(lon.toFixed(4)),
});

const GlobalAISearchDialog = ({
  open,
  onClose,
  onDismiss,
  onRequestRoute,
  userLocation,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const smartSearchEnabled = useFeatureFlag("smart-search");

  const [tab, setTab] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [smartInput, setSmartInput] = useState("");
  const [smartDebouncedQuery, setSmartDebouncedQuery] = useState("");
  const [smartSearchLocation, setSmartSearchLocation] = useState(null);
  const [budgetOnly, setBudgetOnly] = useState(false);
  const userLocationRef = useRef(userLocation);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const isSmartTabActive = smartSearchEnabled && tab === 0;
  const isRegularTabActive = smartSearchEnabled ? tab === 1 : tab === 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isRegularTabActive) {
        setDebouncedQuery(searchInput);
        setPage(1);
      }
    }, PRODUCT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isRegularTabActive, searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isSmartTabActive) {
        const normalizedQuery = smartInput.trim();
        setSmartDebouncedQuery(normalizedQuery);

        const loc = userLocationRef.current;
        if (normalizedQuery && loc?.length === 2) {
          setSmartSearchLocation(roundLocation(loc));
        } else {
          setSmartSearchLocation(null);
        }
      }
    }, MEAL_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isSmartTabActive, smartInput]);

  // A meal search sent before the first GPS fix has no distances. When the fix
  // arrives, attach it once (no-location -> location only, so later GPS movement
  // doesn't re-run the AI query).
  if (
    open &&
    isSmartTabActive &&
    smartDebouncedQuery &&
    !smartSearchLocation &&
    userLocation?.length === 2
  ) {
    setSmartSearchLocation(roundLocation(userLocation));
  }

  const handleExplicitClose = useCallback(() => {
    setSearchInput("");
    setSmartInput("");
    setDebouncedQuery("");
    setSmartDebouncedQuery("");
    setSmartSearchLocation(null);
    setBudgetOnly(false);
    setPage(1);
    setTab(0);
    onClose();
  }, [onClose]);

  const dismiss = useCallback(() => {
    if (onDismiss) onDismiss();
    else onClose();
  }, [onDismiss, onClose]);

  const handleDialogClose = useCallback(
    (_, reason) => {
      if (reason === "backdropClick" || reason === "escapeKeyDown") {
        handleExplicitClose();
        return;
      }

      dismiss();
    },
    [dismiss, handleExplicitClose],
  );

  const { data, isLoading } = useAISearch(
    { q: debouncedQuery, page, limit: 10 },
    { enabled: open && isRegularTabActive && !!debouncedQuery },
  );

  const {
    data: smartData,
    isLoading: smartLoading,
    error: smartError,
  } = useSmartSearch(
    {
      q: smartDebouncedQuery,
      lat: smartSearchLocation?.lat,
      lon: smartSearchLocation?.lon,
      budgetOnly,
    },
    { enabled: open && isSmartTabActive && !!smartDebouncedQuery },
  );

  const { data: smartBudgetData } = useSmartSearchBudget({
    enabled: open && isSmartTabActive,
  });

  const handleMarketChipClick = useCallback(
    (e, market, productTitle) => {
      e.stopPropagation();
      if (market?.location?.length === 2 && onRequestRoute) {
        onRequestRoute({
          market,
          searchTerm: productTitle,
        });
      }
    },
    [onRequestRoute],
  );

  const handleDistanceChipClick = useCallback(
    (e, market, distance, products) => {
      e.stopPropagation();
      if (onRequestRoute) {
        onRequestRoute({ market, distance, products });
      }
    },
    [onRequestRoute],
  );

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      fullWidth
      fullScreen={isMobile}
      maxWidth="md"
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          height: isMobile ? "100%" : "80vh",
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AutoAwesomeIcon color="primary" />
          <Typography variant="h6" component="span" fontWeight="bold">
            AI Пребарување
          </Typography>
        </Box>
        <IconButton
          aria-label="Затвори"
          onClick={handleExplicitClose}
          sx={{ color: "text.secondary" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {smartSearchEnabled && (
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
        >
          <Tab label="Оброк" icon={<ShoppingCartIcon />} iconPosition="start" sx={{ minHeight: 48 }} />
          <Tab label="Пребарување" icon={<AutoAwesomeIcon />} iconPosition="start" sx={{ minHeight: 48 }} />
        </Tabs>
      )}

      <DialogContent
        dividers={!smartSearchEnabled}
        sx={{
          p: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor:
            theme.palette.mode === "dark" ? "background.default" : "grey.50",
        }}
      >
        {isRegularTabActive && (
          <ProductSearchTab
            input={searchInput}
            onInputChange={setSearchInput}
            query={debouncedQuery}
            isLoading={isLoading}
            results={data?.data || []}
            pagination={data?.pagination}
            priceSort={data?.priceSort || null}
            page={page}
            onPageChange={setPage}
            onMarketClick={handleMarketChipClick}
            isMobile={isMobile}
          />
        )}

        {isSmartTabActive && (
          <MealSearchTab
            input={smartInput}
            onInputChange={setSmartInput}
            query={smartDebouncedQuery}
            isLoading={smartLoading}
            error={smartError}
            result={smartData}
            weeklyBudget={smartBudgetData?.data?.weeklyBudget}
            budgetOnly={budgetOnly}
            onBudgetOnlyChange={setBudgetOnly}
            onDistanceClick={handleDistanceChipClick}
          />
        )}

        <Box sx={{ px: 2, py: 1, textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: "text.disabled" }}>
            Внимание: AI може да направи грешки. Проверете ги состојките пред купување.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalAISearchDialog;
