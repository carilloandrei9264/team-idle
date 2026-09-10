import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminListings from "./admin/AdminListings";
import AdminDisputes from "./admin/AdminDisputes";
import AdminUsers from "./admin/AdminUsers";
import AdminBankCatalog from "./admin/AdminBankCatalog";
import RequireAdmin from "./routes/RequireAdmin";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserHome />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="disputes" element={<AdminDisputes />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="bank-catalog" element={<AdminBankCatalog />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function UserHome() {
  return (
    <main className="user-home">
      <h1>Welcome to TrustHome</h1>
      <p>Your account is ready. Property browsing and bookings will appear here.</p>
    </main>
  );
}

export default App;
