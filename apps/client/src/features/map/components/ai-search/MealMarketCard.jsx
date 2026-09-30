import { Box, Card, CardContent, Chip, Typography, useTheme } from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { formatDistance } from "@/features/map/utils/formatDistance";

const CRIMSON = "#DC143C";

const MealMarketCard = ({ entry, onDistanceClick }) => {
  const theme = useTheme();
  const m = entry.market;
  const dist = formatDistance(entry.distance);

  return (
    <Card
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: "0px 2px 10px rgba(0,0,0,0.03)",
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <StorefrontIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
              {m.name}
            </Typography>
          </Box>
          {dist && (
            <Chip
              icon={<LocationOnIcon />}
              label={dist}
              size="small"
              variant="outlined"
              clickable
              color="info"
              onClick={(e) => onDistanceClick(e, m, entry.distance, entry.products)}
              sx={{ borderRadius: 1, cursor: "pointer" }}
            />
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 1, mb: 1, flexWrap: "wrap" }}>
          <Chip
            label={`${entry.matchCount}/${entry.totalProducts} производи`}
            size="small"
            color={entry.complete ? "success" : "warning"}
            sx={{ borderRadius: 1 }}
          />
          <Chip
            label={`Вкупно: ${entry.totalPrice} ден.`}
            size="small"
            color="primary"
            sx={{ borderRadius: 1 }}
          />
          {entry.overBudgetAmount > 0 && (
            <Chip
              label={`Доплата: ${entry.overBudgetAmount} ден.`}
              size="small"
              sx={{ borderRadius: 1, backgroundColor: CRIMSON, color: "#fff" }}
            />
          )}
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {entry.products.map((prod) => (
            <Box
              key={prod.name}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: prod.overflow ? CRIMSON : "text.secondary" }}
              >
                {prod.title}
              </Typography>
              <Typography
                variant="body2"
                fontWeight="bold"
                sx={{ color: prod.overflow ? CRIMSON : "inherit" }}
              >
                {prod.price} ден.
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default MealMarketCard;
