import ProtectedRoute from "./components/ProtectedRoute";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DonorLayout from "./pages/donor/DonorLayout";
import DonorDashboard from "./pages/donor/DonorDashboard";
import IncomingRequests from "./pages/donor/IncomingRequests";
import MyProfile from "./pages/donor/MyProfile";
import DonationHistory from "./pages/donor/DonationHistory";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/donor" element={<ProtectedRoute role="donor"><DonorLayout /></ProtectedRoute>}>
          <Route index element={<DonorDashboard />} />
          <Route path="requests" element={<IncomingRequests />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="history" element={<DonationHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}