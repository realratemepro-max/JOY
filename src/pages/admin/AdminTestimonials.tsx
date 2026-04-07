import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Testimonial } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, Star } from 'lucide-react';

export function AdminTestimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTestimonials(); }, []);

  const loadTestimonials = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'testimonials'), orderBy('order')));
      setTestimonials(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() } as Testimonial)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startNew = () => {
    setEditing('new');
    setEditData({ name: '', text: '', rating: 5, photo: '', isActive: true, order: testimonials.length });
  };

  const startEdit = (t: Testimonial) => { setEditing(t.id); setEditData({ ...t }); };
  const cancelEdit = () => { setEditing(null); setEditData(null); };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'testimonials')).id : editing!;
      const data = { ...editData, rating: Number(editData.rating), order: Number(editData.order), createdAt: editing === 'new' ? new Date() : editData.createdAt };
      delete data.id;
      await setDoc(doc(db, 'testimonials', id), data);
      await loadTestimonials();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este testemunho?')) return;
    await deleteDoc(doc(db, 'testimonials', id));
    await loadTestimonials();
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Testemunhos visíveis na landing page.</p>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Testemunho</button>
      </div>

      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Testemunho' : 'Editar Testemunho'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>
          <div className="edit-grid">
            <div className="form-group"><label className="label">Nome</label><input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Nome do aluno" /></div>
            <div className="form-group">
              <label className="label">Avaliação</label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setEditData({ ...editData, rating: n })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                    <Star size={24} fill={n <= editData.rating ? '#f59e0b' : 'none'} color={n <= editData.rating ? '#f59e0b' : '#d1d5db'} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="form-group"><label className="label">Texto</label><textarea className="input textarea" rows={4} value={editData.text} onChange={e => setEditData({ ...editData, text: e.target.value })} placeholder="O que o aluno disse..." /></div>
          <div className="edit-grid">
            <div className="form-group"><label className="label">URL Foto (opcional)</label><input className="input" value={editData.photo || ''} onChange={e => setEditData({ ...editData, photo: e.target.value })} placeholder="https://..." /></div>
            <div className="form-group"><label className="label">Ordem</label><input className="input" type="number" value={editData.order} onChange={e => setEditData({ ...editData, order: e.target.value })} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} />
            Ativo (visível no site)
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name || !editData.text}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {testimonials.length === 0 && !editing ? (
        <div className="empty-state"><p>Sem testemunhos. Adiciona o primeiro!</p></div>
      ) : (
        <div className="testimonials-list">
          {testimonials.map(t => (
            <div key={t.id} className={`testimonial-row ${!t.isActive ? 'inactive' : ''}`}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <strong>{t.name}</strong>
                  <div style={{ display: 'flex', gap: '0.125rem' }}>
                    {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < t.rating ? '#f59e0b' : 'none'} color={i < t.rating ? '#f59e0b' : '#d1d5db'} />)}
                  </div>
                  {!t.isActive && <span className="badge badge-warning">Inativo</span>}
                </div>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>"{t.text.substring(0, 120)}{t.text.length > 120 ? '...' : ''}"</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(t)} disabled={!!editing}><Edit2 size={14} /></button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)} disabled={!!editing}><Trash2 size={14} /></button>
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
        .testimonials-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .testimonial-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
        .testimonial-row.inactive { opacity: 0.6; }
        .testimonial-row:hover { box-shadow: var(--shadow-md); }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }

        @media (max-width: 768px) { .edit-grid { grid-template-columns: 1fr; } .testimonial-row { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
}
