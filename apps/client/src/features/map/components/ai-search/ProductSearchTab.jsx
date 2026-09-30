import { Box, Chip, Pagination, useTheme } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SearchInputBar from "./SearchInputBar";
import ProductResultCard from "./ProductResultCard";
import { SearchMessage, SearchSpinner } from "./SearchStatus";

const ProductSearchTab = ({
  input,
  onInputChange,
  query,
  isLoading,
  results,
  pagination,
  priceSort,
  page,
  onPageChange,
  onMarketClick,
  isMobile,
}) => {
  const theme = useTheme();

  let content;
  if (!query) {
    content = (
      <SearchMessage variant="body2">
        Внесете термин за пребарување низ сите маркети.
      </SearchMessage>
    );
  } else if (isLoading) {
    content = <SearchSpinner />;
  } else if (results.length === 0) {
    content = <SearchMessage>Нема резултати за &quot;{query}&quot;.</SearchMessage>;
  } else {
    content = (
      <Box display="flex" flexDirection="column" gap={2}>
        {results.map((item) => (
          <ProductResultCard
            key={item.product?._id}
            item={item}
            isMobile={isMobile}
            onMarketClick={onMarketClick}
          />
        ))}
      </Box>
    );
  }

  return (
    <>
      <SearchInputBar
        value={input}
        onChange={onInputChange}
        placeholder="Пребарувај низ сите маркети..."
        icon={<AutoAwesomeIcon color="primary" sx={{ mr: 1 }} />}
      >
        {priceSort && (
          <Chip
            icon={priceSort === "asc" ? <TrendingDownIcon /> : <TrendingUpIcon />}
            label={priceSort === "asc" ? "Најевтино прво" : "Најскапо прво"}
            size="small"
            color={priceSort === "asc" ? "success" : "warning"}
            sx={{ mt: 1, borderRadius: 1 }}
          />
        )}
      </SearchInputBar>

      <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2 }}>{content}</Box>

      {!isLoading && pagination?.totalPages > 1 && (
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: "background.paper",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Pagination
            count={pagination.totalPages}
            page={page}
            onChange={(e, val) => onPageChange(val)}
            color="primary"
            shape="rounded"
            size={isMobile ? "small" : "medium"}
            siblingCount={isMobile ? 0 : 1}
          />
        </Box>
      )}
    </>
  );
};

export default ProductSearchTab;
