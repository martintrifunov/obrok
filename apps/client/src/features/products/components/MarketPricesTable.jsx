import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  FormHelperText,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UndoIcon from "@mui/icons-material/Undo";
import { isManualPrice } from "@/features/products/utils/marketPrices";

const marketLabel = (market) =>
  market
    ? `${market.name}${market.chain?.name ? ` (${market.chain.name})` : ""}`
    : "Unknown market";

const MarketPricesTable = ({
  marketProducts = [],
  priceEdits,
  removedMarkets,
  onPriceChange,
  onToggleRemove,
  error,
}) => {
  if (marketProducts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        This product isn&apos;t sold at any market.
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Prices
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Market</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Source</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {marketProducts.map((mp) => {
              const marketId = mp.market?._id || mp.market;
              const manual = isManualPrice(mp);
              const removed = removedMarkets.includes(marketId);
              const label = marketLabel(mp.market);

              return (
                <TableRow key={marketId} sx={{ opacity: removed ? 0.5 : 1 }}>
                  <TableCell
                    sx={{ textDecoration: removed ? "line-through" : "none" }}
                  >
                    {label}
                  </TableCell>
                  <TableCell sx={{ minWidth: 130 }}>
                    {manual ? (
                      <TextField
                        size="small"
                        type="number"
                        value={priceEdits[marketId] ?? mp.price}
                        onChange={(e) =>
                          onPriceChange(marketId, e.target.value)
                        }
                        disabled={removed}
                        inputProps={{
                          min: 0,
                          step: "0.01",
                          "aria-label": `Price at ${label}`,
                        }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">ден</InputAdornment>
                          ),
                        }}
                      />
                    ) : (
                      `${mp.price} ден`
                    )}
                  </TableCell>
                  <TableCell>
                    {manual ? (
                      <Chip
                        label="Manual"
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Updated by scraper
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {manual && (
                      <Tooltip
                        title={
                          removed
                            ? "Keep this price"
                            : "Remove from this market"
                        }
                      >
                        <IconButton
                          size="small"
                          aria-label={
                            removed
                              ? `Keep price at ${label}`
                              : `Remove price at ${label}`
                          }
                          onClick={() => onToggleRemove(marketId)}
                        >
                          {removed ? (
                            <UndoIcon fontSize="small" />
                          ) : (
                            <DeleteOutlineIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {error && <FormHelperText error>{error}</FormHelperText>}
    </Box>
  );
};

export default MarketPricesTable;
