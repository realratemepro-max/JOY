import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Subscription } from '../../types';
import { Search, Pause, Play, XCircle, MapPin, Calendar, Users } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; badge: string }> = {
  active: { label: 'Ativo', badge: 'success' },
  paused: { label: 'Pausado', badge: 'warning' },
  cancelled: { label: 'Cancelado', badge: 'error' },
  expired: { label: 'Expirado', badge: 'error' },
  pending_payment: { label: 'Pag. Pendente', badge: 'warning' },
};

export function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => { loadSubscriptions(); }, []);

  const loadSubscriptions = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc')));
      setSubscriptions(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          startDate: data.startDate?.toDate(),
          currentPeriodStart: data.currentPeriodStart?.toDate(),
          currentPeriodEnd: data.currentPeriodEnd?.toDate(),
          endDate: data.endDate?.toDate(),
          cancelledAt: data.cancelledAt?.toDate(),
          pausedAt: data.pausedAt?.toDate(),
          nextPaymentDue: data.nextPaymentDue?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Subscription;
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const confirmMsg = newStatus === 'cancelled' ? 'Cancelar esta subscrição?' : newStatus === 'paused' ? 'Pausar esta subscrição?' : 'Reativar esta subscrição?';
    if (!confirm(confirmMsg)) return;

    try {
      const updates: any = { status: newStatus, updatedAt: new Date() };
      if (newStatus === 'cancelled') updates.cancelledAt = new Date();
      if (newStatus === 'paused') updates.pausedAt = new Date();
      await updateDoc(doc(db, 'subscriptions', id), updates);
      await loadSubscriptions();
    } catch (err) { console.error(err); }
  };

  const filtered = subscriptions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.userName?.toLowerCase().includes(q) || s.userEmail?.toLowerCase().includes(q) || s.planName?.toLowerCase().includes(q);
    }
    return true;
  });

  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const totalMonthly = subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.priceMonthly || 0), 0);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="stat-pill"><Users size={16} /> <strong>{activeCount}</strong> ativas</div>
        <div className="stat-pill"><Calendar size={16} /> <strong>{totalMonthly.toFixed(2).replace('.', ',')}€</strong> /mês recorrente</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: '2.5rem' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por nome, email, plano..." />
        </div>
        <select className="input" style={{ width: 'auto', minWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Todos ({subscriptions.length})</option>
          <option value="active">Ativos ({subscriptions.filter(s => s.status === 'active').length})</option>
          <option value="paused">Pausados ({subscriptions.filter(s => s.status === 'paused').length})</option>
          <option value="cancelled">Cancelados ({subscriptions.filter(s => s.status === 'cancelled').length})</option>
          <option value="expired">Expirados ({subscriptions.filter(s => s.status === 'expired').length})</option>
          <option value="pending_payment">Pag. Pendente ({subscriptions.filter(s => s.status === 'pending_payment').length})</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{subscriptions.length === 0 ? 'Sem subscrições. Os clientes podem subscrever planos na landing page.' : 'Nenhuma subscrição encontrada com esses filtros.'}</p>
        </div>
      ) : (
        <div className="subs-list">
          {filtered.map(sub => {
            const status = STATUS_MAP[sub.status] || { label: sub.status, badge: 'warning' };
            return (
              <div key={sub.id} className="sub-card">
                <div className="sub-main">
                  <div className="sub-user">
                    <div className="sub-avatar">{(sub.userName || '?').charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{sub.userName}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{sub.userEmail}</div>
                    </div>
                  </div>
                  <div className="sub-plan">
                    <div style={{ fontWeight: 600 }}>{sub.planName}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <MapPin size={12} /> {sub.locationName} · {sub.sessionsPerWeek}x/sem
                    </div>
                  </div>
                  <div className="sub-price">
                    <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{sub.priceMonthly.toFixed(2).replace('.', ',')}€</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/mês</span>
                  </div>
                  <div className="sub-sessions">
                    <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{sub.sessionsUsedThisPeriod}/{sub.sessionsAllowedThisPeriod}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>sessões</span>
                  </div>
                  <div>
                    <span className={`badge badge-${status.badge}`}>{status.label}</span>
                  </div>
                  <div className="sub-actions">
                    {sub.status === 'active' && (
                      <>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(sub.id, 'paused')} title="Pausar"><Pause size={14} /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleStatusChange(sub.id, 'cancelled')} title="Cancelar"><XCircle size={14} /></button>
                      </>
                    )}
                    {sub.status === 'paused' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(sub.id, 'active')} title="Reativar"><Play size={14} /></button>
                    )}
                    {(sub.status === 'cancelled' || sub.status === 'expired') && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(sub.id, 'active')} title="Reativar"><Play size={14} /></button>
                    )}
                  </div>
                </div>
                <div className="sub-footer">
                  <span>Início: {sub.startDate?.toLocaleDateString('pt-PT') || '-'}</span>
                  <span>Período: {sub.currentPeriodStart?.toLocaleDateString('pt-PT') || '-'} - {sub.currentPeriodEnd?.toLocaleDateString('pt-PT') || '-'}</span>
                  {sub.nextPaymentDue && <span>Próx. pagamento: {sub.nextPaymentDue.toLocaleDateString('pt-PT')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .stat-pill { display: flex; align-items: center; gap: 0.5rem; background: white; padding: 0.625rem 1rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); font-size: 0.9375rem; color: var(--text-secondary); }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }
        .subs-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .sub-card { background: white; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
        .sub-main { display: flex; align-items: center; gap: 1.25rem; padding: 1.25rem; }
        .sub-user { display: flex; align-items: center; gap: 0.75rem; flex: 1.5; min-width: 180px; }
        .sub-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
        .sub-plan { flex: 1.5; min-width: 160px; }
        .sub-price { text-align: center; min-width: 80px; }
        .sub-sessions { text-align: center; min-width: 70px; }
        .sub-actions { display: flex; gap: 0.375rem; }
        .sub-footer { display: flex; gap: 1.5rem; padding: 0.625rem 1.25rem; background: var(--bg-secondary); font-size: 0.75rem; color: var(--text-muted); flex-wrap: wrap; }

        @media (max-width: 768px) {
          .sub-main { flex-wrap: wrap; }
          .sub-user { min-width: 100%; }
        }
      `}</style>
    </div>
  );
}
