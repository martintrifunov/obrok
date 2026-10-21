import useAuth from "@/features/auth/hooks/useAuth";
import { Navigate, Outlet, useLocation } from "react-router-dom";

const RequireAuth = () => {
  const { auth, isAdmin } = useAuth();
  const location = useLocation();

  if (!auth?.accessToken) return <Navigate to="/login" state={{ from: location }} replace />;
  // The dashboard is admin-only; other accounts go back to the map.
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
};

export default RequireAuth;
