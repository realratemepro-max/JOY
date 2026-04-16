import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Plan, Location, ScheduleSlot } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, Calendar, MapPin, Clock } from 'lucide-react';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const emptyPlan = {
  name: '', description: '', longDescription: '', locationId: '', locationName: '',
  sessionsPerWeek: 1, sessionDuration: 60, priceMonthly: 0,
  schedule: [] as ScheduleSlot[], type: 'private' as const,
  maxStudents: undefined as number | undefined, features: [] as string[],
  isPopular: false, isActive: true, order: 0,
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
    setEditing('new');
    const loc = locations.find(l => l.isActive);
    setEditData({
      ...emptyPlan,
      order: plans.length,
      locationId: loc?.id || '',
      locationName: loc?.name || '',
    });
  };

  const startEdit = (plan: Plan) => { setEditing(plan.id); setEditData({ ...plan }); };
  const cancelEdit = () => { setEditing(null); setEditData(null); setNewFeature(''); };

  const handleLocationChange = (locationId: string) => {
    const loc = locations.find(l => l.id === locationId);
    setEditData({ ...editData, locationId, locationName: loc?.name || '' });
  };

  const addScheduleSlot = () => {
    if (!editData) return;
    setEditData({
      ...editData,
      schedule: [...editData.schedule, { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }],
    });
  };

  const updateScheduleSlot = (i: number, field: keyof ScheduleSlot, value: any) => {
    if (!editData) return;
    const schedule = [...editData.schedule];
    schedule[i] = { ...schedule[i], [field]: field === 'dayOfWeek' ? Number(value) : value };
    setEditData({ ...editData, schedule });
  };

  const removeScheduleSlot = (i: number) => {
    if (!editData) return;
    setEditData({ ...editData, schedule: editData.schedule.filter((_: any, idx: number) => idx !== i) });
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
        ...editData,
        sessionsPerWeek: Number(editData.sessionsPerWeek),
        sessionDuration: Number(editData.sessionDuration),
        priceMonthly: Number(editData.priceMonthly),
        maxStudents: editData.maxStudents ? Number(editData.maxStudents) : null,
        order: Number(editData.order),
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      };
      delete data.id;
      await setDoc(doc(db, 'plans', id), data);
      await loadData();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este plano? As subscrições ativas poderão ficar sem plano.')) return;
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
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Planos de aulas ligados a espaços. Aparecem na landing page e no checkout.</p>
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
              <input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="1x/semana no Estúdio Luz" />
            </div>
            <div className="form-group">
              <label className="label">Espaço</label>
              <select className="input" value={editData.locationId} onChange={e => handleLocationChange(e.target.value)}>
                <option value="">Selecionar espaço...</option>
                {locations.filter(l => l.isActive).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Descrição</label>
            <textarea className="input textarea" rows={2} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="Descrição breve para o card de preços..." />
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Tipo</label>
              <select className="input" value={editData.type} onChange={e => setEditData({ ...editData, type: e.target.value })}>
                <option value="private">Particular</option>
                <option value="group">Grupo</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Preço Mensal (€)</label>
              <input className="input" type="number" step="0.01" value={editData.priceMonthly} onChange={e => setEditData({ ...editData, priceMonthly: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Sessões por Semana</label>
              <select className="input" value={editData.sessionsPerWeek} onChange={e => setEditData({ ...editData, sessionsPerWeek: e.target.value })}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}x por semana</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Duração da Sessão (min)</label>
              <select className="input" value={editData.sessionDuration} onChange={e => setEditData({ ...editData, sessionDuration: e.target.value })}>
                {[45, 60, 75, 90, 120].map(n => <option key={n} value={n}>{n} minutos</option>)}
              </select>
            </div>
          </div>

          {editData.type === 'group' && (
            <div className="form-group">
              <label className="label">Máximo de alunos</label>
              <input className="input" type="number" value={editData.maxStudents || ''} onChange={e => setEditData({ ...editData, maxStudents: e.target.value })} style={{ width: 120 }} />
            </div>
          )}

          {/* Schedule */}
          <div className="form-group">
            <label className="label"><Calendar size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> Horário Semanal</label>
            {editData.schedule.map((slot: ScheduleSlot, i: number) => (
              <div key={i} className="schedule-row">
                <select className="input" value={slot.dayOfWeek} onChange={e => updateScheduleSlot(i, 'dayOfWeek', e.target.value)} style={{ width: 130 }}>
                  {DAY_NAMES_FULL.map((day, idx) => <option key={idx} value={idx}>{day}</option>)}
                </select>
                <input type="time" className="input" value={slot.startTime} onChange={e => updateScheduleSlot(i, 'startTime', e.target.value)} style={{ width: 120 }} />
                <span style={{ color: 'var(--text-muted)' }}>-</span>
                <input type="time" className="input" value={slot.endTime} onChange={e => updateScheduleSlot(i, 'endTime', e.target.value)} style={{ width: 120 }} />
                <button className="btn-icon-sm" onClick={() => removeScheduleSlot(i)}><X size={16} /></button>
              </div>
            ))}
            <button className="btn btn-sm btn-secondary" onClick={addScheduleSlot}><Plus size={16} /> Adicionar Horário</button>
          </div>

          {/* Features */}
          <div className="form-group">
            <label className="label">Características incluídas</label>
            {editData.features.map((f: string, i: number) => (
              <div key={i} className="array-item">
                <span style={{ flex: 1, padding: '0.375rem 0' }}>{f}</span>
                <button className="btn-icon-sm" onClick={() => removeFeature(i)}><X size={14} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="input" value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())} placeholder="Ex: Prática personalizada, Material incluído..." />
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
              Mais Popular (destaque)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.5rem' }}>
              <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} />
              Ativo
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name || !editData.locationId || !editData.priceMonthly}>
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
                  {!plan.isActive && <span className="badge badge-warning">Inativo</span>}
                  <span className="badge" style={{ background: plan.type === 'private' ? '#dbeafe' : '#dcfce7', color: plan.type === 'private' ? '#1e40af' : '#166534' }}>
                    {plan.type === 'private' ? 'Particular' : 'Grupo'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <span><MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {plan.locationName}</span>
                  <span><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {plan.sessionsPerWeek}x/sem</span>
                  <span><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {plan.sessionDuration}min</span>
                  {plan.schedule.length > 0 && (
                    <span>{plan.schedule.map(s => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}`).join(', ')}</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 100 }}>
                <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{plan.priceMonthly.toFixed(2).replace('.', ',')}€</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>/mês</span>
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
        .schedule-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
        .array-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid var(--beige); }
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
