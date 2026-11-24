import ProtectedRoute from "./components/ProtectedRoute";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/PasswordPages";
import { GuidelinesPage, PrivacyPage, TermsPage } from "./pages/InfoPages";
import DonorLayout from "./pages/donor/DonorLayout";
import DonorDashboard from "./pages/donor/DonorDashboard";
import IncomingRequests from "./pages/donor/IncomingRequests";
import MyProfile from "./pages/donor/MyProfile";
import DonationHistory from "./pages/donor/DonationHistory";
import HospitalLayout from "./pages/hospital/HospitalLayout";
import HospitalDashboard from "./pages/hospital/HospitalDashboard";
import CreateRequest from "./pages/hospital/CreateRequest";
import MyRequests from "./pages/hospital/MyRequests";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHospitals from "./pages/admin/AdminHospitals";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/guidelines" element={<GuidelinesPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        <Route path="/donor" element={<ProtectedRoute role="donor"><DonorLayout /></ProtectedRoute>}>
          <Route index element={<DonorDashboard />} />
          <Route path="requests" element={<IncomingRequests />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="history" element={<DonationHistory />} />
        </Route>

        <Route path="/hospital" element={<ProtectedRoute role="hospital"><HospitalLayout /></ProtectedRoute>}>
          <Route index element={<HospitalDashboard />} />
          <Route path="requests" element={<MyRequests />} />
          <Route path="requests/new" element={<CreateRequest />} />
        </Route>

        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminHospitals />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}