import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { YogaEvent, Location } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, Calendar, MapPin, Users, Clock } from 'lucide-react';
import { ImageUpload } from '../../components/ImageUpload';

export function AdminEvents() {
  const [events, setEvents] = useState<YogaEvent[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [eventsSnap, locsSnap] = await Promise.all([
        getDocs(query(collection(db, 'events'), orderBy('date', 'desc'))),
        getDocs(query(collection(db, 'locations'), orderBy('order'))),
      ]);
      setEvents(eventsSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as YogaEvent;
      }));
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startNew = () => {
    const loc = locations.find(l => l.isActive);
    setEditing('new');
    setEditData({
      name: '', description: '', longDescription: '', photoUrl: '',
      locationId: loc?.id || '', locationName: loc?.name || '',
      date: '', startTime: '09:00', endTime: '11:00',
      price: 0, capacity: 20, enrolledCount: 0,
      features: [], isActive: true,
    });
  };

  const startEdit = (ev: YogaEvent) => {
    setEditing(ev.id);
    setEditData({
      ...ev,
      date: ev.date ? ev.date.toISOString().split('T')[0] : '',
    });
  };

  const cancelEdit = () => { setEditing(null); setEditData(null); setNewFeature(''); };

  const handleLocationChange = (locationId: string) => {
    const loc = locations.find(l => l.id === locationId);
    setEditData({ ...editData, locationId, locationName: loc?.name || '' });
  };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'events')).id : editing!;
      const eventDate = editData.date ? new Date(editData.date + 'T' + editData.startTime) : new Date();
      const data = {
        name: editData.name,
        description: editData.description,
        longDescription: editData.longDescription || '',
        photoUrl: editData.photoUrl || '',
        locationId: editData.locationId,
        locationName: editData.locationName,
        date: eventDate,
        startTime: editData.startTime,
        endTime: editData.endTime,
        price: Number(editData.price),
        capacity: Number(editData.capacity),
        enrolledCount: editData.enrolledCount || 0,
        features: editData.features || [],
        isActive: editData.isActive,
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'events', id), data);
      await loadData();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este evento?')) return;
    await deleteDoc(doc(db, 'events', id));
    await loadData();
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

  const now = new Date();
  const upcoming = events.filter(e => e.date >= now && e.isActive);
  const past = events.filter(e => e.date < now || !e.isActive);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Eventos únicos: workshops, aulas especiais, retiros, etc.</p>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Evento</button>
      </div>

      {/* Edit Form */}
      {editing && editData && (
        <div className="edit-card">
          <div className="edit-header">
            <h3>{editing === 'new' ? 'Novo Evento' : 'Editar Evento'}</h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>

          <div className="form-group">
            <label className="label">Nome do Evento</label>
            <input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Yoga ao Pôr do Sol na Praia" />
          </div>

          <div className="form-group">
            <label className="label">Descrição</label>
            <textarea className="input textarea" rows={2} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="Descrição breve..." />
          </div>

          <div className="form-group">
            <label className="label">Descrição detalhada (opcional)</label>
            <textarea className="input textarea" rows={3} value={editData.longDescription || ''} onChange={e => setEditData({ ...editData, longDescription: e.target.value })} placeholder="Detalhes completos do evento..." />
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Espaço</label>
              <select className="input" value={editData.locationId} onChange={e => handleLocationChange(e.target.value)}>
                <option value="">Selecionar...</option>
                {locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Data</label>
              <input className="input" type="date" value={editData.date} onChange={e => setEditData({ ...editData, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Hora Início</label>
              <input className="input" type="time" value={editData.startTime} onChange={e => setEditData({ ...editData, startTime: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Hora Fim</label>
              <input className="input" type="time" value={editData.endTime} onChange={e => setEditData({ ...editData, endTime: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Preço (€)</label>
              <input className="input" type="number" step="0.01" value={editData.price} onChange={e => setEditData({ ...editData, price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Capacidade</label>
              <input className="input" type="number" value={editData.capacity} onChange={e => setEditData({ ...editData, capacity: e.target.value })} />
            </div>
          </div>

          <ImageUpload value={editData.photoUrl || ''} onChange={url => setEditData({ ...editData, photoUrl: url })} folder="events" label="Foto do Evento" />

          <div className="form-group">
            <label className="label">O que inclui</label>
            {editData.features.map((f: string, i: number) => (
              <div key={i} className="array-item"><span style={{ flex: 1, padding: '0.375rem 0' }}>{f}</span><button className="btn-icon-sm" onClick={() => removeFeature(i)}><X size={14} /></button></div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="input" value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())} placeholder="Ex: Tapete incluído, Chá oferecido..." />
              <button className="btn btn-sm btn-secondary" onClick={addFeature}><Plus size={16} /></button>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} />
            Ativo (visível no site)
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name || !editData.date || !editData.price}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Events List */}
      {upcoming.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--primary-dark)' }}>Próximos Eventos</h3>
          <div className="events-list">
            {upcoming.map(ev => (
              <EventRow key={ev.id} event={ev} onEdit={() => startEdit(ev)} onDelete={() => handleDelete(ev.id)} disabled={!!editing} />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, margin: '1.5rem 0 0.75rem', color: 'var(--text-secondary)' }}>Passados / Inativos</h3>
          <div className="events-list">
            {past.map(ev => (
              <EventRow key={ev.id} event={ev} onEdit={() => startEdit(ev)} onDelete={() => handleDelete(ev.id)} disabled={!!editing} isPast />
            ))}
          </div>
        </>
      )}

      {events.length === 0 && !editing && (
        <div className="empty-state"><p>Sem eventos. Cria o primeiro!</p></div>
      )}

      <style>{`
        .edit-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 1.5rem; border: 2px solid var(--primary-light); }
        .edit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .edit-header h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; }
        .btn-icon-sm { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0.25rem; }
        .array-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid var(--beige); }
        .events-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }

        @media (max-width: 768px) { .edit-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function EventRow({ event, onEdit, onDelete, disabled, isPast }: { event: YogaEvent; onEdit: () => void; onDelete: () => void; disabled: boolean; isPast?: boolean }) {
  const spotsLeft = event.capacity - event.enrolledCount;
  return (
    <div className={`event-row ${isPast ? 'past' : ''}`}>
      {event.photoUrl ? (
        <img src={event.photoUrl} alt={event.name} style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
          <Calendar size={24} />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong>{event.name}</strong>
          {!event.isActive && <span className="badge badge-warning">Inativo</span>}
          {spotsLeft <= 3 && spotsLeft > 0 && <span className="badge badge-warning">Últimas {spotsLeft} vagas</span>}
          {spotsLeft <= 0 && <span className="badge badge-error">Esgotado</span>}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={12} /> {event.date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /> {event.startTime}-{event.endTime}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={12} /> {event.locationName}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Users size={12} /> {event.enrolledCount}/{event.capacity}</span>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: '1.125rem', minWidth: 70, textAlign: 'right' }}>{event.price.toFixed(0)}€</div>
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <button className="btn btn-sm btn-secondary" onClick={onEdit} disabled={disabled}><Edit2 size={14} /></button>
        <button className="btn btn-sm btn-danger" onClick={onDelete} disabled={disabled}><Trash2 size={14} /></button>
      </div>

      <style>{`
        .event-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
        .event-row:hover { box-shadow: var(--shadow-md); }
        .event-row.past { opacity: 0.6; }
        @media (max-width: 768px) { .event-row { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
}
