import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth, useCan } from "./context/AuthContext";
import { SHOW_ASSISTANT } from "./lib/flags";
import { startPage } from "./lib/startPage";
import Invoices from "./pages/Invoices";
import { SubscriptionProvider } from "./context/SubscriptionContext";

// Layout
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";

// Each screen's code is fetched when it is first opened, so the first visit
// downloads only what it shows
const Team = lazy(() => import("./pages/Team"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Login = lazy(() => import("./pages/Login"));
const Landing = lazy(() => import("./pages/Landing"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const Attendance = lazy(() => import("./pages/Attendance"));
const TryInvoice = lazy(() => import("./pages/TryInvoice"));
const Register = lazy(() => import("./pages/Register"));
const Overview = lazy(() => import("./pages/Overview"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Products = lazy(() => import("./pages/Products"));
const Ledger = lazy(() => import("./pages/Ledger"));
const Quotations = lazy(() => import("./pages/Quotations"));
const Stock = lazy(() => import("./pages/Stock"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Reports = lazy(() => import("./pages/Reports"));
const CreateInvoice = lazy(() => import("./pages/CreateInvoice"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const Purchases = lazy(() => import("./pages/Purchases"));
const CreatePurchase = lazy(() => import("./pages/CreatePurchase"));
const Settings = lazy(() => import("./pages/Settings"));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <Spinner className="h-10 w-10" />
  </div>
);

// ─── Protected Route wrapper ──────────────────────────────────────────────────
// Redirects to /login if user is not authenticated
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

// ─── Public Route wrapper ─────────────────────────────────────────────────────
// Redirects into the app if already logged in
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return !user ? children : <Navigate to={startPage(user)} replace />;
}

// Sends a login that may not use a screen back to the overview
function Allow({ ability, children }) {
  const can = useCan();
  return can(ability) ? children : <Navigate to="/dashboard" replace />;
}

// Visitors see the home page; signed-in users go straight to a new invoice
function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={startPage(user)} replace /> : <Landing />;
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <BrowserRouter>
          {/* Toast notifications */}
          <Toaster
            position="bottom-center"
            containerStyle={{ bottom: 88 }}
            toastOptions={{
              duration: 3000,
              style: {
                background: "#0e1431",
                color: "#f6f8fd",
                borderRadius: "12px",
                fontSize: "14px",
              },
              success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
              error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
            }}
          />

          <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public routes — redirect to dashboard if logged in */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />

            <Route path="/" element={<Home />} />
            {/* One free bill, with or without an account */}
            <Route path="/try" element={<TryInvoice />} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            {/* Opened from an email, so it works whether or not someone is signed in */}
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes — all wrapped in Layout (sidebar + navbar) */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {SHOW_ASSISTANT && <Route path="assistant" element={<AssistantPage />} />}
              <Route path="attendance" element={<Allow ability="workers"><Attendance /></Allow>} />
              <Route path="/pricing" element={<Allow ability="plans"><Pricing /></Allow>} />
              <Route path="dashboard" element={<Overview />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="buyers" element={<Contacts key="buyers" kind="buyers" />} />
              <Route path="buyers/:id" element={<Ledger key="buyer" kind="buyer" />} />
              <Route path="items" element={<Products />} />
              <Route path="stock" element={<Allow ability="stock"><Stock /></Allow>} />
              <Route path="expenses" element={<Allow ability="expenses"><Expenses /></Allow>} />
              <Route path="reports" element={<Allow ability="reports"><Reports /></Allow>} />
              <Route path="quotations" element={<Quotations />} />
              <Route path="quotations/create" element={<Allow ability="createQuotation"><CreateInvoice /></Allow>} />
              <Route path="quotations/:id/edit" element={<Allow ability="createQuotation"><CreateInvoice /></Allow>} />
              <Route path="invoices/:id/edit" element={<Allow ability="editInvoice"><CreateInvoice /></Allow>} />
              <Route path="invoices/create" element={<Allow ability="createInvoice"><CreateInvoice /></Allow>} />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="purchases" element={<Allow ability="purchases"><Purchases /></Allow>} />
              <Route path="purchases/create" element={<Allow ability="editPurchases"><CreatePurchase /></Allow>} />
              <Route path="sellers" element={<Allow ability="sellers"><Contacts key="sellers" kind="sellers" /></Allow>} />
              <Route path="sellers/:id" element={<Allow ability="sellers"><Ledger key="seller" kind="seller" /></Allow>} />
              <Route path="settings" element={<Settings />} />
              <Route path="team" element={<Allow ability="team"><Team /></Allow>} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
