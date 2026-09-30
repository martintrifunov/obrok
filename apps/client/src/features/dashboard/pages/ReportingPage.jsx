import { useState, useCallback } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Autocomplete,
  Chip,
  Alert,
  LinearProgress,
  Typography,
  Paper,
  useTheme,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import { useChainsDropdown } from "@/features/chains/hooks/useChainQueries";
import { useMarketsDropdown } from "@/features/markets/hooks/useMarketQueries";
import {
  useCreateReport,
  useReportStatus,
  useCancelReport,
  useDownloadReport,
} from "@/features/reports/hooks/useReportQueries";

const getToday = () => new Date().toISOString().slice(0, 10);

const STATUS_CONFIG = {
  PENDING: { label: "Queued", color: "info", message: "Report is queued for generation…" },
  PROCESSING: { label: "Generating", color: "info", message: "Generating report…" },
  COMPLETED: { label: "Ready", color: "success", message: "Report is ready for download." },
  FAILED: { label: "Failed", color: "error", message: "Report generation failed." },
  CANCELLED: { label: "Cancelled", color: "warning", message: "Report generation was cancelled." },
  ABORTED: { label: "Aborted", color: "error", message: "Report generation timed out." },
};

const ReportingPage = () => {
  const theme = useTheme();
  const [selectedChain, setSelectedChain] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [fromDate, setFromDate] = useState(getToday);
  const [toDate, setToDate] = useState(getToday);
  const [activeJobId, setActiveJobId] = useState(null);

  const { data: chains = [], isLoading: chainsLoading } = useChainsDropdown();
  const { data: markets = [], isLoading: marketsLoading } = useMarketsDropdown();

  const filteredMarkets = selectedChain
    ? markets.filter((m) => m.chain?._id === selectedChain._id)
    : markets;

  const createReport = useCreateReport();
  const cancelReport = useCancelReport();
  const downloadReport = useDownloadReport();
  const { data: jobStatus } = useReportStatus(activeJobId);

  const status = jobStatus?.status;
  const isActive = status === "PENDING" || status === "PROCESSING";
  const statusConfig = status ? STATUS_CONFIG[status] : null;

  const handleGenerate = useCallback(() => {
    setActiveJobId(null);
    const filters = {};
    if (selectedChain) filters.chainId = selectedChain._id;
    if (selectedMarket) filters.marketId = selectedMarket._id;
    if (fromDate) filters.from = fromDate;
    if (toDate) filters.to = toDate;
    createReport.mutate(filters, {
      onSuccess: (data) => setActiveJobId(data.jobId),
    });
  }, [selectedChain, selectedMarket, fromDate, toDate, createReport]);

  const handleCancel = useCallback(() => {
    if (activeJobId) cancelReport.mutate(activeJobId);
  }, [activeJobId, cancelReport]);

  const handleDownload = useCallback(() => {
    if (activeJobId) downloadReport.mutate(activeJobId);
  }, [activeJobId, downloadReport]);

  const dateFieldSx = {
    minWidth: { sm: 150 },
    flex: { xs: 1, sm: "initial" },
  };

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{ p: { xs: 2, sm: 3 }, mb: 3, border: 1, borderColor: "divider", borderRadius: 2 }}
      >
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Filters
        </Typography>

        <Stack
          direction="row"
          flexWrap="wrap"
          gap={2}
          alignItems="flex-start"
          sx={{ mb: 0 }}
        >
          <Autocomplete
            size="small"
            options={chains}
            getOptionLabel={(o) => o.name}
            value={selectedChain}
            onChange={(_, val) => {
              setSelectedChain(val);
              if (!val || (selectedMarket && selectedMarket.chain?._id !== val._id)) {
                setSelectedMarket(null);
              }
            }}
            loading={chainsLoading}
            renderInput={(params) => (
              <TextField {...params} label="Chain" placeholder="All chains" />
            )}
            sx={{ width: { xs: "100%", sm: 200 } }}
            disabled={isActive}
          />
          <Autocomplete
            size="small"
            options={filteredMarkets}
            getOptionLabel={(o) => o.name}
            value={selectedMarket}
            onChange={(_, val) => setSelectedMarket(val)}
            loading={marketsLoading}
            renderInput={(params) => (
              <TextField {...params} label="Market" placeholder="All markets" />
            )}
            sx={{ width: { xs: "100%", sm: 200 } }}
            disabled={isActive}
          />
          <TextField
            size="small"
            type="date"
            label="From"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { style: { colorScheme: theme.palette.mode } },
            }}
            sx={dateFieldSx}
            disabled={isActive}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { style: { colorScheme: theme.palette.mode } },
            }}
            sx={dateFieldSx}
            disabled={isActive}
          />
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleGenerate}
            disabled={isActive || createReport.isPending}
            size="small"
            sx={{ height: 40, whiteSpace: "nowrap", width: { xs: "100%", sm: "auto" }, mt: { xs: 0.5, sm: "1px" } }}
          >
            Generate
          </Button>
        </Stack>
      </Paper>

      {createReport.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {createReport.error?.response?.data?.message || "Failed to create report."}
        </Alert>
      )}

      {statusConfig && (
        <Paper
          elevation={0}
          sx={{ p: { xs: 2, sm: 3 }, border: 1, borderColor: "divider", borderRadius: 2 }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={2}
          >
            <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Chip label={statusConfig.label} color={statusConfig.color} size="small" />
                <Typography variant="body2" color="text.secondary">
                  {statusConfig.message}
                </Typography>
              </Stack>

              {isActive && <LinearProgress color="info" />}

              {status === "FAILED" && jobStatus?.error && (
                <Alert severity="error" variant="outlined">
                  {jobStatus.error}
                </Alert>
              )}

              {jobStatus?.createdAt && (
                <Typography variant="caption" color="text.secondary">
                  Started: {new Date(jobStatus.startedAt || jobStatus.createdAt).toLocaleString()}
                  {jobStatus.finishedAt && ` · Finished: ${new Date(jobStatus.finishedAt).toLocaleString()}`}
                </Typography>
              )}
            </Stack>

            <Stack direction="row" spacing={1} sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}>
              {isActive && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
                  disabled={cancelReport.isPending}
                  size="small"
                  sx={{ flex: { xs: 1, sm: "initial" } }}
                >
                  Cancel
                </Button>
              )}
              {status === "COMPLETED" && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                  disabled={downloadReport.isPending}
                  size="small"
                  sx={{ flex: { xs: 1, sm: "initial" } }}
                >
                  Download CSV
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default ReportingPage;

