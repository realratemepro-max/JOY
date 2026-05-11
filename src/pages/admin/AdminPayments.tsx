import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Payment } from '../../types';
import { Search, Edit2, Save, X, Loader, TrendingUp, Clock, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';

export function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Payment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadPayments(); }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await deleteDoc(doc(db, 'payments', confirmDelete.id));
      setConfirmDelete(null);
      await loadPayments();
    } catch (err) { console.error('Error deleting payment:', err); }
    finally { setDeletingId(null); }
  };

  const handleUpdateStatus = async (paymentId: string) => {
    try {
      setSaving(true);
      await updateDoc(doc(db, 'payments', paymentId), {
        status: editStatus,
        updatedAt: new Date(),
        ...(editStatus === 'Paid' ? { paidAt: new Date() } : {}),
      });
      await loadPayments();
      setEditingId(null);
    } catch (err) { console.error('Error updating payment:', err); }
    finally { setSaving(false); }
  };

  const loadPayments = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc')));
      setPayments(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          paidAt: data.paidAt?.toDate(),
          expiresAt: data.expiresAt?.toDate(),
        } as Payment;
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filtered = payments.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.userEmail?.toLowerCase().includes(q) || p.identifier?.toLowerCase().includes(q) ||
        (p as any).planName?.toLowerCase().includes(q) || p.plan?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPaid = payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPending = payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + (p.amount || 0), 0);
  const now = new Date();
  const thisMonthPaid = payments.filter(p => p.status === 'Paid' && p.createdAt.getMonth() === now.getMonth() && p.createdAt.getFullYear() === now.getFullYear()).reduce((sum, p) => sum + (p.amount || 0), 0);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle size={22} color="var(--success, #22c55e)" />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total recebido</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary-dark)' }}>{totalPaid.toFixed(2).replace('.', ',')}€</div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <TrendingUp size={22} color="var(--primary)" />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Este mês</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary-dark)' }}>{thisMonthPaid.toFixed(2).replace('.', ',')}€</div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Clock size={22} color="#f59e0b" />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendente</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#92400e' }}>{totalPending.toFixed(2).replace('.', ',')}€</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: '2.5rem' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por email, referência..." />
        </div>
        <select className="input" style={{ width: 'auto', minWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Todos ({payments.length})</option>
          <option value="Paid">Pagos ({payments.filter(p => p.status === 'Paid').length})</option>
          <option value="Pending">Pendentes ({payments.filter(p => p.status === 'Pending').length})</option>
          <option value="Failed">Falhados ({payments.filter(p => p.status === 'Failed').length})</option>
          <option value="Cancelled">Cancelados ({payments.filter(p => p.status === 'Cancelled').length})</option>
        </select>
      </div>

      <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Sem pagamentos encontrados</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Email</th>
                  <th>Serviço</th>
                  <th>Valor</th>
                  <th>Método</th>
                  <th>Status</th>
                  <th>Referência</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>{p.createdAt.toLocaleDateString('pt-PT')}</td>
                    <td>{p.userEmail}</td>
                    <td>{(p as any).planName || p.plan || p.serviceName || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{(p.amount || 0).toFixed(2).replace('.', ',')}€</td>
                    <td>{p.method}</td>
                    <td>
                      {editingId === p.id ? (
                        <select className="input" style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem', width: 'auto' }} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                          <option value="Pending">Pendente</option>
                          <option value="Paid">Pago</option>
                          <option value="Failed">Falhado</option>
                          <option value="Cancelled">Cancelado</option>
                        </select>
                      ) : (
                        <span className={`badge badge-${p.status === 'Paid' ? 'success' : p.status === 'Pending' ? 'warning' : 'error'}`}>
                          {p.status === 'Paid' ? 'Pago' : p.status === 'Pending' ? 'Pendente' : p.status === 'Failed' ? 'Falhado' : p.status}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>{p.identifier}</td>
                    <td>
                      {editingId === p.id ? (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-sm btn-primary" onClick={() => handleUpdateStatus(p.id)} disabled={saving} style={{ padding: '0.25rem 0.5rem' }}>
                            {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.5rem' }}><X size={14} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => { setEditingId(p.id); setEditStatus(p.status); }} style={{ padding: '0.25rem 0.5rem' }} title="Editar estado"><Edit2 size={14} /></button>
                          <button className="btn btn-sm" onClick={() => setConfirmDelete(p)} style={{ padding: '0.25rem 0.5rem', background: 'white', color: 'var(--error)', border: '1.5px solid var(--error)' }} title="Apagar pagamento"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <AlertTriangle size={22} color="var(--error)" />
              <h3 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '1.125rem' }}>Apagar pagamento</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
              Vais apagar o pagamento de <strong>{confirmDelete.userEmail}</strong> — <strong>{(confirmDelete.amount || 0).toFixed(2).replace('.', ',')}€</strong> ({(confirmDelete as any).planName || confirmDelete.plan || '-'}).
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Esta ação remove o registo do Firestore e não pode ser desfeita. Não apaga compras (purchases) nem inscrições associadas.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deletingId === confirmDelete.id}>
                {deletingId === confirmDelete.id ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><Trash2 size={16} /> Apagar permanentemente</>}
              </button>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)} disabled={!!deletingId}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-box { background: white; border-radius: var(--radius-xl); padding: 1.75rem; max-width: 420px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .admin-table { width: 100%; border-collapse: collapse; min-width: 700px; }
        .admin-table th { text-align: left; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); padding: 0.875rem 1rem; border-bottom: 2px solid var(--beige); background: var(--bg-secondary); }
        .admin-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--beige); font-size: 0.9375rem; }
        .admin-table tr:hover td { background: var(--bg-secondary); }
      `}</style>
    </div>
  );
}
