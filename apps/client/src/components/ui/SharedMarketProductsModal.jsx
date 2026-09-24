import { useState, useEffect } from "react";
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
  Autocomplete,
  useMediaQuery,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { BASE_URL } from "@/api/consts";
import getCategoryIcon from "@/components/ui/categoryIcons";
import {
  useMarketProducts,
  useCategories,
  useAISearch,
} from "@/features/products/hooks/useProductQueries";
import useFeatureFlag from "@/hooks/useFeatureFlag";

const stripHtmlAndDecode = (html) => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};

const SharedMarketProductsModal = ({
  open,
  onClose,
  marketId,
  title,
  initialSearch,
  initialAiMode,
  initialShoppingList,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const aiSearchEnabled = useFeatureFlag("ai-search");

  const [page, setPage] = useState(1);
  const [titleInput, setTitleInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [aiMode, setAiMode] = useState(false);

  const [debouncedTitle, setDebouncedTitle] = useState("");
  const [debouncedCategory, setDebouncedCategory] = useState("");

  const handleAiModeToggle = () => {
    setAiMode((prev) => !prev);
    setPage(1);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTitle(titleInput);
      setDebouncedCategory(categoryInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [titleInput, categoryInput]);

  // Reset filters on close, and apply the caller's initial search on open (or when
  // it changes while open). Done during render when these inputs change, not in an effect.
  const openKey = `${open}|${initialSearch ?? ""}|${initialAiMode ? 1 : 0}`;
  const [appliedOpenKey, setAppliedOpenKey] = useState(null);
  if (appliedOpenKey !== openKey) {
    setAppliedOpenKey(openKey);
    if (!open) {
      setTitleInput("");
      setCategoryInput("");
      setPage(1);
      setAiMode(false);
    } else {
      if (initialSearch) {
        setTitleInput(initialSearch);
        setDebouncedTitle(initialSearch);
      }
      if (initialAiMode) {
        setAiMode(true);
      }
    }
  }

  const { data: categoryOptions = [] } = useCategories(marketId);

  const { data: regularData, isLoading: regularLoading } = useMarketProducts(
    marketId,
    { page, limit: 10, title: debouncedTitle, category: debouncedCategory },
    { enabled: open && !!marketId && !aiMode },
  );

  const { data: aiData, isLoading: aiLoading } = useAISearch(
    { q: debouncedTitle, marketId, page, limit: 10 },
    { enabled: open && !!marketId && aiMode && !!debouncedTitle },
  );

  const isAiActive = aiMode && aiSearchEnabled;
  const data = isAiActive ? aiData : regularData;
  const isLoading = isAiActive ? aiLoading : regularLoading;

  const aiToggleSx = {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 1.5,
    color: aiMode ? "primary.main" : "text.secondary",
    backgroundColor: aiMode
      ? theme.palette.mode === "dark"
        ? "rgba(144, 202, 249, 0.16)"
        : "rgba(25, 118, 210, 0.08)"
      : "transparent",
    border: `1px solid ${aiMode ? theme.palette.primary.main : theme.palette.divider}`,
    "&:hover": {
      backgroundColor: aiMode
        ? theme.palette.mode === "dark"
          ? "rgba(144, 202, 249, 0.24)"
          : "rgba(25, 118, 210, 0.16)"
        : theme.palette.action.hover,
    },
  };

  const products = isAiActive
    ? (data?.data || []).map((item) => ({
        ...item,
        product: item.product,
        price: item.marketProducts?.[0]?.price,
      }))
    : data?.data || [];
  const pagination = data?.pagination;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={isMobile}
      maxWidth="md"
      scroll="paper"
      onClick={(e) => e.stopPropagation()}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          height: isMobile ? "100%" : "85vh",
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
        <Typography variant="h6" component="span" fontWeight="bold">
          {title} {pagination?.total ? `(${pagination.total})` : ""}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: "text.secondary" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          p: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor:
            theme.palette.mode === "dark" ? "background.default" : "grey.50",
        }}
      >
        {initialShoppingList?.length > 0 && (
          <Box
            sx={{
              p: 2,
              backgroundColor: "background.paper",
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <ShoppingCartIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" fontWeight="bold">
                Листа за купување
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {initialShoppingList.map((item) => (
                <Box
                  key={item.name || item.title}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.02)",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {item.title || item.name}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {item.price} ден.
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <Box
          sx={{
            p: 2,
            backgroundColor: "background.paper",
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: "flex",
            gap: { xs: 1.25, sm: 2 },
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
          }}
        >
          {isMobile ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder={
                  isAiActive ? "AI пребарување..." : "Пребарувај по име..."
                }
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                InputProps={{
                  startAdornment: isAiActive ? (
                    <AutoAwesomeIcon color="primary" sx={{ mr: 1 }} />
                  ) : (
                    <SearchIcon color="action" sx={{ mr: 1 }} />
                  ),
                }}
              />
              {aiSearchEnabled && (
                <Tooltip
                  title={aiMode ? "Исклучи AI пребарување" : "AI пребарување"}
                >
                  <IconButton onClick={handleAiModeToggle} sx={aiToggleSx}>
                    <AutoAwesomeIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ) : (
            <>
              <TextField
                size="small"
                fullWidth
                placeholder={isAiActive ? "AI пребарување..." : "Пребарувај по име..."}
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                InputProps={{
                  startAdornment: isAiActive ? (
                    <AutoAwesomeIcon color="primary" sx={{ mr: 1 }} />
                  ) : (
                    <SearchIcon color="action" sx={{ mr: 1 }} />
                  ),
                }}
              />
              {!isAiActive && (
                <Autocomplete
                  options={categoryOptions}
                  fullWidth
                  size="small"
                  value={categoryInput || null}
                  onChange={(event, newValue) => {
                    setCategoryInput(newValue || "");
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Филтрирај во категорија..."
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <FilterListIcon color="action" sx={{ ml: 1, mr: 0.5 }} />
                        ),
                      }}
                    />
                  )}
                />
              )}
              {aiSearchEnabled && (
                <Tooltip title={aiMode ? "Исклучи AI пребарување" : "AI пребарување"}>
                  <IconButton onClick={handleAiModeToggle} sx={aiToggleSx}>
                    <AutoAwesomeIcon />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}

          {isMobile && !isAiActive && (
            <Autocomplete
              options={categoryOptions}
              fullWidth
              size="small"
              value={categoryInput || null}
              onChange={(event, newValue) => {
                setCategoryInput(newValue || "");
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Филтрирај во категорија..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <FilterListIcon color="action" sx={{ ml: 1, mr: 0.5 }} />
                    ),
                  }}
                />
              )}
            />
          )}
        </Box>

        <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2 }}>
          {isLoading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              height="100%"
            >
              <CircularProgress />
            </Box>
          ) : products.length === 0 ? (
            <Typography textAlign="center" color="text.secondary" py={4}>
              No active products match this search.
            </Typography>
          ) : (
            <Box display="flex" flexDirection="column" gap={2}>
              {products.map((item) => {
                const p = item.product || item;
                const price = item.price || p.price || "N/A";
                const CategoryIcon = getCategoryIcon(p?.category);

                return (
                  <Card
                    key={item._id}
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
                        width: isMobile ? "100%" : 140,
                        height: isMobile ? 140 : 140,
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
                        <>
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
                          <Box
                            sx={{
                              position: "absolute",
                              bottom: 6,
                              left: 6,
                              backgroundColor: "rgba(0, 0, 0, 0.55)",
                              borderRadius: "8px",
                              padding: "3px 6px",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <CategoryIcon
                              sx={{ fontSize: 18, color: "#fff" }}
                            />
                          </Box>
                        </>
                      ) : (
                        <CategoryIcon
                          sx={{ fontSize: 44, color: theme.palette.grey[400] }}
                        />
                      )}
                    </Box>

                    <CardContent
                      sx={{ flexGrow: 1, p: 2, "&:last-child": { pb: 2 } }}
                    >
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                      >
                        <Box sx={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
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
                              sx={{ mt: 1, borderRadius: 1, maxWidth: "100%" }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="subtitle1"
                          color="primary.main"
                          fontWeight="bold"
                          whiteSpace="nowrap"
                          ml={1}
                        >
                          {price} ден.
                        </Typography>
                      </Box>
                      {p?.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mt: 1.5,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {stripHtmlAndDecode(p.description)}
                        </Typography>
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

        {aiSearchEnabled && (
          <Box sx={{ px: 2, py: 1, textAlign: "center" }}>
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              Внимание: AI може да направи грешки. Проверете ги состојките пред купување.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SharedMarketProductsModal;
