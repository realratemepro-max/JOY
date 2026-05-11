import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PushPermissionPrompt } from './PushPermissionPrompt';
import {
  LayoutDashboard, Calendar, MessageCircle, TrendingUp,
  LogOut, Menu, X, ChevronRight, UserCircle, AlertCircle, ChevronLeft,
  CalendarDays, MapPin, Euro,
} from 'lucide-react';

interface ProfessorLayoutProps { children: React.ReactNode; }

export function ProfessorLayout({ children }: ProfessorLayoutProps) {
  const { professorData, professorPermissions, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sb-prof-collapsed') === 'true');

  useEffect(() => { localStorage.setItem('sb-prof-collapsed', String(collapsed)); }, [collapsed]);

  const menuItems = [
    { path: '/professor', icon: LayoutDashboard, label: 'Dashboard', section: 'studio' },
    { path: '/professor/sessions', icon: Calendar, label: 'Aulas', section: 'studio' },
    { path: '/professor/chat', icon: MessageCircle, label: 'Mensagens', section: 'studio' },
    ...(professorPermissions.canViewEarnings ? [{ path: '/professor/earnings', icon: TrendingUp, label: 'Ganhos', section: 'studio' }] : []),
    { path: '/professor/agenda', icon: CalendarDays, label: 'Agenda', section: 'personal' },
    { path: '/professor/locations', icon: MapPin, label: 'Espaços', section: 'personal' },
    { path: '/professor/financeiro', icon: Euro, label: 'Financeiro', section: 'personal' },
    { path: '/professor/profile', icon: UserCircle, label: 'Perfil', section: 'other', alert: !professorData?.dateOfBirth },
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
    <>
    <PushPermissionPrompt />
    <div className={`pl-layout${collapsed ? ' pl-collapsed' : ''}`}>
      <aside className={`pl-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="pl-sidebar-header">
          <Link to="/professor" className="pl-logo" onClick={() => setSidebarOpen(false)}>
            <span className="pl-logo-text">JOY</span>
            <span className="pl-logo-sub">Portal Professor</span>
          </Link>
          <button className="pl-collapse-btn pl-desktop-only" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expandir' : 'Colapsar'}>
            <ChevronLeft size={16} style={{ transition: 'transform 0.25s', transform: collapsed ? 'rotate(180deg)' : 'none' }} />
          </button>
          <button className="pl-close-btn pl-mobile-only" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {professorData && (
          <div className="pl-user">
            {professorData.photoUrl ? (
              <img src={professorData.photoUrl} alt={professorData.name} className="pl-avatar-img" />
            ) : (
              <div className="pl-avatar">{professorData.name.charAt(0).toUpperCase()}</div>
            )}
            <div className="pl-user-info">
              <span className="pl-user-name">{professorData.name}</span>
              <span className="pl-user-sub">{professorData.style || 'Professor'}</span>
            </div>
          </div>
        )}

        <nav className="pl-nav">
          {menuItems.filter(i => i.section === 'studio').map(item => (
            <Link key={item.path} to={item.path} className={`pl-link${location.pathname === item.path ? ' active' : ''}`} onClick={() => setSidebarOpen(false)} title={item.label}>
              <item.icon size={18} className="pl-link-icon" />
              <span className="pl-link-label">{item.label}</span>
              {(item as any).alert && <AlertCircle size={14} color="var(--accent)" className="pl-alert-icon" />}
              {location.pathname === item.path && <ChevronRight size={14} className="pl-active-chevron" />}
            </Link>
          ))}
          <div className="pl-section-divider">
            <span className="pl-section-label">Pessoal</span>
          </div>
          {menuItems.filter(i => i.section === 'personal').map(item => (
            <Link key={item.path} to={item.path} className={`pl-link pl-link-personal${location.pathname === item.path ? ' active' : ''}`} onClick={() => setSidebarOpen(false)} title={item.label}>
              <item.icon size={18} className="pl-link-icon" />
              <span className="pl-link-label">{item.label}</span>
              {location.pathname === item.path && <ChevronRight size={14} className="pl-active-chevron" />}
            </Link>
          ))}
          <div className="pl-section-divider" />
          {menuItems.filter(i => i.section === 'other').map(item => (
            <Link key={item.path} to={item.path} className={`pl-link${location.pathname === item.path ? ' active' : ''}`} onClick={() => setSidebarOpen(false)} title={item.label}>
              <item.icon size={18} className="pl-link-icon" />
              <span className="pl-link-label">{item.label}</span>
              {(item as any).alert && <AlertCircle size={14} color="var(--accent)" className="pl-alert-icon" />}
              {location.pathname === item.path && <ChevronRight size={14} className="pl-active-chevron" />}
            </Link>
          ))}
        </nav>

        <div className="pl-sidebar-footer">
          <button className="pl-link pl-logout" onClick={handleLogout} title="Sair">
            <LogOut size={18} className="pl-link-icon" />
            <span className="pl-link-label">Sair</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="pl-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="pl-main">
        <header className="pl-topbar">
          <button className="pl-menu-btn" onClick={handleToggle} aria-label="Toggle sidebar">
            <Menu size={20} />
          </button>
          <h1 className="pl-page-title">
            {menuItems.find(m => m.path === location.pathname)?.label || 'Portal Professor'}
          </h1>
        </header>
        <div className="pl-content">{children}</div>
      </main>

      <style>{`
        .pl-layout { display: flex; min-height: 100vh; background: var(--bg-secondary); }

        .pl-sidebar {
          width: 260px; background: white; border-right: 1px solid var(--sand);
          display: flex; flex-direction: column; position: fixed;
          top: 0; left: 0; bottom: 0; z-index: 200;
          transition: width 0.25s ease, transform 0.25s ease; overflow: hidden;
        }

        .pl-sidebar-header {
          padding: 1.25rem 1rem; border-bottom: 1px solid var(--beige);
          display: flex; align-items: center; gap: 0.5rem; min-height: 64px;
        }

        .pl-logo { text-decoration: none; display: flex; flex-direction: column; line-height: 1; flex: 1; min-width: 0; overflow: hidden; }
        .pl-logo-text { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 600; color: var(--accent-dark); letter-spacing: 0.1em; white-space: nowrap; }
        .pl-logo-sub { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.15em; color: var(--text-muted); margin-top: 2px; white-space: nowrap; }

        .pl-collapse-btn, .pl-close-btn {
          background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem;
          cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.15s;
        }
        .pl-collapse-btn:hover, .pl-close-btn:hover { background: var(--bg-secondary); }

        .pl-user {
          padding: 1rem; border-bottom: 1px solid var(--beige);
          display: flex; align-items: center; gap: 0.75rem; overflow: hidden;
        }
        .pl-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #c17f59, #a0603a); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; font-size: 0.875rem; }
        .pl-avatar-img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .pl-user-info { display: flex; flex-direction: column; overflow: hidden; }
        .pl-user-name { font-weight: 600; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pl-user-sub { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .pl-nav { flex: 1; padding: 0.75rem 0.625rem; display: flex; flex-direction: column; gap: 0.125rem; overflow-y: auto; overflow-x: hidden; }
        .pl-section-divider { display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0.25rem 0.375rem; }
        .pl-section-label { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); white-space: nowrap; }
        .pl-section-divider::after { content: ''; flex: 1; height: 1px; background: var(--beige); }
        .pl-link-personal.active { background: rgba(59,130,246,0.1); color: #1d4ed8; }

        .pl-link {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.5rem 0.75rem; border-radius: var(--radius-md);
          font-size: 0.9rem; color: var(--text-secondary); text-decoration: none;
          transition: background 0.15s, color 0.15s; background: none; border: none;
          cursor: pointer; width: 100%; text-align: left; font-family: var(--font-body);
          white-space: nowrap; min-width: 0;
        }
        .pl-link:hover { background: var(--bg-secondary); color: var(--text-primary); }
        .pl-link.active { background: rgba(193,127,89,0.1); color: var(--accent-dark); font-weight: 500; }
        .pl-link-icon { flex-shrink: 0; }
        .pl-link-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
        .pl-alert-icon { flex-shrink: 0; }
        .pl-active-chevron { margin-left: auto; color: var(--accent); flex-shrink: 0; }

        .pl-sidebar-footer { padding: 0.625rem; border-top: 1px solid var(--beige); }
        .pl-logout:hover { color: var(--error) !important; }
        .pl-overlay { display: none; }

        .pl-main { flex: 1; margin-left: 260px; min-height: 100vh; min-width: 0; transition: margin-left 0.25s ease; display: flex; flex-direction: column; }

        .pl-topbar {
          background: white; border-bottom: 1px solid var(--sand);
          padding: 0 1.5rem; display: flex; align-items: center; gap: 0.875rem;
          position: sticky; top: 0; z-index: 100; height: 64px; flex-shrink: 0;
        }

        .pl-menu-btn {
          display: flex; align-items: center; justify-content: center;
          background: none; border: 1px solid var(--sand); border-radius: var(--radius-md);
          padding: 0.45rem; cursor: pointer; color: var(--text-primary); flex-shrink: 0; transition: background 0.15s;
        }
        .pl-menu-btn:hover { background: var(--bg-secondary); }

        .pl-page-title { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .pl-content { padding: 1.5rem; flex: 1; min-width: 0; overflow-x: auto; }

        /* Desktop collapsed */
        @media (min-width: 769px) {
          .pl-layout.pl-collapsed .pl-sidebar { width: 64px; }
          .pl-layout.pl-collapsed .pl-main { margin-left: 64px; }
          .pl-layout.pl-collapsed .pl-link { justify-content: center; padding: 0.5rem; }
          .pl-layout.pl-collapsed .pl-link-label { display: none; }
          .pl-layout.pl-collapsed .pl-active-chevron { display: none; }
          .pl-layout.pl-collapsed .pl-alert-icon { display: none; }
          .pl-layout.pl-collapsed .pl-logo { align-items: center; }
          .pl-layout.pl-collapsed .pl-logo-text { font-size: 1rem; }
          .pl-layout.pl-collapsed .pl-logo-sub { display: none; }
          .pl-layout.pl-collapsed .pl-sidebar-header { justify-content: space-between; padding: 1.25rem 0.75rem; }
          .pl-layout.pl-collapsed .pl-user { justify-content: center; padding: 1rem 0.5rem; }
          .pl-layout.pl-collapsed .pl-user-info { display: none; }
          .pl-desktop-only { display: flex !important; }
          .pl-mobile-only { display: none !important; }
        }

        /* Mobile */
        @media (max-width: 768px) {
          .pl-sidebar { transform: translateX(-100%); width: 260px !important; }
          .pl-sidebar.open { transform: translateX(0); }
          .pl-link-label { display: flex !important; opacity: 1 !important; }
          .pl-link { justify-content: flex-start !important; padding: 0.5rem 0.75rem !important; }
          .pl-logo-sub { display: block !important; }
          .pl-user-info { display: flex !important; }
          .pl-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 199; }
          .pl-main { margin-left: 0 !important; }
          .pl-content { padding: 1rem; }
          .pl-desktop-only { display: none !important; }
          .pl-mobile-only { display: flex !important; }
        }
      `}</style>
    </div>
    </>
  );
}
