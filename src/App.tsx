import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AdminLayout } from './components/AdminLayout';

// Public Pages
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
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

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (user && isAdmin) return <Navigate to="/admin" replace />;
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

      {/* Admin */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/locations" element={<AdminRoute><AdminLocations /></AdminRoute>} />
      <Route path="/admin/plans" element={<AdminRoute><AdminPlans /></AdminRoute>} />
      <Route path="/admin/subscriptions" element={<AdminRoute><div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}><h2>Subscrições</h2><p>Em desenvolvimento - Fase 3</p></div></AdminRoute>} />
      <Route path="/admin/sessions" element={<AdminRoute><div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}><h2>Sessões</h2><p>Em desenvolvimento - Fase 4</p></div></AdminRoute>} />
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
