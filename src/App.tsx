import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AdminLayout } from './components/AdminLayout';
import { ClientLayout } from './components/ClientLayout';

// Public Pages
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Checkout } from './pages/Checkout';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { PaymentFailed } from './pages/PaymentFailed';
import { PaymentMultibanco } from './pages/PaymentMultibanco';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminSiteSettings } from './pages/admin/AdminSiteSettings';
import { AdminLocations } from './pages/admin/AdminLocations';
import { AdminPlans } from './pages/admin/AdminPlans';
import { AdminServices } from './pages/admin/AdminServices';
import { AdminClients } from './pages/admin/AdminClients';
import { AdminPayments } from './pages/admin/AdminPayments';
import { AdminTestimonials } from './pages/admin/AdminTestimonials';
import { AdminSubscriptions } from './pages/admin/AdminSubscriptions';
import { AdminSessions } from './pages/admin/AdminSessions';

// Client Portal Pages
import { ClientDashboard } from './pages/app/ClientDashboard';
import { ClientPlan } from './pages/app/ClientPlan';
import { ClientSessions } from './pages/app/ClientSessions';
import { ClientPayments } from './pages/app/ClientPayments';
import { ClientProfile } from './pages/app/ClientProfile';

// Route Guards
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <ClientLayout>{children}</ClientLayout>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isClient, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (user && isAdmin) return <Navigate to="/admin" replace />;
  if (user && isClient) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-failed" element={<PaymentFailed />} />
      <Route path="/payment-multibanco" element={<PaymentMultibanco />} />

      {/* Auth */}
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

      {/* Client Portal */}
      <Route path="/app" element={<ClientRoute><ClientDashboard /></ClientRoute>} />
      <Route path="/app/plan" element={<ClientRoute><ClientPlan /></ClientRoute>} />
      <Route path="/app/sessions" element={<ClientRoute><ClientSessions /></ClientRoute>} />
      <Route path="/app/payments" element={<ClientRoute><ClientPayments /></ClientRoute>} />
      <Route path="/app/profile" element={<ClientRoute><ClientProfile /></ClientRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/locations" element={<AdminRoute><AdminLocations /></AdminRoute>} />
      <Route path="/admin/plans" element={<AdminRoute><AdminPlans /></AdminRoute>} />
      <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
      <Route path="/admin/sessions" element={<AdminRoute><AdminSessions /></AdminRoute>} />
      <Route path="/admin/services" element={<AdminRoute><AdminServices /></AdminRoute>} />
      <Route path="/admin/clients" element={<AdminRoute><AdminClients /></AdminRoute>} />
      <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
      <Route path="/admin/site-settings" element={<AdminRoute><AdminSiteSettings /></AdminRoute>} />
      <Route path="/admin/testimonials" element={<AdminRoute><AdminTestimonials /></AdminRoute>} />

      {/* 404 */}
      <Route path="*" element={
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', background: 'var(--bg-secondary)' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '6rem', fontWeight: 300, color: 'var(--primary)', marginBottom: '1rem' }}>404</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Página não encontrada</p>
          <a href="/" className="btn btn-primary">Voltar ao Início</a>
        </div>
      } />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
