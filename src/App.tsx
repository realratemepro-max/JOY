import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingSpinner } from './components/LoadingSpinner';
import { getSiteConfig } from './services/siteConfig';
import { AdminLayout } from './components/AdminLayout';
import { ClientLayout } from './components/ClientLayout';
import { CookieBanner } from './components/CookieBanner';
import { ToastProvider } from './components/ToastProvider';

// Public Pages
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Checkout } from './pages/Checkout';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { PaymentFailed } from './pages/PaymentFailed';
import { PaymentMultibanco } from './pages/PaymentMultibanco';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';

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
import { AdminEvents } from './pages/admin/AdminEvents';
import { AdminProfessors } from './pages/admin/AdminProfessors';
import { AdminPromoCodes } from './pages/admin/AdminPromoCodes';
import { AdminPurchases } from './pages/admin/AdminPurchases';
import { AdminNotifications } from './pages/admin/AdminNotifications';
import { AdminBookingRequests } from './pages/admin/AdminBookingRequests';
import { AdminContent } from './pages/admin/AdminContent';
import { AdminChat } from './pages/admin/AdminChat';
import { AdminGiftCards } from './pages/admin/AdminGiftCards';
import { AdminReferrals } from './pages/admin/AdminReferrals';
import { BuyGiftCard } from './pages/BuyGiftCard';
import { AuthAction } from './pages/AuthAction';
import { ProfessorLayout } from './components/ProfessorLayout';
import { ProfessorDashboard } from './pages/professor/ProfessorDashboard';
import { ProfessorSessions } from './pages/professor/ProfessorSessions';
import { ProfessorChat } from './pages/professor/ProfessorChat';
import { ProfessorProfile } from './pages/professor/ProfessorProfile';
import { ProfessorEarnings } from './pages/professor/ProfessorEarnings';
import { ProfessorAgenda } from './pages/professor/ProfessorAgenda';
import { ProfessorLocations } from './pages/professor/ProfessorLocations';
import { ProfessorFinanceiro } from './pages/professor/ProfessorFinanceiro';

// Client Portal Pages
import { ClientDashboard } from './pages/app/ClientDashboard';
import { ClientPlan } from './pages/app/ClientPlan';
import { ClientSessions } from './pages/app/ClientSessions';
import { ClientAchievements } from './pages/app/ClientAchievements';
import { ClientPayments } from './pages/app/ClientPayments';
import { ClientProfile } from './pages/app/ClientProfile';
import { ClientEvents } from './pages/app/ClientEvents';
import { PrivateBookingRequest } from './pages/app/PrivateBookingRequest';
import { ClientLibrary } from './pages/app/ClientLibrary';
import { ClientChat } from './pages/app/ClientChat';

// Route Guards
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isProfessor, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isProfessor) return <Navigate to="/professor" replace />;
  return <ClientLayout>{children}</ClientLayout>;
}

