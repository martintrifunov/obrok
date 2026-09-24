import { Box, LinearProgress, Typography, styled } from "@mui/material";
import { RELEASE_VERSION } from "@/api/consts";

const GlobalLoadingProgress = () => {
  return (
    <GlobalLoadingOverlay>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Оброк
      </Typography>
      <Box width={{ xs: "50%", md: "15%" }} mb={2}>
        <LinearProgress color="primary" />
      </Box>
      <Typography variant="body2" color="text.secondary">
        Release: {RELEASE_VERSION}
      </Typography>
    </GlobalLoadingOverlay>
  );
};

const GlobalLoadingOverlay = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  height: "100vh",
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  zIndex: 9999,
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.primary,
}));

export default GlobalLoadingProgress;
