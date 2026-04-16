import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { MapPin, Package, Users, CreditCard, TrendingUp, CalendarDays, ClipboardList, Clock, ArrowRight } from 'lucide-react';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function AdminDashboard() {
  const [stats, setStats] = useState({
    locations: 0, plans: 0, activeSubscriptions: 0, monthlyRevenue: 0,
    clients: 0, totalRevenue: 0, upcomingSessions: 0,
  });
  const [nextSessions, setNextSessions] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [locsSnap, plansSnap, subsSnap, usersSnap, paymentsSnap, sessionsSnap] = await Promise.all([
        getDocs(query(collection(db, 'locations'), where('isActive', '==', true))),
        getDocs(query(collection(db, 'plans'), where('isActive', '==', true))),
        getDocs(collection(db, 'subscriptions')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(10))),
        getDocs(query(collection(db, 'sessions'), orderBy('date', 'asc'))),
      ]);

      const activeSubs = subsSnap.docs.filter(d => d.data().status === 'active');
      const monthlyRev = activeSubs.reduce((sum, d) => sum + (d.data().priceMonthly || 0), 0);

      let totalRevenue = 0;
      const payments = paymentsSnap.docs.map(d => {
        const data = d.data();
        if (data.status === 'Paid') totalRevenue += data.amount || 0;
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate() };
      });

      const now = new Date();
      const upcoming = sessionsSnap.docs
        .map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate() }))
        .filter((s: any) => s.date >= now && s.status === 'scheduled')
        .slice(0, 5);

      // Count clients (users with role client, or legacy clients collection)
      const clientCount = usersSnap.docs.filter(d => d.data().role === 'client').length;
      // Also try legacy clients
      let legacyClients = 0;
      try {
        const legacySnap = await getDocs(collection(db, 'clients'));
        legacyClients = legacySnap.size;
      } catch { /* ignore */ }

      setStats({
        locations: locsSnap.size,
        plans: plansSnap.size,
        activeSubscriptions: activeSubs.length,
        monthlyRevenue: monthlyRev,
        clients: Math.max(clientCount, legacyClients),
        totalRevenue,
        upcomingSessions: upcoming.length,
      });
      setNextSessions(upcoming);
      setRecentPayments(payments.slice(0, 5));
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  const statCards = [
    { icon: MapPin, label: 'Espaços', value: stats.locations, color: 'var(--primary)', link: '/admin/locations' },
    { icon: Package, label: 'Planos Ativos', value: stats.plans, color: 'var(--accent)', link: '/admin/plans' },
    { icon: ClipboardList, label: 'Subscrições Ativas', value: stats.activeSubscriptions, color: '#6366f1', link: '/admin/subscriptions' },
    { icon: Users, label: 'Clientes', value: stats.clients, color: '#ec4899', link: '/admin/clients' },
    { icon: TrendingUp, label: 'Receita Mensal', value: `${stats.monthlyRevenue.toFixed(0)}€`, color: 'var(--success)', link: '/admin/subscriptions' },
    { icon: CreditCard, label: 'Receita Total', value: `${stats.totalRevenue.toFixed(0)}€`, color: '#f59e0b', link: '/admin/payments' },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <Link key={i} to={s.link} className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon" style={{ background: s.color + '15', color: s.color }}>
              <s.icon size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="dashboard-grid">
        {/* Next Sessions */}
        <div className="dash-section">
          <div className="dash-section-header">
            <h2><CalendarDays size={18} /> Próximas Sessões</h2>
            <Link to="/admin/sessions" className="dash-link">Ver todas <ArrowRight size={14} /></Link>
          </div>
          {nextSessions.length > 0 ? (
            <div className="next-sessions-list">
              {nextSessions.map((s: any) => (
                <div key={s.id} className="next-session-row">
                  <div className="next-session-date">
                    <span className="ns-day">{DAY_NAMES[s.date?.getDay()]}</span>
                    <span className="ns-num">{s.date?.getDate()}</span>
                  </div>
                  <div className="next-session-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock size={14} /> <strong>{s.startTime} - {s.endTime}</strong>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MapPin size={12} /> {s.locationName}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <Users size={14} /> {s.enrolledStudents?.length || 0}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-text">Sem sessões agendadas</p>
          )}
        </div>

        {/* Recent Payments */}
        <div className="dash-section">
          <div className="dash-section-header">
            <h2><CreditCard size={18} /> Pagamentos Recentes</h2>
            <Link to="/admin/payments" className="dash-link">Ver todos <ArrowRight size={14} /></Link>
          </div>
          {recentPayments.length > 0 ? (
            <table className="admin-table">
              <thead>
                <tr><th>Email</th><th>Valor</th><th>Status</th><th>Data</th></tr>
              </thead>
              <tbody>
                {recentPayments.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.userEmail}</td>
                    <td style={{ fontWeight: 600 }}>{(p.amount || 0).toFixed(2).replace('.', ',')}€</td>
                    <td><span className={`badge badge-${p.status === 'Paid' ? 'success' : p.status === 'Pending' ? 'warning' : 'error'}`}>{p.status === 'Paid' ? 'Pago' : p.status === 'Pending' ? 'Pendente' : p.status}</span></td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{p.createdAt?.toLocaleDateString('pt-PT') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-text">Sem pagamentos</p>
          )}
        </div>
      </div>

      <style>{`
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 2rem; }
        .stat-card { background: white; border-radius: var(--radius-xl); padding: 1.25rem; display: flex; align-items: center; gap: 0.875rem; box-shadow: var(--shadow-sm); transition: all var(--transition-fast); }
        .stat-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .stat-icon { width: 44px; height: 44px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-info { display: flex; flex-direction: column; }
        .stat-value { font-size: 1.375rem; font-weight: 700; font-family: var(--font-heading); color: var(--text-heading); }
        .stat-label { font-size: 0.75rem; color: var(--text-secondary); }

        .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .dash-section { background: white; border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-sm); }
        .dash-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .dash-section-header h2 { font-family: var(--font-body); font-size: 1rem; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 0.5rem; }
        .dash-link { display: flex; align-items: center; gap: 0.25rem; font-size: 0.8125rem; color: var(--primary); font-weight: 500; text-decoration: none; }

        .next-sessions-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .next-session-row { display: flex; align-items: center; gap: 1rem; padding: 0.625rem; border-radius: var(--radius-md); background: var(--bg-secondary); }
        .next-session-date { display: flex; flex-direction: column; align-items: center; min-width: 36px; }
        .ns-day { font-size: 0.625rem; text-transform: uppercase; color: var(--primary); font-weight: 600; }
        .ns-num { font-size: 1.125rem; font-weight: 700; font-family: var(--font-heading); }
        .next-session-info { flex: 1; }

        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); padding: 0.625rem 0.5rem; border-bottom: 2px solid var(--beige); }
        .admin-table td { padding: 0.625rem 0.5rem; border-bottom: 1px solid var(--beige); font-size: 0.875rem; }
        .empty-text { text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.9375rem; }

        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
