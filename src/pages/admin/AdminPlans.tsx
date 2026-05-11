import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Plan, Location } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, MapPin, Check } from 'lucide-react';

const emptyPlan = {
  name: '', description: '', longDescription: '', locationId: '', locationName: '',
  billingType: 'subscription' as 'subscription' | 'dropin',
  classType: 'group' as 'group' | 'private' | 'both',
  isHybrid: false,
  isContentPlan: false,
  sessionsTotal: 4, validityDays: 30, priceMonthly: 0, pricePerSession: 0,
  features: [] as string[], isPopular: false, isActive: true, order: 0,
};

export function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [plansSnap, locsSnap] = await Promise.all([
        getDocs(query(collection(db, 'plans'), orderBy('order'))),
        getDocs(query(collection(db, 'locations'), orderBy('order'))),
      ]);
      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as Plan)));
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startNew = () => {
    const loc = locations.find(l => l.isActive);
    setEditing('new');
    setEditData({ ...emptyPlan, order: plans.length, locationId: loc?.id || '', locationName: loc?.name || '' });
  };

  const startEdit = (plan: Plan) => { setEditing(plan.id); setEditData({ ...plan }); };
  const cancelEdit = () => { setEditing(null); setEditData(null); setNewFeature(''); };

  const handleLocationChange = (locationId: string) => {
    const loc = locations.find(l => l.id === locationId);
    setEditData({ ...editData, locationId, locationName: loc?.name || '' });
  };

  const addFeature = () => {
    if (!newFeature.trim() || !editData) return;
    setEditData({ ...editData, features: [...editData.features, newFeature.trim()] });
    setNewFeature('');
  };

  const removeFeature = (i: number) => {
    if (!editData) return;
    setEditData({ ...editData, features: editData.features.filter((_: any, idx: number) => idx !== i) });
  };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'plans')).id : editing!;
      const data = {
        name: editData.name,
        description: editData.description,
        longDescription: editData.longDescription || '',
        locationId: editData.locationId,
        locationName: editData.locationName,
        billingType: editData.billingType,
        sessionsTotal: editData.billingType === 'subscription' ? Number(editData.sessionsTotal) : null,
        classType: editData.classType || 'group',
        validityDays: Number(editData.validityDays) || 30,
        priceMonthly: editData.billingType === 'subscription' ? Number(editData.priceMonthly) : null,
        pricePerSession: editData.billingType === 'dropin' ? Number(editData.pricePerSession) : null,
        features: editData.features || [],
        isHybrid: editData.isHybrid || false,
        isContentPlan: editData.isContentPlan || false,
        isPopular: editData.isPopular || false,
        isActive: editData.isActive,
        order: Number(editData.order),
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'plans', id), data);
      await loadData();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este plano?')) return;
    await deleteDoc(doc(db, 'plans', id));
    await loadData();
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  if (locations.length === 0) {
    return (
      <div className="empty-state">
        <MapPin size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.125rem' }}>Cria primeiro um espaço</h3>
        <p>Precisas de pelo menos um espaço para criar planos.</p>
        <a href="/admin/locations" className="btn btn-primary">Ir para Espaços</a>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Planos mensais de subscrição. O horário das aulas é definido nas <a href="/admin/sessions" style={{ fontWeight: 500 }}>Sessões</a>.</p>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>Aulas avulsas (drop-in) são definidas nos <a href="/admin/locations" style={{ fontWeight: 500 }}>Espaços</a>.</p>
        </div>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Plano</button>
      </div>

      {/* Edit Form */}
      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Plano' : 'Editar Plano'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Nome do Plano</label>
              <input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="1x por semana" />
            </div>
            <div className="form-group">
              <label className="label">Espaço</label>
              <select className="input" value={editData.locationId} onChange={e => handleLocationChange(e.target.value)}>
                <option value="">Selecionar...</option>
                {locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Descrição</label>
            <textarea className="input textarea" rows={2} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="Ideal para quem quer começar uma prática regular..." />
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Tipo de Plano</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', padding: '0.5rem 1rem', border: `2px solid ${editData.billingType === 'subscription' ? 'var(--primary)' : 'var(--sand)'}`, borderRadius: 'var(--radius-lg)', background: editData.billingType === 'subscription' ? 'rgba(124,154,114,0.08)' : 'white' }}>
                  <input type="radio" name="billingType" value="subscription" checked={editData.billingType === 'subscription'} onChange={() => setEditData({ ...editData, billingType: 'subscription' })} />
                  <strong>Pack de Aulas</strong>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', padding: '0.5rem 1rem', border: `2px solid ${editData.billingType === 'dropin' ? 'var(--accent)' : 'var(--sand)'}`, borderRadius: 'var(--radius-lg)', background: editData.billingType === 'dropin' ? 'rgba(193,127,89,0.08)' : 'white' }}>
                  <input type="radio" name="billingType" value="dropin" checked={editData.billingType === 'dropin'} onChange={() => setEditData({ ...editData, billingType: 'dropin' })} />
                  <strong>Aula Avulsa</strong>
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="label">Modalidade</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'group', label: 'Grupo', color: 'var(--primary)', bg: 'rgba(124,154,114,0.08)' },
                  { value: 'private', label: 'Privada', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
                  { value: 'both', label: 'Grupo + Privada', color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
                ].map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', padding: '0.5rem 1rem', border: `2px solid ${editData.classType === opt.value ? opt.color : 'var(--sand)'}`, borderRadius: 'var(--radius-lg)', background: editData.classType === opt.value ? opt.bg : 'white' }}>
                    <input type="radio" name="classType" value={opt.value} checked={editData.classType === opt.value} onChange={() => setEditData({ ...editData, classType: opt.value })} />
                    <strong>{opt.label}</strong>
                  </label>
                ))}
              </div>
              {editData.classType === 'private' && <p style={{ fontSize: '0.75rem', color: '#8b5cf6', margin: '0.375rem 0 0' }}>Após compra, cliente agenda a data com o estúdio.</p>}
              {editData.classType === 'both' && <p style={{ fontSize: '0.75rem', color: '#0891b2', margin: '0.375rem 0 0' }}>Plano válido para aulas de grupo e sessões privadas.</p>}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', cursor: 'pointer', padding: '0.5rem 1rem', border: `2px solid ${editData.isHybrid ? '#1d4ed8' : 'var(--sand)'}`, borderRadius: 'var(--radius-lg)', background: editData.isHybrid ? 'rgba(29,78,216,0.08)' : 'white', width: 'fit-content' }}>
                <input type="checkbox" checked={!!editData.isHybrid} onChange={e => setEditData({ ...editData, isHybrid: e.target.checked })} />
                <strong style={{ color: editData.isHybrid ? '#1d4ed8' : 'inherit' }}>Inclui Online (Híbrida)</strong>
              </label>
              {editData.isHybrid && <p style={{ fontSize: '0.75rem', color: '#1d4ed8', margin: '0.375rem 0 0' }}>Plano inclui aulas presenciais e online via Zoom.</p>}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', cursor: 'pointer', padding: '0.5rem 1rem', border: `2px solid ${editData.isContentPlan ? '#7c3aed' : 'var(--sand)'}`, borderRadius: 'var(--radius-lg)', background: editData.isContentPlan ? 'rgba(124,58,237,0.08)' : 'white', width: 'fit-content' }}>
                <input type="checkbox" checked={!!editData.isContentPlan} onChange={e => setEditData({ ...editData, isContentPlan: e.target.checked })} />
                <strong style={{ color: editData.isContentPlan ? '#7c3aed' : 'inherit' }}>Add-on Biblioteca Digital</strong>
              </label>
              {editData.isContentPlan && <p style={{ fontSize: '0.75rem', color: '#7c3aed', margin: '0.375rem 0 0' }}>Dá acesso à Biblioteca Digital (aulas gravadas, meditações). Não inclui aulas presenciais.</p>}
            </div>
          </div>

          {editData.billingType === 'subscription' ? (
            <div className="edit-grid">
              <div className="form-group">
                <label className="label">Número de Sessões</label>
                <select className="input" value={editData.sessionsTotal} onChange={e => setEditData({ ...editData, sessionsTotal: e.target.value })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20].map(n => <option key={n} value={n}>{n} aula{n !== 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Preço (€)</label>
                <input className="input" type="number" min="0" step="0.01" value={editData.priceMonthly} onChange={e => setEditData({ ...editData, priceMonthly: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="label">Preço por Sessão (€)</label>
              <input className="input" type="number" min="0" step="0.01" value={editData.pricePerSession || ''} onChange={e => setEditData({ ...editData, pricePerSession: e.target.value })} style={{ width: 150 }} />
            </div>
          )}

          <div className="form-group">
            <label className="label">Validade (dias após compra)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select className="input" style={{ width: 'auto' }} value={editData.validityDays || 30} onChange={e => setEditData({ ...editData, validityDays: Number(e.target.value) })}>
                {[7, 15, 30, 45, 60, 90, 120, 180, 365].map(d => <option key={d} value={d}>{d} dias{d === 30 ? ' (1 mês)' : d === 90 ? ' (3 meses)' : d === 180 ? ' (6 meses)' : d === 365 ? ' (1 ano)' : ''}</option>)}
              </select>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>desde a data de compra</span>
            </div>
          </div>

          {/* Features */}
          <div className="form-group">
            <label className="label">O que inclui</label>

            {/* Existing features from other plans as toggleable suggestions */}
            {(() => {
              const allFeatures = Array.from(new Set(plans.flatMap(p => p.features || [])));
              const currentFeatures: string[] = editData.features || [];
              const suggestions = allFeatures.filter(f => !currentFeatures.includes(f));
              return (suggestions.length > 0 || currentFeatures.length > 0) ? (
                <div className="feature-chips">
                  {currentFeatures.map((f: string, i: number) => (
                    <button key={`active-${i}`} className="feature-chip active" onClick={() => removeFeature(i)} title="Clica para remover">
                      <Check size={12} /> {f}
                    </button>
                  ))}
                  {suggestions.map((f, i) => (
                    <button key={`sug-${i}`} className="feature-chip" onClick={() => setEditData({ ...editData, features: [...currentFeatures, f] })} title="Clica para adicionar">
                      <Plus size={12} /> {f}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Add new custom feature */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input className="input" value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())} placeholder="Adicionar nova feature..." />
              <button className="btn btn-sm btn-secondary" onClick={addFeature}><Plus size={16} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Ordem</label>
              <input className="input" type="number" value={editData.order} onChange={e => setEditData({ ...editData, order: e.target.value })} style={{ width: 80 }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.5rem' }}>
              <input type="checkbox" checked={editData.isPopular} onChange={e => setEditData({ ...editData, isPopular: e.target.checked })} />
              Mais Popular
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.5rem' }}>
              <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} />
              Ativo
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name || !editData.locationId || (editData.billingType === 'subscription' ? !editData.priceMonthly : !editData.pricePerSession)}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Plans List */}
      {plans.length === 0 && !editing ? (
        <div className="empty-state"><p>Ainda não tens planos. Cria o primeiro!</p></div>
      ) : (
        <div className="list">
          {plans.map(plan => (
            <div key={plan.id} className={`list-row ${!plan.isActive ? 'inactive' : ''}`}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong>{plan.name}</strong>
                  {plan.isPopular && <span className="badge badge-primary">Popular</span>}
                  {(plan as any).classType === 'private' && <span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#6d28d9' }}>Privada</span>}
                  {(plan as any).classType === 'both' && <span className="badge" style={{ background: 'rgba(8,145,178,0.12)', color: '#0e7490' }}>Grupo + Privada</span>}
                  {(plan as any).isHybrid && <span className="badge" style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}>Híbrida</span>}
                  {(plan as any).isContentPlan && <span className="badge" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>Biblioteca</span>}
                  {!plan.isActive && <span className="badge badge-warning">Inativo</span>}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <span><MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {plan.locationName}</span>
                  <span>{plan.billingType === 'dropin' ? 'Aula Avulsa' : `${plan.sessionsTotal || 0} aulas`}</span>
                  {(plan as any).validityDays && <span>· {(plan as any).validityDays} dias</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 100 }}>
                <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{(plan.billingType === 'dropin' ? (plan.pricePerSession || 0) : (plan.priceMonthly || 0)).toFixed(0)}€</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{plan.billingType === 'dropin' ? '/aula' : `/${(plan as any).validityDays || 30}d`}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(plan)} disabled={!!editing}><Edit2 size={14} /></button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(plan.id)} disabled={!!editing}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .edit-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 1.5rem; border: 2px solid var(--primary-light); }
        .edit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .edit-header h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; transition: all var(--transition-fast); }
        .btn-icon:hover { border-color: var(--error); color: var(--error); }
        .btn-icon-sm { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0.25rem; transition: color var(--transition-fast); }
        .btn-icon-sm:hover { color: var(--error); }
        .array-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid var(--beige); }
        .feature-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 0.25rem; }
        .feature-chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.3rem 0.625rem; border-radius: 999px; border: 1.5px solid var(--sand); background: white; font-size: 0.8125rem; font-family: var(--font-body); color: var(--text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .feature-chip:hover { border-color: var(--primary); color: var(--primary-dark); }
        .feature-chip.active { background: var(--primary); color: white; border-color: var(--primary); }
        .feature-chip.active:hover { background: var(--error); border-color: var(--error); }
        .list { display: flex; flex-direction: column; gap: 0.5rem; }
        .list-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); transition: all var(--transition-fast); }
        .list-row.inactive { opacity: 0.6; }
        .list-row:hover { box-shadow: var(--shadow-md); }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }

        @media (max-width: 768px) {
          .edit-grid { grid-template-columns: 1fr; }
          .list-row { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
