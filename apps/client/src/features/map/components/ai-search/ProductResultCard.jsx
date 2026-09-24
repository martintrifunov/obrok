import { Box, Card, CardContent, Chip, Typography, useTheme } from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { BASE_URL } from "@/api/consts";
import { CategoryIcon } from "@/components/ui/categoryIcons";

const ProductResultCard = ({ item, isMobile, onMarketClick }) => {
  const theme = useTheme();
  const p = item.product;

  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: "0px 2px 10px rgba(0,0,0,0.03)",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          width: isMobile ? "100%" : 120,
          height: 120,
          flexShrink: 0,
          position: "relative",
          backgroundColor: theme.palette.mode === "dark" ? "grey.900" : "grey.100",
          borderRight: isMobile ? "none" : `1px solid ${theme.palette.divider}`,
          borderBottom: isMobile ? `1px solid ${theme.palette.divider}` : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {p?.image ? (
          <Box
            component="img"
            src={`${BASE_URL}${p.image.url}`}
            alt={p.title}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <CategoryIcon category={p?.category} sx={{ fontSize: 40, color: theme.palette.grey[400] }} />
        )}
      </Box>

      <CardContent sx={{ flexGrow: 1, p: 2, "&:last-child": { pb: 2 } }}>
        <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
          {p?.title || "No Title"}
        </Typography>

        {p?.category && (
          <Chip
            label={p.category}
            size="small"
            variant="outlined"
            sx={{ mt: 0.5, borderRadius: 1 }}
          />
        )}

        {item.marketProducts?.length > 0 && (
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
            {item.marketProducts.map((mp, idx) => (
              <Chip
                key={idx}
                icon={<StorefrontIcon />}
                label={`${mp.market?.name || "Маркет"} — ${mp.price} ден.`}
                size="small"
                color="primary"
                variant="outlined"
                clickable
                onClick={(e) => onMarketClick(e, mp.market, p?.title)}
                sx={{ borderRadius: 1 }}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductResultCard;
