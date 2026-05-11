import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { PromoCode, Plan } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, Tag, Copy, Check } from 'lucide-react';

const emptyPromo = {
  code: '', discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: 0, isActive: true, maxUses: 0, currentUses: 0,
  expiresAt: '', applicablePlans: [] as string[], minPurchaseAmount: 0,
};

export function AdminPromoCodes() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [promosSnap, plansSnap, redemptionsSnap] = await Promise.all([
        getDocs(collection(db, 'promoCodes')),
        getDocs(query(collection(db, 'plans'), orderBy('order'))),
        getDocs(collection(db, 'promoCodeRedemptions')).catch(() => ({ docs: [] })),
      ]);

      // Count actual redemptions per promoCodeId
      const redemptionCounts: Record<string, number> = {};
      (redemptionsSnap as any).docs.forEach((d: any) => {
        const id = d.data().promoCodeId;
        if (id) redemptionCounts[id] = (redemptionCounts[id] || 0) + 1;
      });

      const promoList = promosSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          currentUses: redemptionCounts[d.id] ?? data.currentUses ?? 0,
          expiresAt: data.expiresAt?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate()
        } as PromoCode;
      }).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      setPromos(promoList);
      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startNew = () => { setEditing('new'); setEditData({ ...emptyPromo }); };
  const startEdit = (p: PromoCode) => {
    setEditing(p.id);
    setEditData({ ...p, expiresAt: p.expiresAt ? p.expiresAt.toISOString().slice(0, 10) : '' });
  };
  const cancelEdit = () => { setEditing(null); setEditData(null); };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'JOY';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setEditData({ ...editData, code });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const togglePlan = (planId: string) => {
    const current = editData.applicablePlans || [];
    if (current.includes(planId)) {
      setEditData({ ...editData, applicablePlans: current.filter((id: string) => id !== planId) });
    } else {
      setEditData({ ...editData, applicablePlans: [...current, planId] });
    }
  };

  const handleSave = async () => {
    if (!editData || !editData.code) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'promoCodes')).id : editing!;
      const data: any = {
        code: editData.code.toUpperCase().trim(),
        discountType: editData.discountType,
        discountValue: Number(editData.discountValue),
        isActive: editData.isActive,
        maxUses: Number(editData.maxUses) || 0,
        currentUses: editing === 'new' ? 0 : (editData.currentUses || 0),
        applicablePlans: editData.applicablePlans || [],
        minPurchaseAmount: Number(editData.minPurchaseAmount) || 0,
        updatedAt: new Date(),
      };
      if (editData.expiresAt) data.expiresAt = new Date(editData.expiresAt);
      if (editing === 'new') data.createdAt = new Date();
      await setDoc(doc(db, 'promoCodes', id), data);
      await loadData();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este código promo?')) return;
    await deleteDoc(doc(db, 'promoCodes', id));
    await loadData();
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Códigos promocionais para descontos no checkout.</p>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Código</button>
      </div>

      {/* Edit Form */}
      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Código Promo' : 'Editar Código'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Código</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="input" value={editData.code} onChange={e => setEditData({ ...editData, code: e.target.value.toUpperCase() })} placeholder="JOYXMAS25" style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }} />
                <button className="btn btn-sm btn-secondary" onClick={generateCode} title="Gerar código">Gerar</button>
              </div>
            </div>
            <div className="form-group">
              <label className="label">Tipo de Desconto</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="input" value={editData.discountType} onChange={e => setEditData({ ...editData, discountType: e.target.value })} style={{ width: 150 }}>
                  <option value="percentage">Percentagem (%)</option>
                  <option value="fixed">Valor fixo (€)</option>
                </select>
                <input className="input" type="number" step="0.01" value={editData.discountValue || ''} onChange={e => setEditData({ ...editData, discountValue: e.target.value })} placeholder={editData.discountType === 'percentage' ? '10' : '5'} style={{ width: 100 }} />
                <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>{editData.discountType === 'percentage' ? '%' : '€'}</span>
              </div>
            </div>
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Máximo de usos (0 = ilimitado)</label>
              <input className="input" type="number" value={editData.maxUses || ''} onChange={e => setEditData({ ...editData, maxUses: e.target.value })} placeholder="0" style={{ width: 120 }} />
            </div>
            <div className="form-group">
              <label className="label">Expira em</label>
              <input className="input" type="date" value={editData.expiresAt || ''} onChange={e => setEditData({ ...editData, expiresAt: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Valor mínimo de compra (€)</label>
            <input className="input" type="number" step="0.01" value={editData.minPurchaseAmount || ''} onChange={e => setEditData({ ...editData, minPurchaseAmount: e.target.value })} placeholder="0 = sem mínimo" style={{ width: 150 }} />
          </div>

          {plans.length > 0 && (
            <div className="form-group">
              <label className="label">Aplicável a (vazio = todos os planos)</label>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {plans.filter(p => p.isActive).map(p => (
                  <button key={p.id} className={`plan-chip ${(editData.applicablePlans || []).includes(p.id) ? 'active' : ''}`} onClick={() => togglePlan(p.id)}>
                    {(editData.applicablePlans || []).includes(p.id) ? <Check size={12} /> : <Plus size={12} />} {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} /> Ativo
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.code || !editData.discountValue}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      {promos.length === 0 && !editing ? (
        <div className="empty-state"><p>Sem códigos promo. Cria o primeiro!</p></div>
      ) : (
        <div className="list">
          {promos.map(p => {
            const isExpired = p.expiresAt && p.expiresAt < new Date();
            const isMaxed = p.maxUses > 0 && p.currentUses >= p.maxUses;
            return (
              <div key={p.id} className={`list-row ${!p.isActive || isExpired || isMaxed ? 'inactive' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  <Tag size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '0.05em' }}>{p.code}</strong>
                      <button className="copy-btn" onClick={() => copyCode(p.code)} title="Copiar código">
                        {copied === p.code ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      {!p.isActive && <span className="badge badge-warning">Inativo</span>}
                      {isExpired && <span className="badge badge-error">Expirado</span>}
                      {isMaxed && <span className="badge badge-error">Esgotado</span>}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', marginTop: '0.125rem' }}>
                      <span>{p.discountType === 'percentage' ? `${p.discountValue}%` : `${p.discountValue}€`} desconto</span>
                      {p.expiresAt && <span>Expira: {p.expiresAt.toLocaleDateString('pt-PT')}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{p.currentUses}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {p.maxUses > 0 ? `de ${p.maxUses}` : 'usos'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => startEdit(p)} disabled={!!editing}><Edit2 size={14} /></button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)} disabled={!!editing}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .edit-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 1.5rem; border: 2px solid var(--primary-light); }
        .edit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .edit-header h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; }
        .list { display: flex; flex-direction: column; gap: 0.5rem; }
        .list-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
        .list-row.inactive { opacity: 0.6; }
        .list-row:hover { box-shadow: var(--shadow-md); }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }
        .copy-btn { background: none; border: 1px solid var(--sand); border-radius: var(--radius-sm); padding: 0.2rem 0.375rem; cursor: pointer; color: var(--text-muted); display: inline-flex; align-items: center; }
        .copy-btn:hover { border-color: var(--primary); color: var(--primary); }
        .plan-chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.3rem 0.625rem; border-radius: 999px; border: 1.5px solid var(--sand); background: white; font-size: 0.8125rem; font-family: var(--font-body); color: var(--text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .plan-chip:hover { border-color: var(--primary); }
        .plan-chip.active { background: var(--primary); color: white; border-color: var(--primary); }
        @media (max-width: 768px) { .edit-grid { grid-template-columns: 1fr; } .list-row { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
}
