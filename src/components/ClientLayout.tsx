import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConsentGate } from './ConsentGate';
import { LevelUpToast } from './LevelUpToast';
import { PushPermissionPrompt } from './PushPermissionPrompt';
import { InstallAppPrompt } from './InstallAppPrompt';
import { InstallAppButton } from './InstallAppButton';
import { ProfileCompletionAlert } from './ProfileCompletionAlert';
import {
  LayoutDashboard, Calendar, CreditCard, UserCircle, Trophy,
  ClipboardList, LogOut, Menu, X, ChevronRight, CalendarDays, Library, MessageCircle, ChevronLeft,
} from 'lucide-react';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const { appUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sb-client-collapsed') === 'true');

  useEffect(() => { localStorage.setItem('sb-client-collapsed', String(collapsed)); }, [collapsed]);

  const menuItems = [
    { path: '/app', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/app/plan', icon: ClipboardList, label: 'Meu Plano' },
    { path: '/app/sessions', icon: Calendar, label: 'Aulas' },
    { path: '/app/conquistas', icon: Trophy, label: 'Conquistas' },
    { path: '/app/payments', icon: CreditCard, label: 'Pagamentos' },
    { path: '/app/events', icon: CalendarDays, label: 'Eventos' },
    { path: '/app/library', icon: Library, label: 'Biblioteca' },
    { path: '/app/chat', icon: MessageCircle, label: 'Mensagens' },
    { path: '/app/profile', icon: UserCircle, label: 'Perfil' },
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
    <ConsentGate>
    <LevelUpToast />
    <PushPermissionPrompt />
    <InstallAppPrompt />
    <ProfileCompletionAlert />
    <div className={`cl-layout${collapsed ? ' cl-collapsed' : ''}`}>
      <aside className={`cl-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="cl-sidebar-header">
          <Link to="/app" className="cl-logo" onClick={() => setSidebarOpen(false)}>
            <span className="cl-logo-text">JOY</span>
            <span className="cl-logo-sub">Área do Cliente</span>
          </Link>
          <button className="cl-collapse-btn cl-desktop-only" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expandir' : 'Colapsar'}>
            <ChevronLeft size={16} style={{ transition: 'transform 0.25s', transform: collapsed ? 'rotate(180deg)' : 'none' }} />
          </button>
          <button className="cl-close-btn cl-mobile-only" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {appUser && (
          <div className="cl-user">
            <div className="cl-avatar">{appUser.name.charAt(0).toUpperCase()}</div>
            <div className="cl-user-info">
              <span className="cl-user-name">{appUser.name}</span>
              <span className="cl-user-plan">{appUser.activePlanName || 'Sem plano ativo'}</span>
            </div>
          </div>
        )}

        <nav className="cl-nav">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`cl-link${location.pathname === item.path ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              title={item.label}
            >
              <item.icon size={18} className="cl-link-icon" />
              <span className="cl-link-label">{item.label}</span>
              {location.pathname === item.path && <ChevronRight size={14} className="cl-active-chevron" />}
            </Link>
          ))}
        </nav>

        <div className="cl-sidebar-footer">
          <InstallAppButton className="cl-link cl-install" iconClassName="cl-link-icon" labelClassName="cl-link-label" label="Instalar app" />
          <Link to="/" className="cl-link" title="Ver Site">
            <LayoutDashboard size={18} className="cl-link-icon" />
            <span className="cl-link-label">Ver Site</span>
          </Link>
          <button className="cl-link cl-logout" onClick={handleLogout} title="Sair">
            <LogOut size={18} className="cl-link-icon" />
            <span className="cl-link-label">Sair</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="cl-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="cl-main">
        <header className="cl-topbar">
          <button className="cl-menu-btn" onClick={handleToggle} aria-label="Toggle sidebar">
            <Menu size={20} />
          </button>
          <h1 className="cl-page-title">
            {menuItems.find(m => m.path === location.pathname)?.label || 'Área do Cliente'}
          </h1>
        </header>
        <div className="cl-content">{children}</div>
      </main>

      <style>{`
        .cl-layout { display: flex; min-height: 100vh; background: var(--bg-secondary); }

        .cl-sidebar {
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

        .cl-sidebar-header {
          padding: 1.25rem 1rem;
          border-bottom: 1px solid var(--beige);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-height: 64px;
        }

        .cl-logo { text-decoration: none; display: flex; flex-direction: column; line-height: 1; flex: 1; min-width: 0; overflow: hidden; }
        .cl-logo-text { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 600; color: var(--primary-dark); letter-spacing: 0.1em; white-space: nowrap; }
        .cl-logo-sub { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.15em; color: var(--text-muted); margin-top: 2px; white-space: nowrap; }

        .cl-collapse-btn, .cl-close-btn {
          background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem;
          cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.15s;
        }
        .cl-collapse-btn:hover, .cl-close-btn:hover { background: var(--bg-secondary); }

        .cl-user {
          padding: 1rem 1rem;
          border-bottom: 1px solid var(--beige);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          overflow: hidden;
        }

        .cl-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--primary-gradient); color: white;
          display: flex; align-items: center; justify-content: center;
          font-weight: 600; flex-shrink: 0; font-size: 0.875rem;
        }

        .cl-user-info { display: flex; flex-direction: column; overflow: hidden; }
        .cl-user-name { font-weight: 600; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cl-user-plan { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .cl-nav { flex: 1; padding: 0.75rem 0.625rem; display: flex; flex-direction: column; gap: 0.125rem; overflow-y: auto; overflow-x: hidden; }

        .cl-link {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.5rem 0.75rem; border-radius: var(--radius-md);
          font-size: 0.9rem; color: var(--text-secondary); text-decoration: none;
          transition: background 0.15s, color 0.15s; background: none; border: none;
          cursor: pointer; width: 100%; text-align: left; font-family: var(--font-body);
          white-space: nowrap; min-width: 0;
        }
        .cl-link:hover { background: var(--bg-secondary); color: var(--text-primary); }
        .cl-link.active { background: rgba(124,154,114,0.12); color: var(--primary-dark); font-weight: 500; }
        .cl-link-icon { flex-shrink: 0; }
        .cl-link-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
        .cl-active-chevron { margin-left: auto; color: var(--primary); flex-shrink: 0; }

        .cl-sidebar-footer { padding: 0.625rem; border-top: 1px solid var(--beige); }
        .cl-logout:hover { color: var(--error) !important; }
        .cl-overlay { display: none; }

        .cl-main { flex: 1; margin-left: 260px; min-height: 100vh; min-width: 0; transition: margin-left 0.25s ease; display: flex; flex-direction: column; }

        .cl-topbar {
          background: white; border-bottom: 1px solid var(--sand);
          padding: 0 1.5rem; display: flex; align-items: center; gap: 0.875rem;
          position: sticky; top: 0; z-index: 100; height: 64px; flex-shrink: 0;
        }

        .cl-menu-btn {
          display: flex; align-items: center; justify-content: center;
          background: none; border: 1px solid var(--sand); border-radius: var(--radius-md);
          padding: 0.45rem; cursor: pointer; color: var(--text-primary); flex-shrink: 0;
          transition: background 0.15s;
        }
        .cl-menu-btn:hover { background: var(--bg-secondary); }

        .cl-page-title { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .cl-content { padding: 1.5rem; flex: 1; min-width: 0; overflow-x: auto; }

        /* Desktop collapsed */
        @media (min-width: 769px) {
          .cl-layout.cl-collapsed .cl-sidebar { width: 64px; }
          .cl-layout.cl-collapsed .cl-main { margin-left: 64px; }
          .cl-layout.cl-collapsed .cl-link { justify-content: center; padding: 0.5rem; }
          .cl-layout.cl-collapsed .cl-link-label { display: none; }
          .cl-layout.cl-collapsed .cl-active-chevron { display: none; }
          .cl-layout.cl-collapsed .cl-logo { align-items: center; }
          .cl-layout.cl-collapsed .cl-logo-text { font-size: 1rem; }
          .cl-layout.cl-collapsed .cl-logo-sub { display: none; }
          .cl-layout.cl-collapsed .cl-sidebar-header { justify-content: space-between; padding: 1.25rem 0.75rem; }
          .cl-layout.cl-collapsed .cl-user { justify-content: center; padding: 1rem 0.5rem; }
          .cl-layout.cl-collapsed .cl-user-info { display: none; }
          .cl-desktop-only { display: flex !important; }
          .cl-mobile-only { display: none !important; }
        }

        /* Mobile */
        @media (max-width: 768px) {
          .cl-sidebar { transform: translateX(-100%); width: 260px !important; }
          .cl-sidebar.open { transform: translateX(0); }
          .cl-link-label { display: flex !important; opacity: 1 !important; }
          .cl-link { justify-content: flex-start !important; padding: 0.5rem 0.75rem !important; }
          .cl-logo-sub { display: block !important; }
          .cl-user-info { display: flex !important; }
          .cl-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 199; }
          .cl-main { margin-left: 0 !important; }
          .cl-content { padding: 1rem; }
          .cl-desktop-only { display: none !important; }
          .cl-mobile-only { display: flex !important; }
        }
      `}</style>
    </div>
    </ConsentGate>
  );
}
