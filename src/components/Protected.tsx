import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function Protected({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}
