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
import {
  isManualPrice,
  marketLabel,
} from "@/features/products/utils/marketPrices";
import AddMarketPriceRow from "@/features/products/components/AddMarketPriceRow";

const MarketPricesTable = ({
  marketProducts = [],
  priceEdits,
  removedMarkets,
  onPriceChange,
  onToggleRemove,
  markets = [],
  addedPrices = [],
  onAddPrice,
  onRemoveAddedPrice,
  error,
}) => {
  const marketsById = new Map(markets.map((m) => [m._id, m]));
  const takenMarkets = new Set([
    ...marketProducts.map((mp) => mp.market?._id || mp.market),
    ...addedPrices.map((p) => p.market),
  ]);
  const availableMarkets = markets.filter((m) => !takenMarkets.has(m._id));
  const hasRows = marketProducts.length > 0 || addedPrices.length > 0;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Prices
      </Typography>
      {!hasRows && (
        <Typography variant="body2" color="text.secondary">
          This product isn&apos;t sold at any market.
        </Typography>
      )}
      {hasRows && (
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
                              <InputAdornment position="end">
                                ден
                              </InputAdornment>
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
              {addedPrices.map(({ market, price }) => {
                const label = marketLabel(marketsById.get(market));
                return (
                  <TableRow key={`new-${market}`}>
                    <TableCell>{label}</TableCell>
                    <TableCell>{`${price} ден`}</TableCell>
                    <TableCell>
                      <Chip
                        label="New"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Don't add this price">
                        <IconButton
                          size="small"
                          aria-label={`Remove new price at ${label}`}
                          onClick={() => onRemoveAddedPrice(market)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
      <AddMarketPriceRow
        availableMarkets={availableMarkets}
        onAdd={onAddPrice}
      />
      {error && <FormHelperText error>{error}</FormHelperText>}
    </Box>
  );
};

export default MarketPricesTable;
