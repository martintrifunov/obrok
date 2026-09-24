import { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { marketLabel } from "@/features/products/utils/marketPrices";

const AddMarketPriceRow = ({ availableMarkets, onAdd }) => {
  const [marketId, setMarketId] = useState("");
  const [priceText, setPriceText] = useState("");
  const [error, setError] = useState("");

  const handleAdd = () => {
    const price = parseFloat(priceText);
    if (!marketId) return setError("Choose a market.");
    if (!(price > 0)) return setError("Price must be greater than 0.");
    onAdd({ market: marketId, price });
    setMarketId("");
    setPriceText("");
    setError("");
  };

  if (availableMarkets.length === 0) return null;

  return (
    <Box mt={2}>
      <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-start">
        <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
          <InputLabel id="add-price-market-label">Market</InputLabel>
          <Select
            labelId="add-price-market-label"
            label="Market"
            value={marketId}
            onChange={(e) => {
              setMarketId(e.target.value);
              setError("");
            }}
          >
            {availableMarkets.map((market) => (
              <MenuItem key={market._id} value={market._id}>
                {marketLabel(market)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          type="number"
          label="Price"
          value={priceText}
          onChange={(e) => {
            setPriceText(e.target.value);
            setError("");
          }}
          inputProps={{ min: 0, step: "0.01", "aria-label": "New price" }}
          InputProps={{
            endAdornment: <InputAdornment position="end">ден</InputAdornment>,
          }}
          sx={{ width: 150 }}
        />
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd}>
          Add price
        </Button>
      </Box>
      {error && <FormHelperText error>{error}</FormHelperText>}
    </Box>
  );
};

export default AddMarketPriceRow;
