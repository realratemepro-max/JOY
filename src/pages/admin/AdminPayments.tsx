import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Payment } from '../../types';
import { Search, Download, Filter, Edit2, Save, X, Loader } from 'lucide-react';

export function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPayments(); }, []);

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
      return p.userEmail?.toLowerCase().includes(q) || p.identifier?.toLowerCase().includes(q) || p.plan?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPaid = filtered.filter(p => p.status === 'Paid').reduce((sum, p) => sum + (p.amount || 0), 0);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: '2.5rem' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por email, referência..." />
        </div>
        <select className="input" style={{ width: 'auto', minWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Todos</option>
          <option value="Paid">Pagos</option>
          <option value="Pending">Pendentes</option>
          <option value="Failed">Falhados</option>
          <option value="Cancelled">Cancelados</option>
        </select>
        <div style={{ background: 'white', padding: '0.625rem 1rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', fontWeight: 600 }}>
          Total: <span style={{ color: 'var(--primary-dark)' }}>{totalPaid.toFixed(2).replace('.', ',')}€</span>
        </div>
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
                    <td>{p.plan || p.serviceName || '-'}</td>
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
                        <button className="btn btn-sm btn-secondary" onClick={() => { setEditingId(p.id); setEditStatus(p.status); }} style={{ padding: '0.25rem 0.5rem' }}><Edit2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .admin-table { width: 100%; border-collapse: collapse; min-width: 700px; }
        .admin-table th { text-align: left; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); padding: 0.875rem 1rem; border-bottom: 2px solid var(--beige); background: var(--bg-secondary); }
        .admin-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--beige); font-size: 0.9375rem; }
        .admin-table tr:hover td { background: var(--bg-secondary); }
      `}</style>
    </div>
  );
}
