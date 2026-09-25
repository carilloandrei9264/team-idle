import { Fragment, lazy, Suspense } from "react";
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
      <BrandLoader />
    </main>
  );
}

// Small skyline that builds itself up (house → mid-rise → tower), on loop,
// while a lazy-loaded page or bundle is still downloading.
function BrandLoader() {
  return (
    <div className="app-loading__box">
      <svg
        className="app-loading__skyline"
        viewBox="0 0 200 120"
        width="140"
        height="84"
        aria-hidden="true"
      >
        <line x1="6" y1="104" x2="194" y2="104" className="app-loading__ground" />

        {/* House — rises first */}
        <g className="app-loading__building app-loading__building--a">
          <path d="M26 64 L46 44 L66 64 Z" />
          <rect x="30" y="64" width="32" height="40" rx="2" />
          <rect className="app-loading__window" x="36" y="73" width="6" height="6" />
          <rect className="app-loading__window" x="50" y="73" width="6" height="6" />
          <rect className="app-loading__door" x="42" y="86" width="8" height="18" />
        </g>

        {/* Mid-rise — rises second */}
        <g className="app-loading__building app-loading__building--b">
          <rect x="83" y="40" width="34" height="64" rx="2" />
          <rect className="app-loading__window" x="90" y="50" width="6" height="6" />
          <rect className="app-loading__window" x="104" y="50" width="6" height="6" />
          <rect className="app-loading__window" x="90" y="64" width="6" height="6" />
          <rect className="app-loading__window" x="104" y="64" width="6" height="6" />
          <rect className="app-loading__window" x="90" y="78" width="6" height="6" />
          <rect className="app-loading__window" x="104" y="78" width="6" height="6" />
        </g>

        {/* Tower — rises last, completing the skyline */}
        <g className="app-loading__building app-loading__building--c">
          <rect x="157" y="10" width="4" height="8" />
          <rect x="144" y="16" width="32" height="88" rx="2" />
          {[26, 40, 54, 68, 82].map((y) => (
            <Fragment key={y}>
              <rect className="app-loading__window" x="150" y={y} width="6" height="6" />
              <rect className="app-loading__window" x="164" y={y} width="6" height="6" />
            </Fragment>
          ))}
        </g>
      </svg>

      <p className="app-loading__brand">
        <span className="app-loading__brand-accent">Trust</span>Home
      </p>
      <p className="app-loading__caption">
        Loading
        <span className="app-loading__dots" aria-hidden="true"><span /><span /><span /></span>
      </p>
    </div>
  );
}

export default App;