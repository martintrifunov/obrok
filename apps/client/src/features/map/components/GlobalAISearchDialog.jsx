import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Card,
  CardContent,
  useTheme,
  TextField,
  Pagination,
  CircularProgress,
  Chip,
  useMediaQuery,
  Tabs,
  Tab,
  Divider,
  Switch,
  FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import StorefrontIcon from "@mui/icons-material/Storefront";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { BASE_URL } from "@/api/consts";
import getCategoryIcon from "@/components/ui/categoryIcons";
import {
  useAISearch,
  useSmartSearchBudget,
  useSmartSearch,
} from "@/features/products/hooks/useProductQueries";
import useFeatureFlag from "@/hooks/useFeatureFlag";

const formatDistance = (meters) => {
  if (meters == null) return null;
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const CRIMSON = "#DC143C";

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
    }, 500);
    return () => clearTimeout(timer);
  }, [isRegularTabActive, searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isSmartTabActive) {
        const normalizedQuery = smartInput.trim();
        setSmartDebouncedQuery(normalizedQuery);

        const loc = userLocationRef.current;
        if (normalizedQuery && loc?.length === 2) {
          setSmartSearchLocation({
            lat: Number(loc[1].toFixed(4)),
            lon: Number(loc[0].toFixed(4)),
          });
        } else {
          setSmartSearchLocation(null);
        }
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [isSmartTabActive, smartInput]);

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

  const results = data?.data || [];
  const pagination = data?.pagination;
  const priceSort = data?.priceSort || null;

  const { data: smartData, isLoading: smartLoading } = useSmartSearch(
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
        <IconButton onClick={handleExplicitClose} sx={{ color: "text.secondary" }}>
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
          <>
            <Box
              sx={{
                p: 2,
                backgroundColor: "background.paper",
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <TextField
                size="small"
                fullWidth
                autoFocus
                placeholder="Пребарувај низ сите маркети..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <AutoAwesomeIcon color="primary" sx={{ mr: 1 }} />
                  ),
                }}
              />
              {priceSort && (
                <Chip
                  icon={priceSort === "asc" ? <TrendingDownIcon /> : <TrendingUpIcon />}
                  label={priceSort === "asc" ? "Најевтино прво" : "Најскапо прво"}
                  size="small"
                  color={priceSort === "asc" ? "success" : "warning"}
                  sx={{ mt: 1, borderRadius: 1 }}
                />
              )}
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2 }}>
              {!debouncedQuery ? (
                <Typography
                  textAlign="center"
                  color="text.secondary"
                  py={4}
                  variant="body2"
                >
                  Внесете термин за пребарување низ сите маркети.
                </Typography>
              ) : isLoading ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  height="100%"
                >
                  <CircularProgress />
                </Box>
              ) : results.length === 0 ? (
                <Typography textAlign="center" color="text.secondary" py={4}>
                  Нема резултати за &quot;{debouncedQuery}&quot;.
                </Typography>
              ) : (
                <Box display="flex" flexDirection="column" gap={2}>
                  {results.map((item) => {
                    const p = item.product;
                    const CategoryIcon = getCategoryIcon(p?.category);

                    return (
                      <Card
                        key={p?._id}
                        sx={{
                          display: "flex",
                          flexDirection: isMobile ? "column" : "row",
                          borderRadius: 2,
                          border: `1px solid ${theme.palette.divider}`,
                          boxShadow: "0px 2px 10px rgba(0,0,0,0.03)",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            width: isMobile ? "100%" : 120,
                            height: isMobile ? 120 : 120,
                            flexShrink: 0,
                            position: "relative",
                            backgroundColor:
                              theme.palette.mode === "dark"
                                ? "grey.900"
                                : "grey.100",
                            borderRight: isMobile
                              ? "none"
                              : `1px solid ${theme.palette.divider}`,
                            borderBottom: isMobile
                              ? `1px solid ${theme.palette.divider}`
                              : "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {p?.image ? (
                            <Box
                              component="img"
                              src={`${BASE_URL}${p.image.url}`}
                              alt={p.title}
                              sx={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <CategoryIcon
                              sx={{
                                fontSize: 40,
                                color: theme.palette.grey[400],
                              }}
                            />
                          )}
                        </Box>

                        <CardContent
                          sx={{
                            flexGrow: 1,
                            p: 2,
                            "&:last-child": { pb: 2 },
                          }}
                        >
                          <Typography
                            variant="subtitle1"
                            fontWeight="bold"
                            lineHeight={1.2}
                          >
                            {p?.title || "No Title"}
                          </Typography>

                          {p?.category && (
                            <Chip
                              label={p.category}
                              size="small"
                              variant="outlined"
                              sx={{ mt: 0.5, borderRadius: 1 }}
                            />
                          )}

                          {item.marketProducts?.length > 0 && (
                            <Box
                              sx={{
                                mt: 1,
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 1,
                              }}
                            >
                              {item.marketProducts.map((mp, idx) => (
                                <Chip
                                  key={idx}
                                  icon={<StorefrontIcon />}
                                  label={`${mp.market?.name || "Маркет"} — ${mp.price} ден.`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  clickable
                                  onClick={(e) =>
                                    handleMarketChipClick(e, mp.market, p?.title)
                                  }
                                  sx={{ borderRadius: 1 }}
                                />
                              ))}
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </Box>

            {!isLoading && pagination?.totalPages > 1 && (
              <Box
                sx={{
                  p: 2,
                  borderTop: `1px solid ${theme.palette.divider}`,
                  backgroundColor: "background.paper",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Pagination
                  count={pagination.totalPages}
                  page={page}
                  onChange={(e, val) => setPage(val)}
                  color="primary"
                  shape="rounded"
                  size={isMobile ? "small" : "medium"}
                  siblingCount={isMobile ? 0 : 1}
                />
              </Box>
            )}
          </>
        )}

        {isSmartTabActive && (
          <>
            <Box
              sx={{
                p: 2,
                backgroundColor: "background.paper",
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <TextField
                size="small"
                fullWidth
                autoFocus
                placeholder="Внеси оброк што ти се јаде..."
                value={smartInput}
                onChange={(e) => setSmartInput(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <ShoppingCartIcon color="primary" sx={{ mr: 1 }} />
                  ),
                }}
              />
            </Box>

            <Box
              sx={{
                px: 2,
                py: 1,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: theme.palette.action.hover,
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" fontWeight="bold">
                Буџет за оброк:{" "}
                {smartBudgetData?.data?.weeklyBudget != null
                  ? `${smartBudgetData.data.weeklyBudget} ден.`
                  : "—"}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={budgetOnly}
                    onChange={(e) => setBudgetOnly(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="caption">Само во буџет</Typography>
                }
                sx={{ mr: 0 }}
              />
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2 }}>
              {!smartDebouncedQuery ? (
                <Typography
                  textAlign="center"
                  color="text.secondary"
                  py={4}
                  variant="body2"
                >
                  Внеси оброк, а ние ќе ги најдеме потребните состојки и каде
                  се најисплатливи.
                </Typography>
              ) : smartLoading ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  height="100%"
                >
                  <CircularProgress />
                </Box>
              ) : smartData?.redirect ? (
                <Typography textAlign="center" color="text.secondary" py={4}>
                  Не успеавме да го разложиме пребарувањето во јасна листа на
                  состојки.
                  <br />
                  Обиди се со поконкретен оброк (пример: „палачинки“,
                  „шопска салата“) или користи го табот &quot;Пребарување&quot;.
                </Typography>
              ) : !smartData?.data ? (
                <Typography textAlign="center" color="text.secondary" py={4}>
                  Нема резултати за &quot;{smartDebouncedQuery}&quot;.
                </Typography>
              ) : (
                <Box display="flex" flexDirection="column" gap={2}>
                  <Box>
                    <Typography
                      variant="subtitle2"
                      fontWeight="bold"
                      gutterBottom
                    >
                      Листа на производи
                    </Typography>
                    <Box
                      sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                    >
                      {smartData.data.shoppingList.map((item) => (
                        <Chip
                          key={item.name}
                          icon={
                            item.found ? (
                              <CheckCircleIcon />
                            ) : (
                              <CancelIcon />
                            )
                          }
                          label={item.name}
                          size="small"
                          color={item.found ? "success" : "error"}
                          variant="outlined"
                          sx={{ borderRadius: 1 }}
                        />
                      ))}
                    </Box>
                  </Box>

                  <Divider />

                  <Typography variant="subtitle2" fontWeight="bold">
                    Маркети
                  </Typography>
                  {smartData.data.markets.length === 0 ? (
                    <Typography
                      textAlign="center"
                      color="text.secondary"
                      py={2}
                    >
                      Нема маркети со овие производи.
                    </Typography>
                  ) : (
                    smartData.data.markets.map((entry) => {
                      const m = entry.market;
                      const dist = formatDistance(entry.distance);
                      const matchColor = entry.complete
                        ? "success"
                        : "warning";

                      return (
                        <Card
                          key={m._id}
                          sx={{
                            borderRadius: 2,
                            border: `1px solid ${theme.palette.divider}`,
                            boxShadow: "0px 2px 10px rgba(0,0,0,0.03)",
                            overflow: "hidden",
                          }}
                        >
                          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                mb: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <StorefrontIcon
                                  color="primary"
                                  fontSize="small"
                                />
                                <Typography
                                  variant="subtitle1"
                                  fontWeight="bold"
                                  lineHeight={1.2}
                                >
                                  {m.name}
                                </Typography>
                              </Box>
                              {dist && (
                                <Chip
                                  icon={<LocationOnIcon />}
                                  label={dist}
                                  size="small"
                                  variant="outlined"
                                  clickable
                                  color="info"
                                  onClick={(e) =>
                                    handleDistanceChipClick(e, m, entry.distance, entry.products)
                                  }
                                  sx={{ borderRadius: 1, cursor: "pointer" }}
                                />
                              )}
                            </Box>

                            <Box
                              sx={{
                                display: "flex",
                                gap: 1,
                                mb: 1,
                                flexWrap: "wrap",
                              }}
                            >
                              <Chip
                                label={`${entry.matchCount}/${entry.totalProducts} производи`}
                                size="small"
                                color={matchColor}
                                sx={{ borderRadius: 1 }}
                              />
                              <Chip
                                label={`Вкупно: ${entry.totalPrice} ден.`}
                                size="small"
                                color="primary"
                                sx={{ borderRadius: 1 }}
                              />
                              {entry.overBudgetAmount > 0 && (
                                <Chip
                                  label={`Доплата: ${entry.overBudgetAmount} ден.`}
                                  size="small"
                                  sx={{
                                    borderRadius: 1,
                                    backgroundColor: CRIMSON,
                                    color: "#fff",
                                  }}
                                />
                              )}
                            </Box>

                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.5,
                              }}
                            >
                              {entry.products.map((prod) => (
                                <Box
                                  key={prod.name}
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{ color: prod.overflow ? CRIMSON : "text.secondary" }}
                                  >
                                    {prod.title}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    fontWeight="bold"
                                    sx={{ color: prod.overflow ? CRIMSON : "inherit" }}
                                  >
                                    {prod.price} ден.
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </Box>
              )}
            </Box>
          </>
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
