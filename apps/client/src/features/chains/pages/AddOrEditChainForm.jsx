import { useState } from "react";
import {
  Button,
  TextField,
  Box,
  Paper,
  Typography,
  InputAdornment,
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
import { useNavigate, useParams } from "react-router-dom";
import FileUploader from "@/components/ui/FileUploader";
import GlobalLoadingProgress from "@/components/ui/GlobalLoadingProgress";
import { BASE_URL } from "@/api/consts";
import useInitFromData from "@/hooks/useInitFromData";
import { useChain, useSaveChain } from "@/features/chains/hooks/useChainQueries";
import {
  useImages,
  useUploadImage,
} from "@/features/images/hooks/useImageQueries";

const AddOrEditChainForm = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const params = useParams();

  const isEditMode = !!params.chainId;

  const [chain, setChain] = useState({});
  const [errors, setErrors] = useState({});
  const [selectedImageId, setSelectedImageId] = useState("");
  const [selectedImageTitle, setSelectedImageTitle] = useState("");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const { data: fetchedChain, isLoading: isFetchingChain } = useChain(
    params.chainId,
  );
  const { data: images = [], refetch: fetchImages } = useImages();

  const saveMutation = useSaveChain(isEditMode, params.chainId);
  const uploadImageMutation = useUploadImage();

  useInitFromData(fetchedChain, (data) => {
    setChain(data);
    if (data.image) {
      setSelectedImageId(data.image._id);
      setSelectedImageTitle(data.image.title);
    }
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    setChain((prev) => ({ ...prev, [name]: value }));
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

  const handleSelectImage = (image) => {
    setSelectedImageId(image._id);
    setSelectedImageTitle(image.title);
    setErrors((prev) => ({ ...prev, image: undefined }));
    setImageDialogOpen(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrors({});

    const chainData = {};
    if (isEditMode) chainData.id = params.chainId;

    chainData.name = chain.name;

    if (selectedImageId) chainData.image = selectedImageId;

    saveMutation.mutate(chainData, {
      onSuccess: () => navigate("/dashboard"),
      onError: (error) => {
        setErrors(error.response?.data || { message: "Error saving chain" });
      },
    });
  };

  if (
    isFetchingChain ||
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
          {isEditMode ? "Edit Chain" : "Register Chain"}
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
              name="name"
              label="Chain Name"
              variant="outlined"
              fullWidth
              value={chain?.name || ""}
              onChange={handleChange}
              error={!!errors.name}
              helperText={errors.name}
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
          </Box>
        </Paper>

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button
            variant="text"
            color="inherit"
            onClick={() => navigate("/dashboard")}
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
            {isEditMode ? "Save Changes" : "Register"}
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

export default AddOrEditChainForm;
