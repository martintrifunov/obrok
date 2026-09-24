import { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Box,
  Paper,
  Typography,
  Alert,
  Container,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate, useParams } from "react-router-dom";
import GlobalLoadingProgress from "@/components/ui/GlobalLoadingProgress";
import {
  useHoliday,
  useSaveHoliday,
} from "@/features/public-holidays/hooks/useHolidayQueries";

const AddOrEditHolidayForm = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const params = useParams();

  const isEditMode = !!params.holidayId;

  const [holiday, setHoliday] = useState({ name: "", date: "" });
  const [errors, setErrors] = useState({});

  const {
    data: fetchedHoliday,
    isLoading: isFetchingHoliday,
    isError: isFetchHolidayError,
    error: fetchHolidayError,
  } = useHoliday(params.holidayId);

  const saveMutation = useSaveHoliday(isEditMode, params.holidayId);

  useEffect(() => {
    if (fetchedHoliday) {
      setHoliday({
        name: fetchedHoliday.name || "",
        date: fetchedHoliday.date ? fetchedHoliday.date.slice(0, 10) : "",
      });
    }
  }, [fetchedHoliday]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    setHoliday((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrors({});

    const holidayData = {};
    if (isEditMode) holidayData.id = params.holidayId;

    holidayData.name = holiday.name;
    holidayData.date = holiday.date;

    saveMutation.mutate(holidayData, {
      onSuccess: () => navigate("/dashboard/holidays"),
      onError: (error) => {
        setErrors(
          error.response?.data || { message: "Error saving holiday" },
        );
      },
    });
  };

  if (isFetchingHoliday || saveMutation.isPending) {
    return <GlobalLoadingProgress />;
  }

  if (isEditMode && isFetchHolidayError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {fetchHolidayError?.response?.data?.message ||
            "Failed to load holiday."}
        </Alert>
        <Button variant="outlined" onClick={() => navigate("/dashboard/holidays")}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" fontWeight="bold">
          {isEditMode ? "Edit Holiday" : "Add Holiday"}
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          {errors.message && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errors.message}
            </Alert>
          )}

          <Box display="flex" flexDirection="column" gap={3}>
            <TextField
              label="Name"
              name="name"
              value={holiday.name}
              onChange={handleChange}
              error={!!errors.name}
              helperText={errors.name}
              fullWidth
              required
            />

            <TextField
              label="Date"
              name="date"
              type="date"
              value={holiday.date}
              onChange={handleChange}
              error={!!errors.date}
              helperText={errors.date}
              fullWidth
              required
              slotProps={{ inputLabel: { shrink: true } }}
              onClick={(e) => e.currentTarget.querySelector("input")?.showPicker?.()}
              sx={{
                cursor: "pointer",
                "& input": { cursor: "pointer" },
                "& input::-webkit-calendar-picker-indicator": {
                  filter: (theme) =>
                    theme.palette.mode === "dark" ? "invert(1)" : "none",
                  cursor: "pointer",
                },
              }}
            />
          </Box>
        </Paper>

        <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
          <Button variant="text" onClick={() => navigate("/dashboard/holidays")}>
            Cancel
          </Button>
          <Button
            variant="contained"
            type="submit"
            startIcon={<SaveIcon />}
            disabled={saveMutation.isPending}
          >
            {isEditMode ? "Save Changes" : "Add Holiday"}
          </Button>
        </Box>
      </form>
    </Container>
  );
};

export default AddOrEditHolidayForm;
