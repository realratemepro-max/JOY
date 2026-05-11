import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Settings, Package, Users, CreditCard,
  MessageSquare, LogOut, Menu, X, ChevronRight, MapPin,
  CalendarDays, ClipboardList, UserCheck, Tag, ShoppingBag, Bell, CalendarPlus, Library, MessageCircle,
  ChevronLeft, Gift, Share2,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sb-admin-collapsed') === 'true');

  useEffect(() => { localStorage.setItem('sb-admin-collapsed', String(collapsed)); }, [collapsed]);

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/locations', icon: MapPin, label: 'Espaços' },
    { path: '/admin/professors', icon: UserCheck, label: 'Professores' },
    { path: '/admin/plans', icon: Package, label: 'Planos' },
    { path: '/admin/sessions', icon: CalendarDays, label: 'Aulas' },
    { path: '/admin/booking-requests', icon: CalendarPlus, label: 'Aulas Privadas' },
    { path: '/admin/clients', icon: Users, label: 'Clientes' },
    { path: '/admin/purchases', icon: ShoppingBag, label: 'Compras' },
    { path: '/admin/payments', icon: CreditCard, label: 'Pagamentos' },
    { path: '/admin/promocodes', icon: Tag, label: 'Códigos Promo' },
    { path: '/admin/gift-cards', icon: Gift, label: 'Vales Oferta' },
    { path: '/admin/referrals', icon: Share2, label: 'Referências' },
    { path: '/admin/events', icon: CalendarDays, label: 'Eventos' },
    { path: '/admin/content', icon: Library, label: 'Biblioteca' },
    { path: '/admin/notifications', icon: Bell, label: 'Notificações' },
    { path: '/admin/site-settings', icon: Settings, label: 'Site / Conteúdo' },
    { path: '/admin/chat', icon: MessageCircle, label: 'Mensagens' },
    { path: '/admin/testimonials', icon: MessageSquare, label: 'Testemunhos' },
  ];

  const handleLogout = async () => { await logout(); navigate('/'); };

  const handleToggle = () => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(true);
    } else {
      setCollapsed(c => !c);
    }
  };

  return (
    <div className={`al-layout${collapsed ? ' al-collapsed' : ''}`}>
      <aside className={`al-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="al-sidebar-header">
          <Link to="/admin" className="al-logo" onClick={() => setSidebarOpen(false)}>
            <span className="al-logo-text">JOY</span>
            <span className="al-logo-sub">Backoffice</span>
          </Link>
          <button className="al-collapse-btn al-desktop-only" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expandir' : 'Colapsar'}>
            <ChevronLeft size={16} style={{ transition: 'transform 0.25s', transform: collapsed ? 'rotate(180deg)' : 'none' }} />
          </button>
          <button className="al-close-btn al-mobile-only" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="al-nav">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`al-link${location.pathname === item.path ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              title={item.label}
            >
              <item.icon size={18} className="al-link-icon" />
              <span className="al-link-label">{item.label}</span>
              {location.pathname === item.path && <ChevronRight size={14} className="al-active-chevron" />}
            </Link>
          ))}
        </nav>

        <div className="al-sidebar-footer">
          <Link to="/" className="al-link" target="_blank" title="Ver Site">
            <Settings size={18} className="al-link-icon" />
            <span className="al-link-label">Ver Site</span>
          </Link>
          <button className="al-link al-logout" onClick={handleLogout} title="Sair">
            <LogOut size={18} className="al-link-icon" />
            <span className="al-link-label">Sair</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="al-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="al-main">
        <header className="al-topbar">
          <button className="al-menu-btn" onClick={handleToggle} aria-label="Toggle sidebar">
            <Menu size={20} />
          </button>
          <h1 className="al-page-title">
            {menuItems.find(m => m.path === location.pathname)?.label || 'Backoffice'}
          </h1>
        </header>
        <div className="al-content">{children}</div>
      </main>

      <style>{`
        /* ── Layout shell ── */
        .al-layout {
          display: flex;
          min-height: 100vh;
          background: var(--bg-secondary);
        }

        /* ── Sidebar ── */
        .al-sidebar {
          width: 260px;
          background: white;
          border-right: 1px solid var(--sand);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 200;
          transition: width 0.25s ease, transform 0.25s ease;
          overflow: hidden;
        }

        .al-sidebar-header {
          padding: 1.25rem 1rem;
          border-bottom: 1px solid var(--beige);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-height: 64px;
        }

        .al-logo {
          text-decoration: none;
          display: flex;
          flex-direction: column;
          line-height: 1;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .al-logo-text {
          font-family: var(--font-heading);
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--primary-dark);
          letter-spacing: 0.1em;
          white-space: nowrap;
        }

        .al-logo-sub {
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--text-muted);
          margin-top: 2px;
          white-space: nowrap;
          transition: opacity 0.2s, height 0.2s;
        }

        .al-collapse-btn, .al-close-btn {
          background: none;
          border: 1px solid var(--sand);
          border-radius: var(--radius-md);
          padding: 0.375rem;
          cursor: pointer;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s;
        }

        .al-collapse-btn:hover, .al-close-btn:hover {
          background: var(--bg-secondary);
        }

        .al-nav {
          flex: 1;
          padding: 0.75rem 0.625rem;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .al-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          color: var(--text-secondary);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
          background: none;
          border: none;
          cursor: pointer;
          width: 100%;
          text-align: left;
          font-family: var(--font-body);
          white-space: nowrap;
          min-width: 0;
        }

        .al-link:hover { background: var(--bg-secondary); color: var(--text-primary); }
        .al-link.active { background: rgba(124,154,114,0.12); color: var(--primary-dark); font-weight: 500; }

        .al-link-icon { flex-shrink: 0; }
        .al-link-label { flex: 1; overflow: hidden; text-overflow: ellipsis; transition: opacity 0.2s; }
        .al-active-chevron { margin-left: auto; color: var(--primary); flex-shrink: 0; }

        .al-sidebar-footer {
          padding: 0.625rem;
          border-top: 1px solid var(--beige);
        }

        .al-logout:hover { color: var(--error) !important; }

        .al-overlay { display: none; }

        /* ── Main ── */
        .al-main {
          flex: 1;
          margin-left: 260px;
          min-height: 100vh;
          min-width: 0;
          transition: margin-left 0.25s ease;
          display: flex;
          flex-direction: column;
        }

        .al-topbar {
          background: white;
          border-bottom: 1px solid var(--sand);
          padding: 0 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.875rem;
          position: sticky;
          top: 0;
          z-index: 100;
          height: 64px;
          flex-shrink: 0;
        }

        .al-menu-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid var(--sand);
          border-radius: var(--radius-md);
          padding: 0.45rem;
          cursor: pointer;
          color: var(--text-primary);
          flex-shrink: 0;
          transition: background 0.15s;
        }

        .al-menu-btn:hover { background: var(--bg-secondary); }

        .al-page-title {
          font-family: var(--font-body);
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .al-content {
          padding: 1.5rem;
          flex: 1;
          min-width: 0;
          overflow-x: auto;
        }

        /* ── Desktop collapsed state ── */
        @media (min-width: 769px) {
          .al-layout.al-collapsed .al-sidebar { width: 64px; }
          .al-layout.al-collapsed .al-main { margin-left: 64px; }
          .al-layout.al-collapsed .al-link { justify-content: center; padding: 0.5rem; }
          .al-layout.al-collapsed .al-link-label { display: none; }
          .al-layout.al-collapsed .al-active-chevron { display: none; }
          .al-layout.al-collapsed .al-logo { align-items: center; }
          .al-layout.al-collapsed .al-logo-text { font-size: 1rem; }
          .al-layout.al-collapsed .al-logo-sub { display: none; }
          .al-layout.al-collapsed .al-sidebar-header { justify-content: space-between; padding: 1.25rem 0.75rem; }
        }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .al-sidebar {
            transform: translateX(-100%);
            width: 260px !important;
          }
          .al-sidebar.open { transform: translateX(0); }
          .al-link-label { display: flex !important; opacity: 1 !important; }
          .al-link { justify-content: flex-start !important; padding: 0.5rem 0.75rem !important; }
          .al-logo-sub { display: block !important; }
          .al-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 199;
          }
          .al-main { margin-left: 0 !important; }
          .al-content { padding: 1rem; }
          .al-desktop-only { display: none !important; }
          .al-mobile-only { display: flex !important; }
        }

        @media (min-width: 769px) {
          .al-mobile-only { display: none !important; }
          .al-desktop-only { display: flex !important; }
        }

        /* ── Scrollable table wrapper ── */
        .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      `}</style>
    </div>
  );
}
