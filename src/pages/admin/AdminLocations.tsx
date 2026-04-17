import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Location } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, MapPin, Users, EuroIcon } from 'lucide-react';

const emptyLocation = {
  name: '', address: '', description: '', photoUrl: '', costPerSession: 0, dropInPrice: 0,
  capacity: 10, amenities: [] as string[], mapUrl: '', isActive: true, order: 0,
};

export function AdminLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newAmenity, setNewAmenity] = useState('');

  useEffect(() => { loadLocations(); }, []);

  const loadLocations = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'locations'), orderBy('order')));
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as Location)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startNew = () => {
    setEditing('new');
    setEditData({ ...emptyLocation, order: locations.length });
  };

  const startEdit = (loc: Location) => { setEditing(loc.id); setEditData({ ...loc }); };
  const cancelEdit = () => { setEditing(null); setEditData(null); setNewAmenity(''); };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'locations')).id : editing!;
      const data = {
        ...editData,
        costPerSession: Number(editData.costPerSession),
        dropInPrice: Number(editData.dropInPrice),
        capacity: Number(editData.capacity),
        order: Number(editData.order),
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      };
      delete data.id;
      await setDoc(doc(db, 'locations', id), data);
      await loadLocations();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este espaço? Os planos associados poderão ficar sem espaço.')) return;
    await deleteDoc(doc(db, 'locations', id));
    await loadLocations();
  };

  const addAmenity = () => {
    if (!newAmenity.trim() || !editData) return;
    setEditData({ ...editData, amenities: [...editData.amenities, newAmenity.trim()] });
    setNewAmenity('');
  };

  const removeAmenity = (i: number) => {
    if (!editData) return;
    setEditData({ ...editData, amenities: editData.amenities.filter((_: any, idx: number) => idx !== i) });
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Gere os espaços onde dás aulas. Cada plano é ligado a um espaço.</p>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Espaço</button>
      </div>

      {/* Edit Form */}
      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Espaço' : 'Editar Espaço'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Nome do Espaço</label>
              <input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Estúdio Luz Interior" />
            </div>
            <div className="form-group">
              <label className="label">Morada</label>
              <input className="input" value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} placeholder="Rua do Yoga, 123, Lisboa" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Descrição</label>
            <textarea className="input textarea" rows={3} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="Descreve o espaço..." />
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Custo por sessão (interno, €)</label>
              <input className="input" type="number" step="0.01" value={editData.costPerSession} onChange={e => setEditData({ ...editData, costPerSession: e.target.value })} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Só visível para ti. Quanto pagas pelo espaço por aula.</span>
            </div>
            <div className="form-group">
              <label className="label">Preço Aula Avulsa (€)</label>
              <input className="input" type="number" step="0.01" value={editData.dropInPrice || ''} onChange={e => setEditData({ ...editData, dropInPrice: e.target.value })} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Preço público para quem compra 1 aula sem plano.</span>
            </div>
            <div className="form-group">
              <label className="label">Capacidade (alunos)</label>
              <input className="input" type="number" value={editData.capacity} onChange={e => setEditData({ ...editData, capacity: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">URL da Foto (opcional)</label>
              <input className="input" value={editData.photoUrl || ''} onChange={e => setEditData({ ...editData, photoUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label className="label">URL Google Maps (opcional)</label>
              <input className="input" value={editData.mapUrl || ''} onChange={e => setEditData({ ...editData, mapUrl: e.target.value })} placeholder="https://maps.google.com/..." />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Comodidades</label>
            {editData.amenities.map((a: string, i: number) => (
              <div key={i} className="array-item">
                <span style={{ flex: 1, padding: '0.375rem 0' }}>{a}</span>
                <button className="btn-icon-sm" onClick={() => removeAmenity(i)}><X size={14} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="input" value={newAmenity} onChange={e => setNewAmenity(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAmenity())} placeholder="Ex: Tapetes incluídos, Estacionamento..." />
              <button className="btn btn-sm btn-secondary" onClick={addAmenity}><Plus size={16} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Ordem</label>
              <input className="input" type="number" value={editData.order} onChange={e => setEditData({ ...editData, order: e.target.value })} style={{ width: 80 }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.5rem' }}>
              <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} />
              Ativo (visível no site)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Locations List */}
      {locations.length === 0 && !editing ? (
        <div className="empty-state"><p>Ainda não tens espaços. Cria o primeiro!</p></div>
      ) : (
        <div className="list">
          {locations.map(loc => (
            <div key={loc.id} className={`list-row ${!loc.isActive ? 'inactive' : ''}`}>
              {loc.photoUrl ? (
                <img src={loc.photoUrl} alt={loc.name} className="list-photo" />
              ) : (
                <div className="list-photo-placeholder"><MapPin size={20} /></div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>{loc.name}</strong>
                  {!loc.isActive && <span className="badge badge-warning">Inativo</span>}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {loc.address}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Capacidade</div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}><Users size={14} /> {loc.capacity}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Custo</div>
                  <div style={{ fontWeight: 600 }}>{(loc.costPerSession || 0).toFixed(0)}€</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avulsa</div>
                  <div style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>{(loc.dropInPrice || 0).toFixed(0)}€</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(loc)} disabled={!!editing}><Edit2 size={14} /> Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(loc.id)} disabled={!!editing}><Trash2 size={14} /></button>
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
        .list { display: flex; flex-direction: column; gap: 0.5rem; }
        .list-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); transition: all var(--transition-fast); }
        .list-row.inactive { opacity: 0.6; }
        .list-row:hover { box-shadow: var(--shadow-md); }
        .list-photo { width: 56px; height: 56px; border-radius: var(--radius-lg); object-fit: cover; flex-shrink: 0; }
        .list-photo-placeholder { width: 56px; height: 56px; border-radius: var(--radius-lg); background: var(--beige); display: flex; align-items: center; justify-content: center; color: var(--text-muted); flex-shrink: 0; }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }

        @media (max-width: 768px) {
          .edit-grid { grid-template-columns: 1fr; }
          .list-row { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
