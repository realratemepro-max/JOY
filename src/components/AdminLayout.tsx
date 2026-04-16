import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Settings, Package, Users, CreditCard,
  MessageSquare, LogOut, Menu, X, ChevronRight, MapPin,
  CalendarDays, ClipboardList
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/locations', icon: MapPin, label: 'Espaços' },
    { path: '/admin/plans', icon: Package, label: 'Planos' },
    { path: '/admin/subscriptions', icon: ClipboardList, label: 'Subscrições' },
    { path: '/admin/sessions', icon: CalendarDays, label: 'Sessões' },
    { path: '/admin/clients', icon: Users, label: 'Clientes' },
    { path: '/admin/payments', icon: CreditCard, label: 'Pagamentos' },
    { path: '/admin/site-settings', icon: Settings, label: 'Site / Conteúdo' },
    { path: '/admin/testimonials', icon: MessageSquare, label: 'Testemunhos' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/admin" className="sidebar-logo" onClick={() => setSidebarOpen(false)}>
            <span className="logo-text">JOY</span>
            <span className="logo-sub">Backoffice</span>
          </Link>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {location.pathname === item.path && <ChevronRight size={16} className="active-indicator" />}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/" className="sidebar-link" target="_blank">
            <Settings size={18} />
            <span>Ver Site</span>
          </Link>
          <button className="sidebar-link logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="admin-page-title">
            {menuItems.find(m => m.path === location.pathname)?.label || 'Backoffice'}
          </h1>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </main>

      <style>{`
        .admin-layout { display: flex; min-height: 100vh; background: var(--bg-secondary); }

        .admin-sidebar {
          width: 260px;
          background: white;
          border-right: 1px solid var(--sand);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 100;
          transition: transform var(--transition-normal);
        }

        .sidebar-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--beige);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-logo {
          text-decoration: none;
          display: flex;
          flex-direction: column;
          line-height: 1;
        }

        .logo-text {
          font-family: var(--font-heading);
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--primary-dark);
          letter-spacing: 0.1em;
        }

        .logo-sub {
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .sidebar-close { display: none; background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 0.25rem; }

        .sidebar-nav {
          flex: 1;
          padding: 1rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          overflow-y: auto;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-md);
          font-size: 0.9375rem;
          color: var(--text-secondary);
          text-decoration: none;
          transition: all var(--transition-fast);
          background: none;
          border: none;
          cursor: pointer;
          width: 100%;
          text-align: left;
          font-family: var(--font-body);
        }

        .sidebar-link:hover {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .sidebar-link.active {
          background: rgba(124, 154, 114, 0.1);
          color: var(--primary-dark);
          font-weight: 500;
        }

        .active-indicator { margin-left: auto; color: var(--primary); }

        .sidebar-footer {
          padding: 0.75rem;
          border-top: 1px solid var(--beige);
        }

        .logout-btn:hover { color: var(--error) !important; }

        .sidebar-overlay { display: none; }

        .admin-main {
          flex: 1;
          margin-left: 260px;
          min-height: 100vh;
        }

        .admin-header {
          background: white;
          border-bottom: 1px solid var(--sand);
          padding: 1rem 2rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: 1px solid var(--sand);
          border-radius: var(--radius-md);
          padding: 0.5rem;
          cursor: pointer;
          color: var(--text-primary);
        }

        .admin-page-title {
          font-family: var(--font-body);
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .admin-content {
          padding: 2rem;
        }

        @media (max-width: 768px) {
          .admin-sidebar {
            transform: translateX(-100%);
          }

          .admin-sidebar.open {
            transform: translateX(0);
          }

          .sidebar-close { display: block; }

          .sidebar-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 99;
          }

          .admin-main {
            margin-left: 0;
          }

          .mobile-menu-btn {
            display: flex;
          }

          .admin-content {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
