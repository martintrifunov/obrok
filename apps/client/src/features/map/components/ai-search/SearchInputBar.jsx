import { Box, TextField, useTheme } from "@mui/material";

const SearchInputBar = ({ value, onChange, placeholder, icon, children }) => {
  const theme = useTheme();

  return (
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
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        InputProps={{ startAdornment: icon }}
      />
      {children}
    </Box>
  );
};

export default SearchInputBar;
