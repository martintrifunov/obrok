import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Box, Container, Tabs, Tab, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DashboardHeader from "@/features/dashboard/components/DashboardHeader";
import LinkIcon from "@mui/icons-material/Link";
import StorefrontIcon from "@mui/icons-material/Storefront";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import EventIcon from "@mui/icons-material/Event";
import AssessmentIcon from "@mui/icons-material/Assessment";
import InsightsIcon from "@mui/icons-material/Insights";
import TuneIcon from "@mui/icons-material/Tune";

const SECTIONS = [
  { label: "Chains", path: "/dashboard/chains", prefix: "/dashboard/chain", icon: <LinkIcon /> },
  { label: "Markets", path: "/dashboard/markets", prefix: "/dashboard/market", icon: <StorefrontIcon /> },
  { label: "Products", path: "/dashboard/products", prefix: "/dashboard/product", icon: <Inventory2Icon /> },
  { label: "Holidays", path: "/dashboard/holidays", prefix: "/dashboard/holiday", icon: <EventIcon /> },
  { label: "Reports", path: "/dashboard/reporting", prefix: "/dashboard/reporting", icon: <AssessmentIcon /> },
  { label: "Insights", path: "/dashboard/insights", prefix: "/dashboard/insights", icon: <InsightsIcon /> },
  { label: "Features", path: "/dashboard/features", prefix: "/dashboard/features", icon: <TuneIcon /> },
];

const DashboardLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const activeTab = SECTIONS.findIndex((s) => pathname.startsWith(s.prefix));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <DashboardHeader />
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          backgroundColor: "background.paper",
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 } }}>
          <Tabs
            value={activeTab === -1 ? false : activeTab}
            onChange={(_, idx) => navigate(SECTIONS[idx].path)}
            variant={isMobile ? "fullWidth" : "standard"}
            centered={!isMobile}
            scrollButtons={isMobile ? false : "auto"}
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 500,
                minHeight: { xs: 44, sm: 48 },
                minWidth: { xs: 0, sm: 120 },
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
              },
            }}
          >
            {SECTIONS.map((s) => (
              <Tab
                key={s.path}
                label={isMobile ? undefined : s.label}
                icon={s.icon}
                iconPosition={isMobile ? "top" : "start"}
                aria-label={s.label}
              />
            ))}
          </Tabs>
        </Container>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          py: { xs: 2, md: 4 },
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 1.5, sm: 3 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
};

export default DashboardLayout;
