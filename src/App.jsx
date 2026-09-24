import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import RequireAdmin from "./routes/RequireAdmin";
import RequireAuth from "./routes/RequireAuth";
import "./App.css";

const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const Browse = lazy(() => import("./pages/Browse"));
const MyListings = lazy(() => import("./pages/MyListings"));
const Account = lazy(() => import("./pages/Account"));
const BankCatalog = lazy(() => import("./pages/BankCatalog"));
const CreateListing = lazy(() => import("./pages/CreateListing"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const EditListing = lazy(() => import("./pages/EditListing"));
const BookingRequest = lazy(() => import("./pages/BookingRequest"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const BookingRequests = lazy(() => import("./pages/BookingRequests"));
const ManageBookingRequests = lazy(() => import("./pages/ManageBookingRequests"));
const RatingForm = lazy(() => import("./pages/RatingForm"));
const RaiseDispute = lazy(() => import("./pages/RaiseDispute"));
const BankPropertyDetail = lazy(() => import("./pages/BankPropertyDetail"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const SavedSearches = lazy(() => import("./pages/SavedSearches"));
const AdminLayout = lazy(() => import("./admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));
const AdminListings = lazy(() => import("./admin/AdminListings"));
const AdminDisputes = lazy(() => import("./admin/AdminDisputes"));
const AdminUsers = lazy(() => import("./admin/AdminUsers"));
const AdminBankCatalog = lazy(() => import("./admin/AdminBankCatalog"));

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  const location = useLocation();
  return <Suspense fallback={<LoadingState />}>
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
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
        <Route path="/manage-bookings" element={<RequireAuth><ManageBookingRequests /></RequireAuth>} />
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
    </AnimatePresence>
  </Suspense>;
}

function LoadingState() {
  return (
    <main className="app-loading" aria-live="polite" aria-busy="true">
      Loading TrustHome...
    </main>
  );
}

export default App;
