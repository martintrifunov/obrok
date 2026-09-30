import { useState } from "react";
import {
  Backdrop,
  Box,
  Modal,
  Fade,
  Button,
  Typography,
  styled,
  IconButton,
} from "@mui/material";
import RemoveRedEyeIcon from "@mui/icons-material/RemoveRedEye";
import CloseIcon from "@mui/icons-material/Close";

const ImagePreviewModal = ({ imageTitle, image, variant = "text" }) => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <Button
        color={variant === "contained" ? "primary" : "inherit"}
        variant={variant}
        sx={{ textTransform: "none" }}
        onClick={handleOpen}
        disabled={!imageTitle}
        startIcon={<RemoveRedEyeIcon />}
      >
        View
      </Button>
      <Modal
        aria-labelledby="transition-modal-title"
        aria-describedby="transition-modal-description"
        open={open}
        onClose={handleClose}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 500,
          },
        }}
      >
        <Fade in={open}>
          <ModalContent>
            <IconButton
              onClick={handleClose}
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                color: "text.secondary",
                "&:hover": {
                  color: "text.primary",
                },
              }}
            >
              <CloseIcon />
            </IconButton>
            <Typography
              id="transition-modal-title"
              variant="h6"
              textAlign="center"
              component="h2"
              sx={{
                fontWeight: "bold",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                mb: 2,
                px: 2,
              }}
            >
              {imageTitle}
            </Typography>
            <Box className="image-container">
              <img
                src={image}
                className="modal-image"
                alt={imageTitle || "Modal Image"}
              />
            </Box>
          </ModalContent>
        </Fade>
      </Modal>
    </>
  );
};

const ModalContent = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[24],
  padding: theme.spacing(4),
  display: "flex",
  flexDirection: "column",
  outline: "none",

  "& .image-container": {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    maxWidth: "85vw",
    maxHeight: "75vh",
    overflow: "hidden",
    borderRadius: theme.shape.borderRadius,
  },

  "& .modal-image": {
    maxWidth: "100%",
    maxHeight: "75vh",
    objectFit: "contain",
    display: "block",
  },
}));

export default ImagePreviewModal;
