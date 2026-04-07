import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Package, Users, CreditCard, TrendingUp } from 'lucide-react';

export function AdminDashboard() {
  const [stats, setStats] = useState({ services: 0, clients: 0, payments: 0, revenue: 0 });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [servicesSnap, clientsSnap, paymentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'services'), where('isActive', '==', true))),
        getDocs(collection(db, 'clients')),
        getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(10))),
      ]);

      let totalRevenue = 0;
      const payments = paymentsSnap.docs.map(d => {
        const data = d.data();
        if (data.status === 'Paid') totalRevenue += data.amount || 0;
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate() };
      });

      setStats({
        services: servicesSnap.size,
        clients: clientsSnap.size,
        payments: paymentsSnap.size,
        revenue: totalRevenue,
      });
      setRecentPayments(payments.slice(0, 5));
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const statCards = [
    { icon: Package, label: 'Serviços Ativos', value: stats.services, color: 'var(--primary)' },
    { icon: Users, label: 'Clientes', value: stats.clients, color: 'var(--accent)' },
    { icon: CreditCard, label: 'Pagamentos', value: stats.payments, color: '#6366f1' },
    { icon: TrendingUp, label: 'Receita Total', value: `${stats.revenue.toFixed(2).replace('.', ',')}€`, color: 'var(--success)' },
  ];

  return (
    <div>
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '15', color: s.color }}>
              <s.icon size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="recent-section">
        <h2>Pagamentos Recentes</h2>
        {recentPayments.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Valor</th>
                <th>Método</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map(p => (
                <tr key={p.id}>
                  <td>{p.userEmail}</td>
                  <td>{(p.amount || 0).toFixed(2).replace('.', ',')}€</td>
                  <td>{p.method}</td>
                  <td><span className={`badge badge-${p.status === 'Paid' ? 'success' : p.status === 'Pending' ? 'warning' : 'error'}`}>{p.status}</span></td>
                  <td>{p.createdAt?.toLocaleDateString('pt-PT') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-state">Sem pagamentos registados</p>
        )}
      </div>

      <style>{`
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: white; border-radius: var(--radius-xl); padding: 1.5rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
        .stat-icon { width: 48px; height: 48px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-info { display: flex; flex-direction: column; }
        .stat-value { font-size: 1.5rem; font-weight: 700; font-family: var(--font-heading); color: var(--text-heading); }
        .stat-label { font-size: 0.8125rem; color: var(--text-secondary); }
        .recent-section { background: white; border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-sm); }
        .recent-section h2 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); padding: 0.75rem; border-bottom: 2px solid var(--beige); }
        .admin-table td { padding: 0.75rem; border-bottom: 1px solid var(--beige); font-size: 0.9375rem; color: var(--text-primary); }
        .empty-state { text-align: center; padding: 2rem; color: var(--text-secondary); }

        @media (max-width: 768px) {
          .admin-table { font-size: 0.8125rem; }
          .admin-table th, .admin-table td { padding: 0.5rem 0.375rem; }
        }
      `}</style>
    </div>
  );
}
