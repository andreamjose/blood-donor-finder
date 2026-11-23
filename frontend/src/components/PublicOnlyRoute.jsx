import { Navigate } from "react-router-dom";
import { getToken, getUser, homePathFor } from "../api/auth";

// Login and register pages: a logged-in user goes straight to their dashboard.
export default function PublicOnlyRoute({ children }) {
  const user = getUser();
  if (getToken() && user) return <Navigate to={homePathFor(user.role)} replace />;
  return children;
}