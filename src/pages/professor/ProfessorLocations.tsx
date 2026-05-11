import React, { useEffect, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PersonalLocation, PersonalPaymentType, OccupancyTier } from '../../types';
import { MapPin, Plus, Edit2, Trash2, X, Save, Info } from 'lucide-react';

const EMPTY: Omit<PersonalLocation, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  address: '',
  notes: '',
  defaultPaymentType: 'fixed',
  defaultFixedAmount: undefined,
  defaultRatePerStudent: undefined,
  defaultOccupancyTiers: undefined,
};

const DEFAULT_TIERS: OccupancyTier[] = [
  { minPct: 1, maxPct: 25, amount: 0 },
  { minPct: 26, maxPct: 50, amount: 0 },
  { minPct: 51, maxPct: 75, amount: 0 },
  { minPct: 76, maxPct: 100, amount: 0 },
];

export function ProfessorLocations() {
  const { professorData } = useAuth();
  const [locations, setLocations] = useState<PersonalLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; editing: PersonalLocation | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ ...EMPTY });
  const [tiers, setTiers] = useState<OccupancyTier[]>([...DEFAULT_TIERS]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const colRef = () => collection(db, 'professors', professorData!.id, 'personalLocations');

  useEffect(() => {
    if (!professorData) return;
    load();
  }, [professorData]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(colRef(), orderBy('createdAt', 'asc')));
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as PersonalLocation)));
    } finally { setLoading(false); }
  };

  const openCreate = () => { setForm({ ...EMPTY }); setTiers([...DEFAULT_TIERS]); setModal({ open: true, editing: null }); };
  const openEdit = (loc: PersonalLocation) => {
    setForm({
      name: loc.name,
      address: loc.address || '',
      notes: loc.notes || '',
      defaultPaymentType: loc.defaultPaymentType,
      defaultFixedAmount: loc.defaultFixedAmount,
      defaultRatePerStudent: loc.defaultRatePerStudent,
    });
    setTiers(loc.defaultOccupancyTiers?.length ? loc.defaultOccupancyTiers.map(t => ({ ...t })) : [...DEFAULT_TIERS]);
    setModal({ open: true, editing: loc });
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        address: form.address?.trim() || '',
        notes: form.notes?.trim() || '',
        defaultPaymentType: form.defaultPaymentType,
        defaultFixedAmount: form.defaultFixedAmount ? Number(form.defaultFixedAmount) : null,
        defaultRatePerStudent: form.defaultRatePerStudent ? Number(form.defaultRatePerStudent) : null,
        defaultOccupancyTiers: form.defaultPaymentType === 'per_occupancy' ? tiers : null,
        updatedAt: serverTimestamp(),
      };
      if (modal.editing) {
        await updateDoc(doc(db, 'professors', professorData!.id, 'personalLocations', modal.editing.id), data);
      } else {
        await addDoc(colRef(), { ...data, createdAt: serverTimestamp() });
      }
      setModal({ open: false, editing: null });
      load();
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await deleteDoc(doc(db, 'professors', professorData!.id, 'personalLocations', deleteId));
    setDeleteId(null);
    load();
  };

  const paymentLabel = (loc: PersonalLocation) => {
    if (loc.defaultPaymentType === 'fixed') return loc.defaultFixedAmount ? `${loc.defaultFixedAmount}€/aula` : 'Fixo';
    if (loc.defaultPaymentType === 'per_student') return loc.defaultRatePerStudent ? `${loc.defaultRatePerStudent}€/aluno` : 'Por aluno';
    if (loc.defaultPaymentType === 'per_occupancy') return `Por ocupação (${loc.defaultOccupancyTiers?.length || 0} escalões)`;
    return 'Manual';
  };

  if (!professorData) return null;

  return (
    <div>
      {/* Privacy banner */}
      <div className="pl-privacy-banner">
        <Info size={16} />
        <span>Esta área é <strong>completamente pessoal</strong>. Os teus espaços e dados não são partilhados com o estúdio.</span>
      </div>

      <div className="pl-header">
        <div>
          <h2 className="pl-title"><MapPin size={20} color="var(--accent)" /> Meus Espaços</h2>
          <p className="pl-subtitle">Espaços onde dás aulas — externos ao estúdio</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Novo Espaço</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : locations.length === 0 ? (
        <div className="pl-empty">
          <MapPin size={40} color="var(--text-muted)" />
          <p>Ainda não adicionaste nenhum espaço pessoal.</p>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Adicionar Espaço</button>
        </div>
      ) : (
        <div className="pl-grid">
          {locations.map(loc => (
            <div key={loc.id} className="pl-card">
              <div className="pl-card-header">
                <div className="pl-card-icon"><MapPin size={20} color="var(--accent)" /></div>
                <div className="pl-card-actions">
                  <button className="pl-icon-btn" onClick={() => openEdit(loc)} title="Editar"><Edit2 size={15} /></button>
                  <button className="pl-icon-btn pl-icon-btn-danger" onClick={() => setDeleteId(loc.id)} title="Eliminar"><Trash2 size={15} /></button>
                </div>
              </div>
              <h3 className="pl-card-name">{loc.name}</h3>
              {loc.address && <p className="pl-card-address">{loc.address}</p>}
              <div className="pl-card-badge">{paymentLabel(loc)}</div>
              {loc.notes && <p className="pl-card-notes">{loc.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal.open && (
        <div className="modal-overlay" onClick={() => setModal({ open: false, editing: null })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.editing ? 'Editar Espaço' : 'Novo Espaço'}</h3>
              <button className="modal-close" onClick={() => setModal({ open: false, editing: null })}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <label className="form-label">Nome *</label>
              <input className="form-input" placeholder="Ex: Ginásio Central, Klid, Parque da Cidade" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

              <label className="form-label" style={{ marginTop: '1rem' }}>Morada</label>
              <input className="form-input" placeholder="Rua, cidade..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />

              <label className="form-label" style={{ marginTop: '1rem' }}>Tipo de pagamento padrão</label>
              <div className="pl-radio-group">
                {([['fixed', 'Fixo por aula'], ['per_student', 'Por aluno'], ['per_occupancy', 'Por % de ocupação'], ['manual', 'Manual (entrada após aula)']] as [PersonalPaymentType, string][]).map(([val, label]) => (
                  <label key={val} className={`pl-radio${form.defaultPaymentType === val ? ' active' : ''}`}>
                    <input type="radio" name="payType" value={val} checked={form.defaultPaymentType === val} onChange={() => setForm({ ...form, defaultPaymentType: val })} />
                    {label}
                  </label>
                ))}
              </div>

              {form.defaultPaymentType === 'fixed' && (
                <>
                  <label className="form-label" style={{ marginTop: '1rem' }}>Valor por aula (€)</label>
                  <input className="form-input" type="number" min="0" step="0.5" placeholder="0.00" value={form.defaultFixedAmount ?? ''} onChange={e => setForm({ ...form, defaultFixedAmount: e.target.value ? Number(e.target.value) : undefined })} />
                </>
              )}
              {form.defaultPaymentType === 'per_student' && (
                <>
                  <label className="form-label" style={{ marginTop: '1rem' }}>Valor por aluno (€)</label>
                  <input className="form-input" type="number" min="0" step="0.5" placeholder="0.00" value={form.defaultRatePerStudent ?? ''} onChange={e => setForm({ ...form, defaultRatePerStudent: e.target.value ? Number(e.target.value) : undefined })} />
                </>
              )}
              {form.defaultPaymentType === 'per_occupancy' && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Escalões de ocupação</label>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setTiers(prev => [...prev, { minPct: 0, maxPct: 100, amount: 0 }])}>
                      <Plus size={13} /> Escalão
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tiers.map((tier, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0.625rem' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>De (%)</label>
                          <input className="form-input" type="number" min="0" max="100" value={tier.minPct} onChange={e => setTiers(prev => prev.map((t, j) => j === i ? { ...t, minPct: Number(e.target.value) } : t))} style={{ padding: '0.5rem' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Até (%)</label>
                          <input className="form-input" type="number" min="0" max="100" value={tier.maxPct} onChange={e => setTiers(prev => prev.map((t, j) => j === i ? { ...t, maxPct: Number(e.target.value) } : t))} style={{ padding: '0.5rem' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Valor (€)</label>
                          <input className="form-input" type="number" min="0" step="0.5" value={tier.amount} onChange={e => setTiers(prev => prev.map((t, j) => j === i ? { ...t, amount: Number(e.target.value) } : t))} style={{ padding: '0.5rem' }} />
                        </div>
                        <button type="button" className="pl-icon-btn pl-icon-btn-danger" style={{ marginTop: 18 }} onClick={() => setTiers(prev => prev.filter((_, j) => j !== i))}><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    A % de ocupação é calculada com base nos alunos previstos vs. presentes em cada aula.
                  </p>
                </div>
              )}

              <label className="form-label" style={{ marginTop: '1rem' }}>Notas</label>
              <textarea className="form-input" rows={2} placeholder="Observações sobre este espaço..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal({ open: false, editing: null })}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                <Save size={16} /> {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Eliminar Espaço</h3><button className="modal-close" onClick={() => setDeleteId(null)}><X size={20} /></button></div>
            <div className="modal-body"><p>Tens a certeza? As aulas registadas neste espaço não serão eliminadas.</p></div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pl-privacy-banner {
          display: flex; align-items: center; gap: 0.625rem;
          background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: var(--radius-lg);
          padding: 0.75rem 1rem; margin-bottom: 1.5rem;
          font-size: 0.875rem; color: #1e40af;
        }
        .pl-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .pl-title { font-family: var(--font-body); font-size: 1.25rem; font-weight: 600; margin: 0 0 0.25rem; display: flex; align-items: center; gap: 0.5rem; }
        .pl-subtitle { font-size: 0.875rem; color: var(--text-secondary); margin: 0; }
        .pl-empty { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 4rem 2rem; background: white; border-radius: var(--radius-xl); text-align: center; color: var(--text-muted); }
        .pl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
        .pl-card { background: white; border-radius: var(--radius-xl); padding: 1.25rem; box-shadow: var(--shadow-sm); border: 1.5px solid var(--beige); }
        .pl-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
        .pl-card-icon { width: 36px; height: 36px; border-radius: var(--radius-md); background: rgba(193,127,89,0.1); display: flex; align-items: center; justify-content: center; }
        .pl-card-actions { display: flex; gap: 0.375rem; }
        .pl-icon-btn { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; transition: background 0.15s; }
        .pl-icon-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
        .pl-icon-btn-danger:hover { background: #fef2f2; color: var(--error); border-color: #fecaca; }
        .pl-card-name { font-weight: 600; font-size: 1rem; margin: 0 0 0.375rem; }
        .pl-card-address { font-size: 0.8125rem; color: var(--text-muted); margin: 0 0 0.5rem; }
        .pl-card-badge { display: inline-block; padding: 0.2rem 0.625rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: rgba(193,127,89,0.12); color: var(--accent-dark); margin-bottom: 0.5rem; }
        .pl-card-notes { font-size: 0.8125rem; color: var(--text-secondary); margin: 0.5rem 0 0; font-style: italic; }
        .pl-radio-group { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
        .pl-radio { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 0.875rem; border-radius: var(--radius-md); border: 1.5px solid var(--sand); cursor: pointer; font-size: 0.9rem; transition: border-color 0.15s, background 0.15s; }
        .pl-radio.active { border-color: var(--accent); background: rgba(193,127,89,0.06); color: var(--accent-dark); font-weight: 500; }
        .pl-radio input { display: none; }
        @media (max-width: 768px) { .pl-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
