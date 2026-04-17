import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Professor } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, User } from 'lucide-react';

export function AdminProfessors() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProfessors(); }, []);

  const loadProfessors = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'professors'), orderBy('name')));
      setProfessors(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as Professor)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startNew = () => { setEditing('new'); setEditData({ name: '', style: '', age: '', bio: '', photoUrl: '', isActive: true }); };
  const startEdit = (p: Professor) => { setEditing(p.id); setEditData({ ...p }); };
  const cancelEdit = () => { setEditing(null); setEditData(null); };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'professors')).id : editing!;
      const data = { name: editData.name, style: editData.style, age: editData.age ? Number(editData.age) : null, bio: editData.bio, photoUrl: editData.photoUrl || '', isActive: editData.isActive, createdAt: editing === 'new' ? new Date() : editData.createdAt, updatedAt: new Date() };
      await setDoc(doc(db, 'professors', id), data);
      await loadProfessors();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este professor?')) return;
    await deleteDoc(doc(db, 'professors', id));
    await loadProfessors();
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Professores que dão aulas nos teus espaços.</p>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Professor</button>
      </div>

      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Professor' : 'Editar Professor'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>
          <div className="edit-grid">
            <div className="form-group"><label className="label">Nome</label><input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Joaquim Oliveira" /></div>
            <div className="form-group"><label className="label">Estilo de Yoga</label><input className="input" value={editData.style} onChange={e => setEditData({ ...editData, style: e.target.value })} placeholder="Vinyasa, Hatha, Yin..." /></div>
            <div className="form-group"><label className="label">Idade</label><input className="input" type="number" value={editData.age || ''} onChange={e => setEditData({ ...editData, age: e.target.value })} style={{ width: 100 }} /></div>
            <div className="form-group"><label className="label">URL Foto</label><input className="input" value={editData.photoUrl || ''} onChange={e => setEditData({ ...editData, photoUrl: e.target.value })} placeholder="https://..." /></div>
          </div>
          <div className="form-group"><label className="label">Biografia</label><textarea className="input textarea" rows={4} value={editData.bio} onChange={e => setEditData({ ...editData, bio: e.target.value })} placeholder="Formação, experiência, filosofia..." /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} /> Ativo
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {professors.length === 0 && !editing ? (
        <div className="empty-state"><p>Sem professores. Adiciona o primeiro!</p></div>
      ) : (
        <div className="list">
          {professors.map(p => (
            <div key={p.id} className={`list-row ${!p.isActive ? 'inactive' : ''}`}>
              {p.photoUrl ? <img src={p.photoUrl} alt={p.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--primary-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={20} /></div>}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>{p.name}</strong>
                  {!p.isActive && <span className="badge badge-warning">Inativo</span>}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{p.style}{p.age ? ` · ${p.age} anos` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(p)} disabled={!!editing}><Edit2 size={14} /></button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)} disabled={!!editing}><Trash2 size={14} /></button>
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
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; }
        .list { display: flex; flex-direction: column; gap: 0.5rem; }
        .list-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
        .list-row.inactive { opacity: 0.6; }
        .list-row:hover { box-shadow: var(--shadow-md); }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }
        @media (max-width: 768px) { .edit-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
