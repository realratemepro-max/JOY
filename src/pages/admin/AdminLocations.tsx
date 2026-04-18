import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Location, Session } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, MapPin, Users, ChevronLeft, ChevronRight, Check, Clock, Calendar } from 'lucide-react';
import { ImageUpload } from '../../components/ImageUpload';

const emptyLocation = {
  name: '', address: '', description: '', photoUrl: '', costPerSession: 0,
  costMonthlyPerSlot: 0, isExternal: false, externalRatePerHour: 0,
  capacity: 10, amenities: [] as string[], mapUrl: '', isActive: true, order: 0,
};

export function AdminLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newAmenity, setNewAmenity] = useState('');

  // Detail modal
  const [detailLoc, setDetailLoc] = useState<Location | null>(null);
  const [detailMonth, setDetailMonth] = useState(new Date());
  const [paidMonths, setPaidMonths] = useState<Record<string, boolean>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [locsSnap, sessSnap] = await Promise.all([
        getDocs(query(collection(db, 'locations'), orderBy('order'))),
        getDocs(query(collection(db, 'sessions'), orderBy('date', 'asc'))),
      ]);
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as Location)));
      setSessions(sessSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Session;
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadLocations = loadData;

  const getMonthKey = (locId: string, date: Date) => `${locId}_${date.getFullYear()}-${date.getMonth()}`;

  const togglePaid = async (locId: string) => {
    const key = getMonthKey(locId, detailMonth);
    const newVal = !paidMonths[key];
    setPaidMonths(prev => ({ ...prev, [key]: newVal }));
    // Persist to Firestore
    try {
      await setDoc(doc(db, 'locationPayments', key), {
        locationId: locId,
        month: detailMonth.getMonth() + 1,
        year: detailMonth.getFullYear(),
        paid: newVal,
        updatedAt: new Date(),
      });
    } catch (err) { console.error(err); }
  };

  // Load paid status
  useEffect(() => {
    const loadPaidStatus = async () => {
      try {
        const snap = await getDocs(collection(db, 'locationPayments'));
        const paid: Record<string, boolean> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.paid) paid[d.id] = true;
        });
        setPaidMonths(paid);
      } catch (err) { console.error(err); }
    };
    loadPaidStatus();
  }, []);

  const getLocationMonthSessions = (locId: string) => {
    const monthStart = new Date(detailMonth.getFullYear(), detailMonth.getMonth(), 1);
    const monthEnd = new Date(detailMonth.getFullYear(), detailMonth.getMonth() + 1, 0, 23, 59, 59);
    return sessions.filter(s => s.locationId === locId && s.date >= monthStart && s.date <= monthEnd).sort((a, b) => a.date.getTime() - b.date.getTime());
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
        isExternal: editData.isExternal || false,
        costPerSession: Number(editData.costPerSession || 0),
        costMonthlyPerSlot: Number(editData.costMonthlyPerSlot || 0),
        externalRatePerHour: Number(editData.externalRatePerHour || 0),
        capacity: Number(editData.capacity || 0),
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

          {/* Type toggle */}
          <div className="form-group">
            <label className="label">Tipo de Espaço</label>
            <div className="space-type-toggle">
              <button className={`space-type-btn ${!editData.isExternal ? 'active' : ''}`} onClick={() => setEditData({ ...editData, isExternal: false })}>
                <MapPin size={16} /> <strong>Meu Espaço</strong>
                <small>Espaço que geres e onde vendes planos</small>
              </button>
              <button className={`space-type-btn external ${editData.isExternal ? 'active' : ''}`} onClick={() => setEditData({ ...editData, isExternal: true })}>
                <MapPin size={16} /> <strong>Espaço Externo</strong>
                <small>Onde dás aulas mas não geres</small>
              </button>
            </div>
          </div>

          <div className="edit-grid">
            <div className="form-group">
              <label className="label">Nome do Espaço</label>
              <input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder={editData.isExternal ? 'Ginásio X, Estúdio Y...' : 'Estúdio Luz Interior'} />
            </div>
            <div className="form-group">
              <label className="label">Morada</label>
              <input className="input" value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} placeholder="Rua do Yoga, 123" />
            </div>
          </div>

          {!editData.isExternal && (
            <div className="form-group">
              <label className="label">Descrição</label>
              <textarea className="input textarea" rows={3} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="Descreve o espaço..." />
            </div>
          )}

          {editData.isExternal ? (
            /* External space: just rate per hour */
            <div className="edit-grid">
              <div className="form-group">
                <label className="label">Valor que recebes (€/hora)</label>
                <input className="input" type="number" step="0.5" value={editData.externalRatePerHour || ''} onChange={e => setEditData({ ...editData, externalRatePerHour: e.target.value })} placeholder="15" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Quanto te pagam por hora neste espaço.</span>
              </div>
            </div>
          ) : (
            /* Internal space: costs + capacity */
            <>
              <div className="edit-grid">
                <div className="form-group">
                  <label className="label">Custo mensal por horário (€/mês)</label>
                  <input className="input" type="number" step="0.01" value={editData.costMonthlyPerSlot || ''} onChange={e => setEditData({ ...editData, costMonthlyPerSlot: e.target.value })} placeholder="30" />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Valor fixo mensal por cada horário semanal.</span>
                </div>
                <div className="form-group">
                  <label className="label">Capacidade (alunos)</label>
                  <input className="input" type="number" value={editData.capacity} onChange={e => setEditData({ ...editData, capacity: e.target.value })} />
                </div>
              </div>

              <div className="edit-grid">
                <div className="form-group">
                  <ImageUpload value={editData.photoUrl || ''} onChange={url => setEditData({ ...editData, photoUrl: url })} folder="locations" label="Foto do Espaço" />
                </div>
                <div className="form-group">
                  <label className="label">URL Google Maps (opcional)</label>
                  <input className="input" value={editData.mapUrl || ''} onChange={e => setEditData({ ...editData, mapUrl: e.target.value })} placeholder="https://maps.google.com/..." />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Comodidades</label>
                {(editData.amenities || []).map((a: string, i: number) => (
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
            </>
          )}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Ordem</label>
              <input className="input" type="number" value={editData.order} onChange={e => setEditData({ ...editData, order: e.target.value })} style={{ width: 80 }} />
            </div>
            {!editData.isExternal && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.5rem' }}>
                <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} />
                Ativo (visível no site)
              </label>
            )}
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
            <div key={loc.id} className={`list-row ${!loc.isActive && !loc.isExternal ? 'inactive' : ''}`} onClick={() => { if (!editing) { setDetailLoc(loc); setDetailMonth(new Date()); } }} style={{ cursor: editing ? 'default' : 'pointer' }}>
              {loc.photoUrl ? (
                <img src={loc.photoUrl} alt={loc.name} className="list-photo" />
              ) : (
                <div className="list-photo-placeholder"><MapPin size={20} /></div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>{loc.name}</strong>
                  {loc.isExternal && <span className="badge badge-accent">Externo</span>}
                  {!loc.isActive && !loc.isExternal && <span className="badge badge-warning">Inativo</span>}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {loc.address}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                {loc.isExternal ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recebes</div>
                    <div style={{ fontWeight: 600 }}>{(loc.externalRatePerHour || 0).toFixed(0)}€/h</div>
                  </div>
                ) : (
                  <>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Capacidade</div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}><Users size={14} /> {loc.capacity}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>€/mês/slot</div>
                      <div style={{ fontWeight: 600 }}>{(loc.costMonthlyPerSlot || loc.costPerSession || 0).toFixed(0)}€</div>
                      {loc.costMonthlyPerSlot > 0 && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          ≈ {(loc.costMonthlyPerSlot / 4).toFixed(1)}€–{(loc.costMonthlyPerSlot / 5).toFixed(1)}€/aula
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(loc)} disabled={!!editing}><Edit2 size={14} /> Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(loc.id)} disabled={!!editing}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Location Detail Modal */}
      {detailLoc && (() => {
        const loc = detailLoc;
        const locSessions = getLocationMonthSessions(loc.id);
        const completed = locSessions.filter(s => s.status === 'completed');
        const scheduled = locSessions.filter(s => s.status === 'scheduled');
        const cancelled = locSessions.filter(s => s.status === 'cancelled');
        const isExt = loc.isExternal;
        const rate = loc.externalRatePerHour || 0;
        const calcVal = (s: Session) => isExt ? (rate * (s.duration || 60) / 60) : 0;
        const earned = completed.reduce((sum, s) => sum + calcVal(s), 0);
        const projected = earned + scheduled.reduce((sum, s) => sum + calcVal(s), 0);
        const monthKey = getMonthKey(loc.id, detailMonth);
        const isPaid = paidMonths[monthKey] || false;

        // For internal spaces: count weekly slots and monthly cost
        const weeklySlots = new Set(locSessions.map(s => s.date.getDay())).size;
        const monthlyCost = (loc.costMonthlyPerSlot || 0) * weeklySlots;

        return (
          <div className="modal-overlay" onClick={() => setDetailLoc(null)}>
            <div className="detail-modal" onClick={e => e.stopPropagation()}>
              <div className="detail-modal-header">
                <div>
                  <h3>{loc.name}</h3>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{loc.address}</span>
                </div>
                <button className="btn-icon" onClick={() => setDetailLoc(null)}><X size={18} /></button>
              </div>

              {/* Month navigation */}
              <div className="detail-month-nav">
                <button className="btn btn-sm btn-secondary" onClick={() => { const d = new Date(detailMonth); d.setMonth(d.getMonth() - 1); setDetailMonth(d); }}><ChevronLeft size={14} /></button>
                <span className="detail-month-label">{detailMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</span>
                <button className="btn btn-sm btn-secondary" onClick={() => { const d = new Date(detailMonth); d.setMonth(d.getMonth() + 1); setDetailMonth(d); }}><ChevronRight size={14} /></button>
              </div>

              {/* Stats */}
              <div className="detail-stats">
                <div className="detail-stat-card">
                  <Calendar size={16} />
                  <span className="detail-stat-val">{locSessions.length}</span>
                  <span className="detail-stat-lbl">Total Aulas</span>
                </div>
                <div className="detail-stat-card">
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span className="detail-stat-val">{completed.length}</span>
                  <span className="detail-stat-lbl">Concluídas</span>
                </div>
                <div className="detail-stat-card">
                  <Clock size={16} style={{ color: 'var(--primary)' }} />
                  <span className="detail-stat-val">{scheduled.length}</span>
                  <span className="detail-stat-lbl">Agendadas</span>
                </div>
                {isExt ? (
                  <>
                    <div className="detail-stat-card highlight">
                      <span className="detail-stat-val" style={{ color: 'var(--success)' }}>{earned.toFixed(0)}€</span>
                      <span className="detail-stat-lbl">Ganho</span>
                    </div>
                    <div className="detail-stat-card">
                      <span className="detail-stat-val" style={{ color: 'var(--primary)' }}>{projected.toFixed(0)}€</span>
                      <span className="detail-stat-lbl">Previsto</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="detail-stat-card">
                      <span className="detail-stat-val">{weeklySlots}</span>
                      <span className="detail-stat-lbl">Slots/semana</span>
                    </div>
                    <div className="detail-stat-card highlight">
                      <span className="detail-stat-val" style={{ color: 'var(--error)' }}>{monthlyCost.toFixed(0)}€</span>
                      <span className="detail-stat-lbl">Custo mês</span>
                    </div>
                  </>
                )}
              </div>

              {/* Sessions table */}
              {locSessions.length > 0 ? (
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Horário</th>
                      <th>Duração</th>
                      {!isExt && <th>Alunos</th>}
                      <th>Estado</th>
                      {isExt && <th>Valor</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {locSessions.map(s => (
                      <tr key={s.id} className={s.status === 'cancelled' ? 'row-cancelled' : ''}>
                        <td>{s.date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                        <td>{s.startTime} - {s.endTime}</td>
                        <td>{s.duration || 60}min</td>
                        {!isExt && <td>{s.enrolledStudents.filter(st => st.status !== 'cancelled').length}/{s.maxCapacity}</td>}
                        <td>
                          <span className={`badge badge-sm badge-${s.status === 'completed' ? 'success' : s.status === 'cancelled' ? 'error' : 'primary'}`}>
                            {s.status === 'completed' ? 'Feita' : s.status === 'cancelled' ? 'Cancelada' : 'Agendada'}
                          </span>
                        </td>
                        {isExt && (
                          <td style={{ fontWeight: 600, color: s.status === 'cancelled' ? 'var(--text-muted)' : 'var(--success)' }}>
                            {s.status === 'cancelled' ? '—' : `${calcVal(s).toFixed(0)}€`}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sem aulas neste mês</div>
              )}

              {/* Paid toggle - for external spaces */}
              {isExt && locSessions.length > 0 && (
                <div className="paid-toggle-section">
                  <div className="paid-info">
                    <span style={{ fontWeight: 600 }}>Total a receber:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{projected.toFixed(0)}€</span>
                  </div>
                  <button className={`btn ${isPaid ? 'btn-success' : 'btn-secondary'} paid-btn`} onClick={() => togglePaid(loc.id)}>
                    {isPaid ? <><Check size={16} /> Recebido</> : 'Marcar como recebido'}
                  </button>
                </div>
              )}

              {/* Cost summary - for internal spaces */}
              {!isExt && locSessions.length > 0 && (
                <div className="paid-toggle-section">
                  <div className="paid-info">
                    <span style={{ fontWeight: 600 }}>Custo do mês:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>{monthlyCost.toFixed(0)}€</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({weeklySlots} slot{weeklySlots > 1 ? 's' : ''} × {(loc.costMonthlyPerSlot || 0).toFixed(0)}€)</span>
                  </div>
                  <button className={`btn ${isPaid ? 'btn-success' : 'btn-secondary'} paid-btn`} onClick={() => togglePaid(loc.id)}>
                    {isPaid ? <><Check size={16} /> Pago</> : 'Marcar como pago'}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
        .list-row:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .detail-modal { background: white; border-radius: var(--radius-xl); width: 100%; max-width: 640px; max-height: 85vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
        .detail-modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--beige); }
        .detail-modal-header h3 { margin: 0; font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; }

        .detail-month-nav { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 1rem 1.5rem; }
        .detail-month-label { font-weight: 600; font-size: 0.9375rem; min-width: 160px; text-align: center; text-transform: capitalize; }

        .detail-stats { display: flex; gap: 0.5rem; padding: 0 1.5rem 1rem; flex-wrap: wrap; }
        .detail-stat-card { flex: 1; min-width: 80px; text-align: center; padding: 0.625rem 0.5rem; background: var(--bg-secondary); border-radius: var(--radius-lg); }
        .detail-stat-card.highlight { background: rgba(124,154,114,0.08); }
        .detail-stat-val { display: block; font-size: 1.125rem; font-weight: 700; font-family: var(--font-heading); }
        .detail-stat-lbl { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }

        .detail-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
        .detail-table th { text-align: left; padding: 0.5rem 1.5rem; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 2px solid var(--beige); background: var(--bg-secondary); }
        .detail-table td { padding: 0.5rem 1.5rem; border-bottom: 1px solid var(--beige); }
        .detail-table .row-cancelled { opacity: 0.5; }
        .badge-sm { font-size: 0.625rem; padding: 0.125rem 0.375rem; }

        .paid-toggle-section { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-top: 2px solid var(--beige); background: var(--bg-secondary); border-radius: 0 0 var(--radius-xl) var(--radius-xl); }
        .paid-info { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .paid-btn { min-width: 160px; justify-content: center; }
        .btn-success { background: var(--success); color: white; border-color: var(--success); }
        .btn-success:hover { opacity: 0.9; }

        .space-type-toggle { display: flex; gap: 0.75rem; }
        .space-type-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.75rem; border: 2px solid var(--sand); border-radius: var(--radius-lg); background: white; cursor: pointer; transition: all var(--transition-fast); }
        .space-type-btn strong { font-size: 0.875rem; }
        .space-type-btn small { font-size: 0.6875rem; color: var(--text-muted); }
        .space-type-btn:hover { border-color: var(--primary); }
        .space-type-btn.active { border-color: var(--primary); background: rgba(124,154,114,0.08); }
        .space-type-btn.external.active { border-color: var(--accent); background: rgba(193,127,89,0.08); }
        .badge-accent { background: rgba(193,127,89,0.15); color: var(--accent); }

        @media (max-width: 768px) {
          .edit-grid { grid-template-columns: 1fr; }
          .list-row { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
