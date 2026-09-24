import { Box, CircularProgress, Typography } from "@mui/material";

export const SearchMessage = ({ children, py = 4, variant }) => (
  <Typography textAlign="center" color="text.secondary" py={py} variant={variant}>
    {children}
  </Typography>
);

export const SearchSpinner = () => (
  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
    <CircularProgress />
  </Box>
);
