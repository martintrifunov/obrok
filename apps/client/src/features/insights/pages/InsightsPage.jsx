import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PsychologyIcon from "@mui/icons-material/Psychology";
import BoltIcon from "@mui/icons-material/Bolt";
import RadarIcon from "@mui/icons-material/Radar";
import DownloadIcon from "@mui/icons-material/Download";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  useInsightsSummary,
  useInsightsFeatureTrends,
  downloadInsightsCsv,
} from "@/features/insights/hooks/useInsightsQueries";

const RANGE_OPTIONS = [
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "Last 365 days", value: 365 },
];

const StatCard = ({ title, value, icon }) => (
  <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, height: "100%" }}>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="body2" color="text.secondary">{title}</Typography>
        {icon}
      </Stack>
      <Typography variant="h4" fontWeight={700}>{value}</Typography>
    </CardContent>
  </Card>
);

const ChartCard = ({ title, children }) => (
  <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
    <CardContent>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{title}</Typography>
      <Box sx={{ width: "100%", height: 320 }}>{children}</Box>
    </CardContent>
  </Card>
);

const InsightsPage = () => {
  const [days, setDays] = useState(30);
  const [exportError, setExportError] = useState("");
  const { data, isLoading, isError, error } = useInsightsSummary(days);
  const { data: featureTrendData } = useInsightsFeatureTrends(days);

  const featureData = useMemo(() => ([
    {
      feature: "Smart Search",
      count: data?.featureUsage?.["smart-search"] || 0,
    },
    {
      feature: "Hybrid Search",
      count: data?.featureUsage?.["hybrid-search"] || 0,
    },
  ]), [data]);

  const handleExport = async () => {
    setExportError("");
    try {
      await downloadInsightsCsv(days);
    } catch (err) {
      setExportError(err?.response?.data?.message || "Only admin users can export insights CSV.");
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={240} height={42} sx={{ mb: 2 }} />
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <Grid key={idx} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={340} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={340} sx={{ mb: 2 }} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {error?.response?.data?.message || "Failed to load insights statistics."}
      </Alert>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Insights Statistics</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="insights-range-label">Range</InputLabel>
            <Select
              labelId="insights-range-label"
              value={days}
              label="Range"
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {RANGE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      {exportError && (
        <Alert severity="warning" sx={{ mb: 2 }}>{exportError}</Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard title="Total Visits" value={data?.totalVisits || 0} icon={<VisibilityIcon color="primary" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard title="Unique Visitors" value={data?.uniqueVisitors || 0} icon={<PeopleAltIcon color="primary" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard title="Active Users (5m)" value={data?.activeUsersNow || 0} icon={<RadarIcon color="primary" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 6, lg: 3 }}>
          <StatCard title="Smart Search Uses" value={data?.featureUsage?.["smart-search"] || 0} icon={<PsychologyIcon color="primary" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 6, lg: 3 }}>
          <StatCard title="Hybrid Search Uses" value={data?.featureUsage?.["hybrid-search"] || 0} icon={<BoltIcon color="primary" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 6, lg: 3 }}>
          <StatCard title="Unique Visitors This Month" value={data?.currentMonthUniqueVisitors || 0} icon={<PeopleAltIcon color="primary" />} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <ChartCard title="Visits and Unique Visitors Over Time">
            <ResponsiveContainer>
              <LineChart data={data?.daily || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visits" stroke="#0B57D0" strokeWidth={2} dot={false} name="Visits" />
                <Line type="monotone" dataKey="uniqueVisitors" stroke="#2E7D32" strokeWidth={2} dot={false} name="Unique Visitors" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Feature Usage Trend (Daily)">
            <ResponsiveContainer>
              <LineChart data={featureTrendData?.daily || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="smartSearch" stroke="#1E88E5" strokeWidth={2} dot={false} name="Smart Search" />
                <Line type="monotone" dataKey="hybridSearch" stroke="#F4511E" strokeWidth={2} dot={false} name="Hybrid Search" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Feature Usage Totals">
            <ResponsiveContainer>
              <BarChart data={featureData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="feature" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#1565C0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <ChartCard title="Monthly Unique Visitors">
            <ResponsiveContainer>
              <LineChart data={data?.monthlyUniqueVisitors || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="uniqueVisitors" stroke="#00695C" strokeWidth={2} dot={false} name="Monthly Unique Visitors" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default InsightsPage;
