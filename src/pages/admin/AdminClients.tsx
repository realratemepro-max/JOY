import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Client } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, Search, UserCheck, UserX } from 'lucide-react';

export function AdminClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'clients'), orderBy('createdAt', 'desc')));
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as Client)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startNew = () => {
    setEditing('new');
    setEditData({ name: '', email: '', phone: '', notes: '', totalSpent: 0, sessionsRemaining: 0, totalSessions: 0, status: 'lead' });
  };

  const startEdit = (c: Client) => { setEditing(c.id); setEditData({ ...c }); };
  const cancelEdit = () => { setEditing(null); setEditData(null); };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'clients')).id : editing!;
      const data = { ...editData, totalSpent: Number(editData.totalSpent), sessionsRemaining: Number(editData.sessionsRemaining), totalSessions: Number(editData.totalSessions), createdAt: editing === 'new' ? new Date() : editData.createdAt, updatedAt: new Date() };
      delete data.id;
      await setDoc(doc(db, 'clients', id), data);
      await loadClients();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este cliente?')) return;
    await deleteDoc(doc(db, 'clients', id));
    await loadClients();
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: '2.5rem' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar clientes..." />
        </div>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Cliente</button>
      </div>

      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Cliente' : 'Editar Cliente'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>
          <div className="edit-grid">
            <div className="form-group"><label className="label">Nome</label><input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} /></div>
            <div className="form-group"><label className="label">Email</label><input className="input" type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} /></div>
            <div className="form-group"><label className="label">Telefone</label><input className="input" value={editData.phone || ''} onChange={e => setEditData({ ...editData, phone: e.target.value })} /></div>
            <div className="form-group">
              <label className="label">Status</label>
              <select className="input" value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })}>
                <option value="lead">Lead</option>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div className="form-group"><label className="label">Sessões Restantes</label><input className="input" type="number" value={editData.sessionsRemaining} onChange={e => setEditData({ ...editData, sessionsRemaining: e.target.value })} /></div>
            <div className="form-group"><label className="label">Total de Sessões</label><input className="input" type="number" value={editData.totalSessions} onChange={e => setEditData({ ...editData, totalSessions: e.target.value })} /></div>
          </div>
          <div className="form-group"><label className="label">Notas</label><textarea className="input textarea" rows={3} value={editData.notes || ''} onChange={e => setEditData({ ...editData, notes: e.target.value })} placeholder="Observações sobre o cliente..." /></div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state"><p>Sem clientes{search ? ' encontrados' : '. Adiciona o primeiro!'}</p></div>
      ) : (
        <div className="clients-list">
          {filtered.map(c => (
            <div key={c.id} className="client-row">
              <div className="client-avatar">{c.name.charAt(0).toUpperCase()}</div>
              <div className="client-info" style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>{c.name}</strong>
                  <span className={`badge badge-${c.status === 'active' ? 'success' : c.status === 'lead' ? 'warning' : 'error'}`}>
                    {c.status === 'active' ? 'Ativo' : c.status === 'lead' ? 'Lead' : 'Inativo'}
                  </span>
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{c.email}{c.phone ? ` | ${c.phone}` : ''}</span>
              </div>
              <div style={{ textAlign: 'right', minWidth: 120 }}>
                <div style={{ fontWeight: 600 }}>{c.sessionsRemaining} sessões</div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Total: {c.totalSpent.toFixed(2).replace('.', ',')}€</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(c)} disabled={!!editing}><Edit2 size={14} /></button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)} disabled={!!editing}><Trash2 size={14} /></button>
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
        .clients-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .client-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
        .client-row:hover { box-shadow: var(--shadow-md); }
        .client-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }

        @media (max-width: 768px) {
          .edit-grid { grid-template-columns: 1fr; }
          .client-row { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
