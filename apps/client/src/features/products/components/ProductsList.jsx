import { useState, useEffect } from "react";
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TablePagination,
  Skeleton,
  Stack,
  Card,
  CardContent,
  useMediaQuery,
  Box,
  styled,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate, useLocation } from "react-router-dom";
import useDebounce from "@/hooks/useDebounce";
import ImagePreviewModal from "@/components/ui/ImagePreviewModal";
import { BASE_URL } from "@/api/consts";
import {
  useProducts,
  useDeleteProduct,
} from "@/features/products/hooks/useProductQueries";

const ProductsList = ({ searchTerm }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [page, setPage] = useState(0);
  const rowsPerPage = 5;

  const debouncedSearch = useDebounce(searchTerm);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const {
    data: responseData,
    isLoading,
    isError,
    error,
  } = useProducts({
    searchTerm: debouncedSearch,
    page: page + 1,
    limit: rowsPerPage,
  });

  const products = responseData?.data || [];
  const totalProducts = responseData?.pagination?.total || 0;

  const deleteMutation = useDeleteProduct();

  useEffect(() => {
    if (isError && error?.response?.status === 401) {
      navigate("/login", { state: { from: location }, replace: true });
    }
  }, [isError, error, navigate, location]);

  const handleRemoveProduct = async (productId) => {
    if (window.confirm("Are you sure you want to remove this product?")) {
      deleteMutation.mutate(productId);
    }
  };

  const getPriceRange = (marketProducts) => {
    if (!marketProducts || marketProducts.length === 0) return "N/A";
    const prices = marketProducts.map((mp) => mp.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `${min} ден.` : `${min} - ${max} ден.`;
  };

  return (
    <>
      {isError && (
        <Error variant="p">{error?.response?.data?.message || "Error"}</Error>
      )}
      {isSmallScreen ? (
        <Stack spacing={2} sx={{ width: "100%" }}>
          {!isLoading
            ? products.map((product) => (
                <Card
                  key={product._id}
                  sx={{
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: "none",
                    width: "100%",
                  }}
                >
                  <CardContent sx={{ pb: "16px !important" }}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                    >
                      <Box>
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", lineHeight: 1.2, mb: 0.5 }}
                        >
                          {product.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Category: </strong>{" "}
                          {product.category || "N/A"}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={0.5} ml={1}>
                        <IconButton
                          size="small"
                          color="inherit"
                          aria-label="edit product"
                          onClick={() =>
                            navigate(`/dashboard/product/${product._id}`)
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="inherit"
                          aria-label="delete product"
                          onClick={() => handleRemoveProduct(product._id)}
                          disabled={deleteMutation.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Box display="flex" mt={2}>
                      <ImagePreviewModal
                        variant="outlined"
                        image={
                          product.image ? `${BASE_URL}${product.image.url}` : ""
                        }
                        imageTitle={product.image?.title || "Product Image"}
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))
            : Array(5)
                .fill()
                .map((_, i) => (
                  <Skeleton
                    key={i}
                    animation="wave"
                    height={160}
                    width="100%"
                    sx={{ borderRadius: 2 }}
                  />
                ))}
        </Stack>
      ) : (
        <TableWrapper>
          <Table sx={{ minWidth: 600 }}>
            <TableHead
              sx={{
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? theme.palette.background.default
                    : theme.palette.grey[100],
              }}
            >
              <TableRow>
                <TableCell sx={{ color: "text.secondary", fontWeight: "bold" }}>
                  #
                </TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: "bold" }}>
                  Title
                </TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: "bold" }}>
                  Category
                </TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: "bold" }}>
                  Price
                </TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: "bold" }}>
                  Image
                </TableCell>
                <TableCell
                  sx={{
                    color: "text.secondary",
                    fontWeight: "bold",
                    textAlign: "right",
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!isLoading
                ? products.map((product, index) => (
                    <TableRow key={product._id}>
                      <TableCell>{index + 1 + page * rowsPerPage}</TableCell>
                      <TableCell>{product.title}</TableCell>
                      <TableCell>{product.category || "N/A"}</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        {getPriceRange(product.marketProducts)}
                      </TableCell>
                      <TableCell>
                        <ImagePreviewModal
                          imageTitle={product.image?.title}
                          image={
                            product.image
                              ? `${BASE_URL}${product.image.url}`
                              : ""
                          }
                        />
                      </TableCell>
                      <TableCell style={{ textAlign: "right" }}>
                        <IconButton
                          color="inherit"
                          aria-label="edit product"
                          onClick={() =>
                            navigate(`/dashboard/product/${product._id}`)
                          }
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="inherit"
                          aria-label="delete product"
                          onClick={() => handleRemoveProduct(product._id)}
                          disabled={deleteMutation.isPending}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                : Array(5)
                    .fill()
                    .map((_, i) => (
                      <TableRow key={i}>
                        {Array(6)
                          .fill()
                          .map((_, idx) => (
                            <TableCell key={idx}>
                              <Skeleton animation="wave" height={40} />
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={totalProducts}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[]}
          />
        </TableWrapper>
      )}
    </>
  );
};

const TableWrapper = styled(TableContainer)(({ theme }) => ({
  width: "100%",
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.02)",
  backgroundColor: theme.palette.background.paper,
}));

const Error = styled(Typography)(() => ({
  color: "crimson",
  width: "100%",
  display: "flex",
  justifyContent: "center",
}));

export default ProductsList;
