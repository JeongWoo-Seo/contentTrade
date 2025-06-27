import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children }) {
  const isLogin = sessionStorage.getItem("isLogin") === "true";

  return isLogin ? children : <Navigate to="/login" replace />;
}
