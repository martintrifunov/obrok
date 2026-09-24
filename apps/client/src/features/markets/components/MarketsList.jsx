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
  Button,
  styled,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { useNavigate, useLocation } from "react-router-dom";
import useDebounce from "@/hooks/useDebounce";
import useResettablePage from "@/hooks/useResettablePage";
import SharedMarketProductsModal from "@/components/ui/SharedMarketProductsModal";
import {
  useMarkets,
  useDeleteMarket,
} from "@/features/markets/hooks/useMarketQueries";

const MarketsList = ({ searchTerm }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const rowsPerPage = 5;
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState({ id: null, name: "" });

  const debouncedSearch = useDebounce(searchTerm);
  const [page, setPage] = useResettablePage(debouncedSearch);

  const {
    data: responseData,
    isLoading,
    isError,
    error,
  } = useMarkets({
    searchTerm: debouncedSearch,
    page: page + 1,
    limit: rowsPerPage,
  });

  const markets = responseData?.data || [];
  const totalMarkets = responseData?.pagination?.total || 0;

  const deleteMutation = useDeleteMarket();

  useEffect(() => {
    if (isError && error?.response?.status === 401) {
      navigate("/login", { state: { from: location }, replace: true });
    }
  }, [isError, error, navigate, location]);

  const handleRemoveMarket = async (marketId) => {
    if (
      window.confirm(
        "Are you sure you want to remove this market?\nThis WILL REMOVE all of its price listings as well.",
      )
    ) {
      deleteMutation.mutate(marketId, {
        // Step back when the last row on a page is removed so it isn't left empty.
        onSuccess: () => {
          if (markets.length === 1 && page > 0) setPage(page - 1);
        },
      });
    }
  };

  return (
    <>
      {isError && (
        <Error variant="p">{error?.response?.data?.message || "Error"}</Error>
      )}

      {isSmallScreen ? (
        <>
        <Stack spacing={2} sx={{ width: "100%" }}>
          {!isLoading
            ? markets.map((market) => (
                <Card
                  key={market._id}
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
                          {market.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Chain:</strong>{" "}
                          {market.chain?.name || "N/A"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Location:</strong>{" "}
                          {market.location.join(", ")}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={0.5} ml={1}>
                        <IconButton
                          size="small"
                          color="inherit"
                          aria-label="edit market"
                          onClick={() =>
                            navigate(`/dashboard/market/${market._id}`)
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="inherit"
                          aria-label="delete market"
                          onClick={() => handleRemoveMarket(market._id)}
                          disabled={deleteMutation.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Box display="flex" gap={2} mt={2}>
                      <Button
                        sx={{ flex: 1 }}
                        variant="contained"
                        color="primary"
                        disableElevation
                        onClick={() => {
                          setSelectedMarket({
                            id: market._id,
                            name: market.name,
                          });
                          setModalOpen(true);
                        }}
                        startIcon={<LocalOfferIcon />}
                      >
                        Products
                      </Button>
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
        <TablePagination
          component="div"
          count={totalMarkets}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[]}
        />
        </>
      ) : (
        <MarketsTableContainer>
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
                  Name
                </TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: "bold" }}>
                  Chain
                </TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: "bold" }}>
                  Location
                </TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: "bold" }}>
                  Products
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
                ? markets.map((market, index) => (
                    <TableRow key={market._id}>
                      <TableCell>{index + 1 + page * rowsPerPage}</TableCell>
                      <TableCell>{market.name}</TableCell>
                      <TableCell>{market.chain?.name || "N/A"}</TableCell>
                      <TableCell>{market.location.join(", ")}</TableCell>
                      <TableCell>
                        <Button
                          color="inherit"
                          sx={{ textTransform: "none" }}
                          onClick={() => {
                            setSelectedMarket({
                              id: market._id,
                              name: market.name,
                            });
                            setModalOpen(true);
                          }}
                        >
                          <LocalOfferIcon sx={{ marginRight: 1 }} /> View
                        </Button>
                      </TableCell>
                      <TableCell style={{ textAlign: "right" }}>
                        <IconButton
                          color="inherit"
                          aria-label="edit market"
                          onClick={() =>
                            navigate(`/dashboard/market/${market._id}`)
                          }
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="inherit"
                          aria-label="delete market"
                          onClick={() => handleRemoveMarket(market._id)}
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
            count={totalMarkets}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[]}
          />
        </MarketsTableContainer>
      )}

      <SharedMarketProductsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        marketId={selectedMarket.id}
        title={`${selectedMarket.name} Products`}
      />
    </>
  );
};

const MarketsTableContainer = styled(TableContainer)(({ theme }) => ({
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

export default MarketsList;
