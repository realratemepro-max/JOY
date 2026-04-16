import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Calendar, CreditCard, UserCircle,
  ClipboardList, LogOut, Menu, X, ChevronRight
} from 'lucide-react';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const { appUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: '/app', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/app/plan', icon: ClipboardList, label: 'Meu Plano' },
    { path: '/app/sessions', icon: Calendar, label: 'Sessões' },
    { path: '/app/payments', icon: CreditCard, label: 'Pagamentos' },
    { path: '/app/profile', icon: UserCircle, label: 'Perfil' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="client-layout">
      <aside className={`client-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/app" className="sidebar-logo" onClick={() => setSidebarOpen(false)}>
            <span className="logo-text">JOY</span>
            <span className="logo-sub">Área do Cliente</span>
          </Link>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        {appUser && (
          <div className="sidebar-user">
            <div className="user-avatar">{appUser.name.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{appUser.name}</span>
              <span className="user-plan">{appUser.activePlanName || 'Sem plano ativo'}</span>
            </div>
          </div>
        )}

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
          <Link to="/" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
            <LayoutDashboard size={18} />
            <span>Ver Site</span>
          </Link>
          <button className="sidebar-link logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="client-main">
        <header className="client-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <h1 className="page-title">
            {menuItems.find(m => m.path === location.pathname)?.label || 'Área do Cliente'}
          </h1>
        </header>
        <div className="client-content">{children}</div>
      </main>

      <style>{`
        .client-layout { display: flex; min-height: 100vh; background: var(--bg-secondary); }

        .client-sidebar {
          width: 260px; background: white; border-right: 1px solid var(--sand);
          display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
          transition: transform var(--transition-normal);
        }

        .sidebar-header { padding: 1.5rem; border-bottom: 1px solid var(--beige); display: flex; align-items: center; justify-content: space-between; }
        .sidebar-logo { text-decoration: none; display: flex; flex-direction: column; line-height: 1; }
        .logo-text { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 600; color: var(--primary-dark); letter-spacing: 0.1em; }
        .logo-sub { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.15em; color: var(--text-muted); margin-top: 2px; }
        .sidebar-close { display: none; background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 0.25rem; }

        .sidebar-user { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--beige); display: flex; align-items: center; gap: 0.75rem; }
        .user-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
        .user-info { display: flex; flex-direction: column; overflow: hidden; }
        .user-name { font-weight: 600; font-size: 0.9375rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-plan { font-size: 0.75rem; color: var(--text-muted); }

        .sidebar-nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; overflow-y: auto; }
        .sidebar-link { display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 0.875rem; border-radius: var(--radius-md); font-size: 0.9375rem; color: var(--text-secondary); text-decoration: none; transition: all var(--transition-fast); background: none; border: none; cursor: pointer; width: 100%; text-align: left; font-family: var(--font-body); }
        .sidebar-link:hover { background: var(--bg-secondary); color: var(--text-primary); }
        .sidebar-link.active { background: rgba(124, 154, 114, 0.1); color: var(--primary-dark); font-weight: 500; }
        .active-indicator { margin-left: auto; color: var(--primary); }

        .sidebar-footer { padding: 0.75rem; border-top: 1px solid var(--beige); }
        .logout-btn:hover { color: var(--error) !important; }
        .sidebar-overlay { display: none; }

        .client-main { flex: 1; margin-left: 260px; min-height: 100vh; }
        .client-header { background: white; border-bottom: 1px solid var(--sand); padding: 1rem 2rem; display: flex; align-items: center; gap: 1rem; position: sticky; top: 0; z-index: 50; }
        .mobile-menu-btn { display: none; background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.5rem; cursor: pointer; color: var(--text-primary); }
        .page-title { font-family: var(--font-body); font-size: 1.25rem; font-weight: 600; margin: 0; }
        .client-content { padding: 2rem; }

        @media (max-width: 768px) {
          .client-sidebar { transform: translateX(-100%); }
          .client-sidebar.open { transform: translateX(0); }
          .sidebar-close { display: block; }
          .sidebar-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 99; }
          .client-main { margin-left: 0; }
          .mobile-menu-btn { display: flex; }
          .client-content { padding: 1rem; }
        }
      `}</style>
    </div>
  );
}
