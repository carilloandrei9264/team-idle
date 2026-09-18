import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import MyListings from "./pages/MyListings";
import Account from "./pages/Account";
import BankCatalog from "./pages/BankCatalog";
import CreateListing from "./pages/CreateListing";
import ListingDetail from "./pages/ListingDetail";
import EditListing from "./pages/EditListing";
import BookingRequest from "./pages/BookingRequest";
import MyBookings from "./pages/MyBookings";
import BookingRequests from "./pages/BookingRequests";
import RatingForm from "./pages/RatingForm";
import RaiseDispute from "./pages/RaiseDispute";
import BankPropertyDetail from "./pages/BankPropertyDetail";
import PublicProfile from "./pages/PublicProfile";
import SavedSearches from "./pages/SavedSearches";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminListings from "./admin/AdminListings";
import AdminDisputes from "./admin/AdminDisputes";
import AdminUsers from "./admin/AdminUsers";
import AdminBankCatalog from "./admin/AdminBankCatalog";
import RequireAdmin from "./routes/RequireAdmin";
import RequireAuth from "./routes/RequireAuth";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/bank-catalog" element={<BankCatalog />} />
        <Route path="/login" element={<Login />} />
        <Route path="/my-listings" element={<RequireAuth><MyListings /></RequireAuth>} />
        <Route path="/listings/new" element={<RequireAuth><CreateListing /></RequireAuth>} />
        <Route path="/listings/:listingId" element={<ListingDetail />} />
        <Route path="/listings/:listingId/edit" element={<RequireAuth><EditListing /></RequireAuth>} />
        <Route path="/listings/:listingId/book" element={<RequireAuth><BookingRequest /></RequireAuth>} />
        <Route path="/my-bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
        <Route path="/booking-requests" element={<RequireAuth><BookingRequests /></RequireAuth>} />
        <Route path="/bookings/:bookingId/review" element={<RequireAuth><RatingForm /></RequireAuth>} />
        <Route path="/bookings/:bookingId/dispute" element={<RequireAuth><RaiseDispute /></RequireAuth>} />
          <Route path="/bank-catalog/:propertyId" element={<BankPropertyDetail />} />
          <Route path="/profiles/:userId" element={<PublicProfile />} />
          <Route path="/saved-searches" element={<RequireAuth><SavedSearches /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
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

export default App;
