import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Plus, Edit2, Save, X, Loader, ShoppingBag, Calendar, Check, Clock, AlertTriangle, Trash2 } from 'lucide-react';

interface Purchase {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: string;
  planName: string;
  locationName: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  priceMonthly: number;
  status: string;
  startDate: Date;
  endDate: Date;
  purchaseDate: Date;
  paymentId: string;
  createdAt: Date;
}

export function AdminPurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEndDate, setNewEndDate] = useState('');
  const [newSessions, setNewSessions] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Purchase | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'purchases'), orderBy('createdAt', 'desc')));
      setPurchases(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
          purchaseDate: data.purchaseDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
        } as Purchase;
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startEdit = (p: Purchase) => {
    setEditingId(p.id);
    setNewEndDate(p.endDate.toISOString().slice(0, 10));
    setNewSessions(String(p.sessionsTotal));
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      setSaving(true);
      const purchase = purchases.find(p => p.id === editingId);
      if (!purchase) return;
      const endDate = new Date(newEndDate + 'T23:59:59');
      const sessionsTotal = Number(newSessions);
      const sessionsRemaining = Math.max(0, sessionsTotal - purchase.sessionsUsed);
      await updateDoc(doc(db, 'purchases', editingId), {
        endDate: Timestamp.fromDate(endDate),
        sessionsTotal,
        sessionsRemaining,
        updatedAt: new Date(),
      });
      setEditingId(null);
      await loadData();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await updateDoc(doc(db, 'purchases', id), { status: newStatus, updatedAt: new Date() });
    await loadData();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await deleteDoc(doc(db, 'purchases', confirmDelete.id));
      setConfirmDelete(null);
      await loadData();
    } catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  };

  const now = new Date();
  const filtered = purchases.filter(p => {
    if (filter === 'active') return p.status === 'active' && p.endDate >= now;
    if (filter === 'expired') return p.endDate < now || p.status !== 'active';
    return true;
  });

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Packs de aulas comprados pelos clientes. Podes ajustar validade e sessões.</p>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'white', borderRadius: 'var(--radius-lg)', padding: '0.2rem', boxShadow: 'var(--shadow-sm)' }}>
          {(['all', 'active', 'expired'] as const).map(f => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Expirados'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><p>Sem compras {filter !== 'all' ? 'neste filtro' : ''}.</p></div>
      ) : (
        <div className="list">
          {filtered.map(p => {
            const isExpired = p.endDate < now;
            const daysLeft = Math.ceil((p.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className={`list-row ${isExpired || p.status !== 'active' ? 'inactive' : ''}`}>
                <ShoppingBag size={20} style={{ color: isExpired ? 'var(--error)' : 'var(--primary)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong>{p.planName}</strong>
                    <span className={`badge badge-${p.status === 'active' && !isExpired ? 'success' : 'error'}`}>
                      {isExpired ? 'Expirado' : p.status === 'active' ? 'Ativo' : 'Pausado'}
                    </span>
                    {!isExpired && daysLeft <= 7 && <span className="badge badge-warning">{daysLeft}d restantes</span>}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                    {p.userEmail} · {p.locationName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span><Calendar size={11} /> {p.startDate?.toLocaleDateString('pt-PT')} → {p.endDate?.toLocaleDateString('pt-PT')}</span>
                    <span><Clock size={11} /> {p.sessionsUsed}/{p.sessionsTotal} aulas usadas ({p.sessionsRemaining} restantes)</span>
                    <span>{p.priceMonthly?.toFixed(0)}€</span>
                  </div>

                  {/* Inline edit */}
                  {isEditing && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Válido até</label>
                        <input type="date" className="input" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} style={{ width: 150 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Total sessões</label>
                        <input type="number" className="input" value={newSessions} onChange={e => setNewSessions(e.target.value)} style={{ width: 80 }} />
                      </div>
                      <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: '0.875rem' }}>
                        {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={14} /> Guardar</>}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)} style={{ marginTop: '0.875rem' }}><X size={14} /></button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => startEdit(p)} disabled={!!editingId && editingId !== p.id} title="Ajustar validade"><Edit2 size={14} /></button>
                  <button className={`btn btn-sm ${p.status === 'active' ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleStatus(p.id, p.status)} title={p.status === 'active' ? 'Pausar' : 'Reativar'}>
                    {p.status === 'active' ? <AlertTriangle size={14} /> : <Check size={14} />}
                  </button>
                  <button className="btn btn-sm btn-danger-outline" onClick={() => setConfirmDelete(p)} title="Apagar compra"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <AlertTriangle size={22} color="var(--error)" />
              <h3 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '1.125rem' }}>Apagar compra</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
              Vais apagar a compra <strong>{confirmDelete.planName}</strong> de <strong>{confirmDelete.userEmail}</strong>.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Esta ação remove o documento do Firestore e não pode ser desfeita. As inscrições em aulas associadas a este pacote ficam órfãs (não devolvem créditos no cancelamento).
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
        .list { display: flex; flex-direction: column; gap: 0.5rem; }
        .btn-danger-outline { background: white; color: var(--error); border: 1.5px solid var(--error); }
        .btn-danger-outline:hover { background: var(--error); color: white; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-box { background: white; border-radius: var(--radius-xl); padding: 1.75rem; max-width: 420px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .list-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: flex-start; gap: 1rem; box-shadow: var(--shadow-sm); }
        .list-row.inactive { opacity: 0.6; }
        .list-row:hover { box-shadow: var(--shadow-md); }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }
        .filter-btn { background: none; border: none; padding: 0.375rem 0.75rem; font-family: var(--font-body); font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .filter-btn.active { background: var(--primary); color: white; }
        @media (max-width: 768px) { .list-row { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
}
