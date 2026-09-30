import { TextField, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

const ProductSearchBar = ({ handleSearchChange }) => {
  return (
    <TextField
      hiddenLabel
      aria-label="Search products"
      placeholder="Search products..."
      variant="outlined"
      onChange={handleSearchChange}
      fullWidth
      size="small"
      sx={{
        backgroundColor: "background.paper",
        "& .MuiOutlinedInput-root": {
          "&.Mui-focused fieldset": {
            borderColor: "primary.main",
          },
        },
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        },
      }}
    />
  );
};

export default ProductSearchBar;
