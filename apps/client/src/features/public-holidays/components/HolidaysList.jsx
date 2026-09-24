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
import {
  useHolidays,
  useDeleteHoliday,
} from "@/features/public-holidays/hooks/useHolidayQueries";

const HolidaysTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.02)",
  backgroundColor: theme.palette.background.paper,
}));

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("mk-MK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const HolidaysList = ({ searchTerm }) => {
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
  } = useHolidays({
    searchTerm: debouncedSearch,
    page: page + 1,
    limit: rowsPerPage,
  });

  const holidays = responseData?.data || [];
  const totalHolidays = responseData?.pagination?.total || 0;

  const deleteMutation = useDeleteHoliday();

  useEffect(() => {
    if (isError && error?.response?.status === 401) {
      navigate("/login", { state: { from: location }, replace: true });
    }
  }, [isError, error, navigate, location]);

  const handleRemoveHoliday = async (holidayId) => {
    if (window.confirm("Are you sure you want to remove this holiday?")) {
      deleteMutation.mutate(holidayId, {
        // Step back when the last row on a page is removed so it isn't left empty.
        onSuccess: () => {
          if (holidays.length === 1 && page > 0) setPage(page - 1);
        },
      });
    }
  };

  return (
    <>
      {isError && (
        <Typography color="error">
          {error?.response?.data?.message || "Error"}
        </Typography>
      )}

      {isSmallScreen ? (
        <>
        <Stack spacing={2} sx={{ width: "100%" }}>
          {!isLoading
            ? holidays.map((holiday) => (
                <Card
                  key={holiday._id}
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
                          {holiday.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(holiday.date)}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={0.5} ml={1}>
                        <IconButton
                          size="small"
                          color="inherit"
                          aria-label="edit holiday"
                          onClick={() =>
                            navigate(`/dashboard/holiday/${holiday._id}`)
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="inherit"
                          aria-label="delete holiday"
                          onClick={() => handleRemoveHoliday(holiday._id)}
                          disabled={deleteMutation.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
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
                    height={80}
                    width="100%"
                    sx={{ borderRadius: 2 }}
                  />
                ))}
        </Stack>
        <TablePagination
          component="div"
          count={totalHolidays}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[]}
        />
        </>
      ) : (
        <HolidaysTableContainer>
          <Table sx={{ minWidth: 400 }}>
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
                  Date
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
                ? holidays.map((holiday, index) => (
                    <TableRow key={holiday._id}>
                      <TableCell>{index + 1 + page * rowsPerPage}</TableCell>
                      <TableCell>{holiday.name}</TableCell>
                      <TableCell>{formatDate(holiday.date)}</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>
                        <IconButton
                          size="small"
                          color="inherit"
                          aria-label="edit holiday"
                          onClick={() =>
                            navigate(`/dashboard/holiday/${holiday._id}`)
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="inherit"
                          aria-label="delete holiday"
                          onClick={() => handleRemoveHoliday(holiday._id)}
                          disabled={deleteMutation.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                : Array(5)
                    .fill()
                    .map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={4}>
                          <Skeleton animation="wave" height={40} />
                        </TableCell>
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={totalHolidays}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPageOptions={[]}
          />
        </HolidaysTableContainer>
      )}
    </>
  );
};

export default HolidaysList;