function ProfessorRoute({ children }: { children: React.ReactNode }) {
  const { user, isProfessor, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isProfessor) return <Navigate to="/" replace />;
  return <ProfessorLayout>{children}</ProfessorLayout>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isClient, isProfessor, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  if (loading) return <LoadingSpinner fullPage />;
  // After login: if a ?next= param is set, prefer it (only for clients — admin/professor stay in their portals)
  if (user && next && isClient) {
    // Defensive: only allow internal paths (starting with /)
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app';
    return <Navigate to={safeNext} replace />;
  }
  if (user && isAdmin) return <Navigate to="/admin" replace />;
  if (user && isProfessor) return <Navigate to="/professor" replace />;
  if (user && isClient) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function BrandLoader() {
  useEffect(() => {
    getSiteConfig().then(cfg => {
      if (cfg.favicon) {
        const link: HTMLLinkElement = document.querySelector("link[rel~='icon']") || (() => {
          const el = document.createElement('link');
          el.rel = 'icon';
          document.head.appendChild(el);
          return el;
        })();
        link.href = cfg.favicon;
      }
      const root = document.documentElement;
      if (cfg.primaryColor) {
        root.style.setProperty('--primary', cfg.primaryColor);
        root.style.setProperty('--primary-dark', adjustColor(cfg.primaryColor, -30));
        root.style.setProperty('--primary-light', adjustColor(cfg.primaryColor, 40));
      }
      if (cfg.secondaryColor) {
        root.style.setProperty('--secondary', cfg.secondaryColor);
        root.style.setProperty('--secondary-dark', adjustColor(cfg.secondaryColor, -30));
        root.style.setProperty('--secondary-light', adjustColor(cfg.secondaryColor, 40));
      }
      if (cfg.accentColor) {
        root.style.setProperty('--accent', cfg.accentColor);
        root.style.setProperty('--accent-dark', adjustColor(cfg.accentColor, -30));
        root.style.setProperty('--accent-light', adjustColor(cfg.accentColor, 40));
      }
    });
  }, []);
  return null;
}

function adjustColor(hex: string, amount: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${[r, g, b].map(c => clamp(c + amount).toString(16).padStart(2, '0')).join('')}`;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/buy-gift-card" element={<BuyGiftCard />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-failed" element={<PaymentFailed />} />
      <Route path="/privacidade" element={<Privacy />} />
      <Route path="/termos" element={<Terms />} />
      <Route path="/payment-multibanco" element={<PaymentMultibanco />} />

      {/* Firebase auth actions (password reset, email verify) */}
      <Route path="/auth-action" element={<AuthAction />} />

      {/* Auth */}
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

      {/* Client Portal */}
      <Route path="/app" element={<ClientRoute><ClientDashboard /></ClientRoute>} />
      <Route path="/app/plan" element={<ClientRoute><ClientPlan /></ClientRoute>} />
      <Route path="/app/sessions" element={<ClientRoute><ClientSessions /></ClientRoute>} />
      <Route path="/app/conquistas" element={<ClientRoute><ClientAchievements /></ClientRoute>} />
      <Route path="/app/payments" element={<ClientRoute><ClientPayments /></ClientRoute>} />
      <Route path="/app/profile" element={<ClientRoute><ClientProfile /></ClientRoute>} />
      <Route path="/app/events" element={<ClientRoute><ClientEvents /></ClientRoute>} />
      <Route path="/app/booking-request" element={<ClientRoute><PrivateBookingRequest /></ClientRoute>} />
      <Route path="/app/library" element={<ClientRoute><ClientLibrary /></ClientRoute>} />
      <Route path="/app/chat" element={<ClientRoute><ClientChat /></ClientRoute>} />

      {/* Professor Portal */}
      <Route path="/professor" element={<ProfessorRoute><ProfessorDashboard /></ProfessorRoute>} />
      <Route path="/professor/sessions" element={<ProfessorRoute><ProfessorSessions /></ProfessorRoute>} />
      <Route path="/professor/chat" element={<ProfessorRoute><ProfessorChat /></ProfessorRoute>} />
      <Route path="/professor/profile" element={<ProfessorRoute><ProfessorProfile /></ProfessorRoute>} />
      <Route path="/professor/earnings" element={<ProfessorRoute><ProfessorEarnings /></ProfessorRoute>} />
      <Route path="/professor/agenda" element={<ProfessorRoute><ProfessorAgenda /></ProfessorRoute>} />
      <Route path="/professor/locations" element={<ProfessorRoute><ProfessorLocations /></ProfessorRoute>} />
      <Route path="/professor/financeiro" element={<ProfessorRoute><ProfessorFinanceiro /></ProfessorRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/locations" element={<AdminRoute><AdminLocations /></AdminRoute>} />
      <Route path="/admin/professors" element={<AdminRoute><AdminProfessors /></AdminRoute>} />
      <Route path="/admin/plans" element={<AdminRoute><AdminPlans /></AdminRoute>} />
      <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
      <Route path="/admin/sessions" element={<AdminRoute><AdminSessions /></AdminRoute>} />
      <Route path="/admin/services" element={<AdminRoute><AdminServices /></AdminRoute>} />
      <Route path="/admin/clients" element={<AdminRoute><AdminClients /></AdminRoute>} />
      <Route path="/admin/purchases" element={<AdminRoute><AdminPurchases /></AdminRoute>} />
      <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
      <Route path="/admin/promocodes" element={<AdminRoute><AdminPromoCodes /></AdminRoute>} />
      <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
      <Route path="/admin/site-settings" element={<AdminRoute><AdminSiteSettings /></AdminRoute>} />
      <Route path="/admin/testimonials" element={<AdminRoute><AdminTestimonials /></AdminRoute>} />
      <Route path="/admin/events" element={<AdminRoute><AdminEvents /></AdminRoute>} />
      <Route path="/admin/booking-requests" element={<AdminRoute><AdminBookingRequests /></AdminRoute>} />
      <Route path="/admin/content" element={<AdminRoute><AdminContent /></AdminRoute>} />
      <Route path="/admin/chat" element={<AdminRoute><AdminChat /></AdminRoute>} />
      <Route path="/admin/gift-cards" element={<AdminRoute><AdminGiftCards /></AdminRoute>} />
      <Route path="/admin/referrals" element={<AdminRoute><AdminReferrals /></AdminRoute>} />

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
      <BrandLoader />
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <CookieBanner />
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
