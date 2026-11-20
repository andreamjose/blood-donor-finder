import { Navigate } from "react-router-dom";
import { getToken, getUser } from "../api/auth";

// Only lets logged-in users (with the right role) see the page.
export default function ProtectedRoute({ role, children }) {
  const user = getUser();
  if (!getToken() || !user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/login" replace />;
  return children;
}
