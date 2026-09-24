import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import NotFound from "@/components/layout/NotFound";
import Login from "@/features/auth/pages/Login";
import Dashboard from "@/features/dashboard/pages/Dashboard";
import RequireAuth from "@/features/auth/components/RequireAuth";
import AddOrEditProductForm from "@/features/products/pages/AddOrEditProductForm";
import Layout from "@/components/layout/Layout";
import DashboardLayout from "@/features/dashboard/components/DashboardLayout";
import PersistLogin from "@/features/auth/components/PersistLogin";
import AddOrEditChainForm from "@/features/chains/pages/AddOrEditChainForm";
import AddOrEditMarketForm from "@/features/markets/pages/AddOrEditMarketForm";
import AddOrEditHolidayForm from "@/features/public-holidays/pages/AddOrEditHolidayForm";
import ChainsPage from "@/features/dashboard/pages/ChainsPage";
import MarketsPage from "@/features/dashboard/pages/MarketsPage";
import ProductsPage from "@/features/dashboard/pages/ProductsPage";
import HolidaysPage from "@/features/dashboard/pages/HolidaysPage";
import ReportingPage from "@/features/dashboard/pages/ReportingPage";
import MapPage from "@/features/map/pages/MapPage";
import FeatureFlagsPage from "@/features/feature-flags/pages/FeatureFlagsPage";
import InsightsPage from "@/features/insights/pages/InsightsPage";
import useVisitorHeartbeat from "@/features/insights/hooks/useVisitorHeartbeat";
import { useFeatureFlagStore } from "@/store/featureFlagStore";

const App = () => {
  const fetchFlags = useFeatureFlagStore((state) => state.fetchFlags);
  useVisitorHeartbeat();
  useEffect(() => { fetchFlags(); }, [fetchFlags]);
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route element={<PersistLogin />}>
          <Route path="/" element={<MapPage />} />
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/chains" element={<ChainsPage />} />
              <Route path="/dashboard/markets" element={<MarketsPage />} />
              <Route path="/dashboard/products" element={<ProductsPage />} />
              <Route path="/dashboard/holidays" element={<HolidaysPage />} />
              <Route path="/dashboard/reporting" element={<ReportingPage />} />
              <Route path="/dashboard/insights" element={<InsightsPage />} />
              <Route
                path="/dashboard/features"
                element={<FeatureFlagsPage />}
              />
              <Route
                path="/dashboard/product/:productId"
                element={<AddOrEditProductForm />}
              />
              <Route
                path="/dashboard/product"
                element={<AddOrEditProductForm />}
              />
              <Route
                path="/dashboard/chain/:chainId"
                element={<AddOrEditChainForm />}
              />
              <Route
                path="/dashboard/chain"
                element={<AddOrEditChainForm />}
              />
              <Route
                path="/dashboard/market/:marketId"
                element={<AddOrEditMarketForm />}
              />
              <Route
                path="/dashboard/market"
                element={<AddOrEditMarketForm />}
              />
              <Route
                path="/dashboard/holiday/:holidayId"
                element={<AddOrEditHolidayForm />}
              />
              <Route
                path="/dashboard/holiday"
                element={<AddOrEditHolidayForm />}
              />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default App;
