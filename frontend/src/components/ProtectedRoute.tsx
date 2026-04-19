import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

export function ProtectedRoute({
  children,
  requireAdmin,
  requirePaid,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePaid?: boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (requireAdmin && !user.is_admin) return <Navigate to="/" replace />;
  if (requirePaid && !user.is_paid && !user.is_admin)
    return <Navigate to="/subscribe" replace />;

  return <>{children}</>;
}
