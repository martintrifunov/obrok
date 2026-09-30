import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from "@mui/material";
import DirectionsIcon from "@mui/icons-material/Directions";
import StorefrontIcon from "@mui/icons-material/Storefront";

const RouteConfirmDialog = ({ open, onClose, onConfirm, marketName, distance }) => {
  const distLabel = distance != null
    ? distance < 1000
      ? `${distance}m`
      : `${(distance / 1000).toFixed(1)} km`
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <DirectionsIcon color="primary" />
        <Typography variant="h6" component="span" fontWeight="bold">
          Насоки до маркет?
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <StorefrontIcon color="action" />
          <Typography variant="body1" fontWeight="bold">
            {marketName}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Дали сакате да бидете навигирани до {marketName}
          {distLabel ? ` (${distLabel})` : ""}?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Не
        </Button>
        <Button onClick={onConfirm} variant="contained" autoFocus>
          Да
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RouteConfirmDialog;
