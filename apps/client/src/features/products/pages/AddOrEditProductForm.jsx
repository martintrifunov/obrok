import { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Box,
  Paper,
  Typography,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Alert,
  Container,
  Avatar,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ImageIcon from "@mui/icons-material/Image";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import CheckIcon from "@mui/icons-material/Check";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import FileUploader from "@/components/ui/FileUploader";
import GlobalLoadingProgress from "@/components/ui/GlobalLoadingProgress";
import { BASE_URL } from "@/api/consts";
import {
  useProduct,
  useSaveProduct,
} from "@/features/products/hooks/useProductQueries";
import { useMarketsDropdown } from "@/features/markets/hooks/useMarketQueries";
import {
  useImages,
  useUploadImage,
} from "@/features/images/hooks/useImageQueries";
import RichTextEditor from "@/components/ui/RichTextEditor";
import useInitFromData from "@/hooks/useInitFromData";
import MarketPricesTable from "@/features/products/components/MarketPricesTable";
import { isManualPrice } from "@/features/products/utils/marketPrices";

const AddOrEditProductForm = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const isEditMode = !!params.productId;

  const [product, setProduct] = useState({});
  const [errors, setErrors] = useState({});
  const [selectedMarketId, setSelectedMarketId] = useState("");
  const [selectedImageId, setSelectedImageId] = useState("");
  const [selectedImageTitle, setSelectedImageTitle] = useState("");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  // Edit mode only: marketId -> edited price text, and markets whose price is being removed.
  const [priceEdits, setPriceEdits] = useState({});
  const [removedMarkets, setRemovedMarkets] = useState([]);
  // Edit mode only: new hand-added prices at markets the product isn't sold at yet.
  const [addedPrices, setAddedPrices] = useState([]);

  const { data: markets = [] } = useMarketsDropdown();
  const {
    data: fetchedProduct,
    isLoading: isFetchingProduct,
    isError: isFetchError,
  } = useProduct(params.productId);
  const { data: images = [], refetch: fetchImages } = useImages();

  const saveMutation = useSaveProduct(isEditMode, params.productId);
  const uploadImageMutation = useUploadImage();

  useEffect(() => {
    if (isFetchError) {
      navigate("/login", { state: { from: location }, replace: true });
    }
  }, [isFetchError, location, navigate]);

  useInitFromData(fetchedProduct, (data) => {
    setProduct({ ...data });
    if (data.image) {
      setSelectedImageId(data.image._id);
      setSelectedImageTitle(data.image.title);
    }
  });

  const handleChange = (event) => {
    if (typeof event === "string" || event?.target === undefined) {
      setErrors((prev) => ({ ...prev, description: undefined }));
      return setProduct((prev) => ({ ...prev, description: `${event}` }));
    }

    const { name, value } = event.target;
    setErrors((prev) => ({ ...prev, [name]: undefined }));

    if (name === "market") setSelectedMarketId(value);
    else setProduct((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenImageDialog = () => {
    fetchImages();
    setImageDialogOpen(true);
  };

  const onSelectFileHandler = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadImageMutation.mutate(file, {
      onSuccess: (data) => {
        setSelectedImageId(data._id);
        setSelectedImageTitle(data.title);
        setErrors((prev) => ({ ...prev, image: undefined }));
      },
      onError: () => {
        setErrors({ message: "Failed to upload image." });
      },
    });
  };

  const onDeleteFileHandler = () => {
    setSelectedImageId("");
    setSelectedImageTitle("");
  };

  const handlePriceChange = (marketId, value) => {
    setErrors((prev) => ({ ...prev, prices: undefined }));
    setPriceEdits((prev) => ({ ...prev, [marketId]: value }));
  };

  const handleToggleRemove = (marketId) => {
    setErrors((prev) => ({ ...prev, prices: undefined }));
    setRemovedMarkets((prev) =>
      prev.includes(marketId)
        ? prev.filter((id) => id !== marketId)
        : [...prev, marketId],
    );
  };

  const handleAddPrice = (entry) => {
    setErrors((prev) => ({
      ...prev,
      prices: undefined,
      addedPrices: undefined,
    }));
    setAddedPrices((prev) => [...prev, entry]);
  };

  const handleRemoveAddedPrice = (marketId) => {
    setAddedPrices((prev) => prev.filter((p) => p.market !== marketId));
  };

  // Changed hand-added prices, or an error message if one is invalid.
  const collectPriceChanges = () => {
    const prices = [];
    for (const mp of fetchedProduct?.marketProducts || []) {
      const marketId = mp.market?._id || mp.market;
      const edited = priceEdits[marketId];
      if (
        !isManualPrice(mp) ||
        edited === undefined ||
        removedMarkets.includes(marketId)
      ) {
        continue;
      }
      const price = parseFloat(edited);
      if (!(price > 0)) return { error: "Prices must be greater than 0." };
      if (price !== mp.price) prices.push({ market: marketId, price });
    }
    return { prices };
  };

  const handleSelectImage = (image) => {
    setSelectedImageId(image._id);
    setSelectedImageTitle(image.title);
    setErrors((prev) => ({ ...prev, image: undefined }));
    setImageDialogOpen(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrors({});

    const productData = {};
    if (isEditMode) productData.id = params.productId;

    productData.title = product.title;
    productData.category = product.category;
    productData.description = product.description;

    if (isEditMode) {
      const { prices, error } = collectPriceChanges();
      if (error) return setErrors({ prices: error });
      if (prices.length) productData.prices = prices;
      if (removedMarkets.length) productData.removedMarkets = removedMarkets;
      if (addedPrices.length) productData.addedPrices = addedPrices;
    } else {
      productData.price = product.price ? parseFloat(product.price) : null;
      if (selectedMarketId) productData.market = selectedMarketId;
    }

    if (selectedImageId) productData.image = selectedImageId;
    // An omitted image means "keep it" on the server, so removal must be sent explicitly.
    else if (isEditMode && fetchedProduct?.image) productData.image = null;

    saveMutation.mutate(productData, {
      onSuccess: () => navigate("/dashboard/products"),
      onError: (error) => {
        setErrors(error.response?.data || { message: "Error saving product" });
      },
    });
  };

  if (
    isFetchingProduct ||
    saveMutation.isPending ||
    uploadImageMutation.isPending
  ) {
    return <GlobalLoadingProgress />;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" fontWeight="bold">
          {isEditMode ? "Edit Product" : "Add Product"}
        </Typography>
      </Box>

      <form autoComplete="off" onSubmit={handleSubmit}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box display="flex" flexDirection="column" gap={3}>
            {errors.message && (
              <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
                {errors.message}
              </Alert>
            )}

            <TextField
              name="title"
              label="Title"
              variant="outlined"
              fullWidth
              value={product?.title || ""}
              onChange={handleChange}
              error={!!errors.title}
              helperText={errors.title}
            />

            {isEditMode ? (
              <MarketPricesTable
                marketProducts={fetchedProduct?.marketProducts}
                priceEdits={priceEdits}
                removedMarkets={removedMarkets}
                onPriceChange={handlePriceChange}
                onToggleRemove={handleToggleRemove}
                markets={markets}
                addedPrices={addedPrices}
                onAddPrice={handleAddPrice}
                onRemoveAddedPrice={handleRemoveAddedPrice}
                error={errors.prices || errors.addedPrices}
              />
            ) : (
              <Box
                display="flex"
                gap={3}
                sx={{ flexDirection: { xs: "column", sm: "row" } }}
              >
                <TextField
                  name="price"
                  label="Price"
                  variant="outlined"
                  type="number"
                  fullWidth
                  value={product?.price || ""}
                  onChange={handleChange}
                  error={!!errors.price}
                  helperText={errors.price}
                  sx={{ flex: 1 }}
                />

                <FormControl fullWidth sx={{ flex: 1 }} error={!!errors.market}>
                  <InputLabel id="market-select-label">Market</InputLabel>
                  <Select
                    labelId="market-select-label"
                    name="market"
                    value={selectedMarketId || ""}
                    label="Market"
                    onChange={handleChange}
                  >
                    {markets.map((market) => (
                      <MenuItem key={market._id} value={market._id}>
                        {market.name}{market.chain?.name ? ` (${market.chain.name})` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.market && (
                    <FormHelperText>{errors.market}</FormHelperText>
                  )}
                </FormControl>
              </Box>
            )}

            <TextField
              name="category"
              label="Category"
              variant="outlined"
              fullWidth
              value={product?.category || ""}
              onChange={handleChange}
              error={!!errors.category}
              helperText={errors.category}
            />

            {selectedImageTitle && (
              <TextField
                label="Selected Image"
                variant="outlined"
                value={selectedImageTitle}
                fullWidth
                disabled
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <ImageIcon />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}

            <Box>
              <FileUploader
                onSelectFile={onSelectFileHandler}
                onDeleteFile={onDeleteFileHandler}
                accept=".jpeg, .jpg, .png, .webp"
              />
              <Box
                display="flex"
                gap={2}
                alignItems="center"
                flexWrap="wrap"
                mt={2}
              >
                <Typography sx={{ color: "text.secondary", fontSize: 14 }}>
                  or select an existing one:
                </Typography>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={handleOpenImageDialog}
                  startIcon={<PhotoLibraryIcon />}
                  sx={{ textTransform: "none" }}
                >
                  Browse Gallery
                </Button>
                {selectedImageId && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={onDeleteFileHandler}
                    sx={{ color: "error.main", textTransform: "none" }}
                  >
                    Remove image
                  </Button>
                )}
              </Box>
              {errors.image && (
                <Typography
                  color="error"
                  variant="caption"
                  sx={{ mt: 1, display: "block", ml: 2 }}
                >
                  {errors.image}
                </Typography>
              )}
            </Box>

            <Box>
              <RichTextEditor
                value={product?.description || ""}
                onChange={(htmlContent) =>
                  handleChange({
                    target: { name: "description", value: htmlContent },
                  })
                }
                error={!!errors.description}
              />
              {errors.description && (
                <Typography
                  color="error"
                  variant="caption"
                  sx={{ display: "block", ml: 2, mt: 0.5 }}
                >
                  {errors.description}
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button
            variant="text"
            color="inherit"
            onClick={() => navigate("/dashboard/products")}
            sx={{ textTransform: "none" }}
            startIcon={<CloseIcon />}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            sx={{ textTransform: "none" }}
            startIcon={<SaveIcon />}
          >
            {isEditMode ? "Save Changes" : "Add Product"}
          </Button>
        </Box>
      </form>

      <Dialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          Select from Gallery
        </DialogTitle>
        <DialogContent dividers>
          {images.length === 0 ? (
            <Typography color="text.secondary">
              No images available in gallery. Please upload a new one.
            </Typography>
          ) : (
            <List>
              {images.map((img) => (
                <ListItemButton
                  key={img._id}
                  selected={selectedImageId === img._id}
                  onClick={() => handleSelectImage(img)}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemIcon>
                    <Avatar
                      src={img.url ? `${BASE_URL}${img.url}` : undefined}
                      variant="rounded"
                      sx={{ width: 32, height: 32, bgcolor: "grey.100" }}
                    >
                      <ImageIcon sx={{ color: "grey.400" }} />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText primary={img.title} secondary={img.mimeType} />
                  {selectedImageId === img._id && <CheckIcon color="primary" />}
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setImageDialogOpen(false)}
            color="inherit"
            sx={{ textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AddOrEditProductForm;
