import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { YogaService } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, GripVertical, Check } from 'lucide-react';

const emptyService: Omit<YogaService, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', description: '', price: 0, duration: '', type: 'single',
  isPopular: false, isActive: true, features: [], order: 0,
};

export function AdminServices() {
  const [services, setServices] = useState<YogaService[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => { loadServices(); }, []);

  const loadServices = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'services'), orderBy('order')));
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as YogaService)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startNew = () => {
    setEditing('new');
    setEditData({ ...emptyService, order: services.length });
  };

  const startEdit = (service: YogaService) => {
    setEditing(service.id);
    setEditData({ ...service });
  };

  const cancelEdit = () => { setEditing(null); setEditData(null); setNewFeature(''); };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'services')).id : editing!;
      const data = {
        ...editData,
        price: Number(editData.price),
        order: Number(editData.order),
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      };
      delete data.id;
      await setDoc(doc(db, 'services', id), data);
      await loadServices();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este serviço?')) return;
    await deleteDoc(doc(db, 'services', id));
    await loadServices();
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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Gere os serviços e preços que aparecem no site.</p>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Serviço</button>
      </div>

      {/* Edit Form */}
      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Serviço' : 'Editar Serviço'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Nome</label>
              <input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Aula Individual" />
            </div>
            <div className="form-group">
              <label className="label">Tipo</label>
              <select className="input" value={editData.type} onChange={e => setEditData({ ...editData, type: e.target.value })}>
                <option value="single">Aula Única</option>
                <option value="pack">Pack de Aulas</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Preço (€)</label>
              <input className="input" type="number" step="0.01" value={editData.price} onChange={e => setEditData({ ...editData, price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Duração / Descrição preço</label>
              <input className="input" value={editData.duration} onChange={e => setEditData({ ...editData, duration: e.target.value })} placeholder="60 min / Pack 5 aulas" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Descrição</label>
            <textarea className="input textarea" rows={2} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="label">Características incluídas</label>
            {editData.features.map((f: string, i: number) => (
              <div key={i} className="array-item">
                <span style={{ flex: 1, padding: '0.5rem 0' }}>{f}</span>
                <button className="btn-icon" onClick={() => removeFeature(i)}><X size={14} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="input" value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())} placeholder="Nova característica..." />
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
              Ativo (visível no site)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name || !editData.price}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Services List */}
      <div className="services-list">
        {services.length === 0 && !editing ? (
          <div className="empty-state">
            <p>Ainda não tens serviços. Cria o primeiro!</p>
          </div>
        ) : (
          services.map(s => (
            <div key={s.id} className={`service-row ${!s.isActive ? 'inactive' : ''}`}>
              <div className="service-row-info">
                <GripVertical size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>{s.name}</strong>
                    {s.isPopular && <span className="badge badge-primary">Popular</span>}
                    {!s.isActive && <span className="badge badge-warning">Inativo</span>}
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{s.description}</span>
                </div>
              </div>
              <div className="service-row-price">
                <strong>{s.price.toFixed(2).replace('.', ',')}€</strong>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{s.duration}</span>
              </div>
              <div className="service-row-actions">
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(s)} disabled={!!editing}><Edit2 size={14} /> Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)} disabled={!!editing}><Trash2 size={14} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .edit-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 1.5rem; border: 2px solid var(--primary-light); }
        .edit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .edit-header h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .array-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid var(--beige); }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; transition: all var(--transition-fast); }
        .btn-icon:hover { border-color: var(--error); color: var(--error); }
        .services-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .service-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); transition: all var(--transition-fast); }
        .service-row.inactive { opacity: 0.6; }
        .service-row:hover { box-shadow: var(--shadow-md); }
        .service-row-info { display: flex; align-items: center; gap: 0.75rem; flex: 1; }
        .service-row-price { text-align: right; min-width: 80px; }
        .service-row-actions { display: flex; gap: 0.5rem; }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }

        @media (max-width: 768px) {
          .edit-grid { grid-template-columns: 1fr; }
          .service-row { flex-wrap: wrap; }
          .service-row-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
