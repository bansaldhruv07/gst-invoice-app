import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Pricing from "./pages/Pricing";
// Pages
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import AssistantPage from "./pages/AssistantPage";
import Register from "./pages/Register";
import Overview from "./pages/Overview";
import Invoices from "./pages/Invoices";
import Contacts from "./pages/Contacts";
import Products from "./pages/Products";
import Ledger from "./pages/Ledger";
import Quotations from "./pages/Quotations";
import Stock from "./pages/Stock";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import CreateInvoice from "./pages/CreateInvoice";
import InvoiceDetail from "./pages/InvoiceDetail";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import Purchases from "./pages/Purchases";
import CreatePurchase from "./pages/CreatePurchase";
import Settings from "./pages/Settings";

// Layout
import Layout from "./components/Layout";

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
// Redirects to /dashboard if already logged in
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return !user ? children : <Navigate to="/dashboard" replace />;
}

// Visitors see the home page; signed-in users go straight to their overview
function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <BrowserRouter>
          {/* Toast notifications */}
          <Toaster
            position="bottom-center"
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

            {/* Protected routes — all wrapped in Layout (sidebar + navbar) */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="dashboard" element={<Overview />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="buyers" element={<Contacts key="buyers" kind="buyers" />} />
              <Route path="buyers/:id" element={<Ledger key="buyer" kind="buyer" />} />
              <Route path="items" element={<Products />} />
              <Route path="stock" element={<Stock />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="reports" element={<Reports />} />
              <Route path="quotations" element={<Quotations />} />
              <Route path="quotations/create" element={<CreateInvoice />} />
              <Route path="quotations/:id/edit" element={<CreateInvoice />} />
              <Route path="invoices/:id/edit" element={<CreateInvoice />} />
              <Route path="invoices/create" element={<CreateInvoice />} />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="purchases" element={<Purchases />} />
              <Route path="purchases/create" element={<CreatePurchase />} />
              <Route path="sellers" element={<Contacts key="sellers" kind="sellers" />} />
              <Route path="sellers/:id" element={<Ledger key="seller" kind="seller" />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
