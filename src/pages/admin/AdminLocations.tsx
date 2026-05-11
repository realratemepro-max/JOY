import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Location, Session, LocationMonthlyCost } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, MapPin, Users, ChevronLeft, ChevronRight, Check, Clock, Calendar } from 'lucide-react';
import { ImageUpload } from '../../components/ImageUpload';
import { useToast } from '../../components/ToastProvider';

const emptyLocation = {
  name: '', address: '', description: '', photoUrl: '',
  costPerSession: 0, costMonthlyPerSlot: 0, costMonthlyBase: 0, costMonthlyVatPercent: 0,
  capacity: 10, amenities: [] as string[], mapUrl: '', isActive: true, order: 0,
};

export function AdminLocations() {
  const toast = useToast();
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
  const [monthlyCosts, setMonthlyCosts] = useState<Map<string, LocationMonthlyCost>>(new Map());

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

  // Load paid status & monthly costs
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
    loadMonthlyCosts();
  }, []);

  const loadMonthlyCosts = async () => {
    try {
      const snap = await getDocs(collection(db, 'locationMonthlyCosts'));
      const map = new Map<string, LocationMonthlyCost>();
      snap.docs.forEach(d => {
        const data = d.data() as any;
        map.set(d.id, {
          id: d.id,
          locationId: data.locationId,
          year: data.year,
          month: data.month,
          base: Number(data.base || 0),
          vatPercent: Number(data.vatPercent || 0),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        });
      });
      setMonthlyCosts(map);
    } catch (err) { console.error(err); }
  };

  const monthlyKey = (locId: string, date: Date) => `${locId}_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  const saveMonthlyOverride = async (locId: string, date: Date, base: number, vatPercent: number) => {
    const id = monthlyKey(locId, date);
    try {
      await setDoc(doc(db, 'locationMonthlyCosts', id), {
        locationId: locId,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        base,
        vatPercent,
        updatedAt: new Date(),
      });
      await loadMonthlyCosts();
    } catch (err) { console.error(err); }
  };

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
      const original = editing === 'new' ? null : locations.find(l => l.id === editing);
      const data = {
        ...editData,
        costPerSession: Number(editData.costPerSession || 0),
        costMonthlyPerSlot: Number(editData.costMonthlyPerSlot || 0),
        costMonthlyBase: Number(editData.costMonthlyBase || 0),
        costMonthlyVatPercent: Number(editData.costMonthlyVatPercent || 0),
        capacity: Number(editData.capacity || 0),
        order: Number(editData.order),
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      };
      delete data.isExternal;
      delete data.externalRatePerHour;
      delete data.id;
      await setDoc(doc(db, 'locations', id), data);

      // Cascade capacity/name to future sessions at this location
      if (original) {
        const newCapacity = Number(editData.capacity || 0);
        const newName = String(editData.name || '');
        const capacityChanged = newCapacity !== Number(original.capacity || 0);
        const nameChanged = newName !== (original.name || '');
        if (capacityChanged || nameChanged) {
          const now = new Date();
          const affected = sessions.filter(s =>
            s.locationId === id &&
            s.date >= now &&
            s.status !== 'cancelled' &&
            s.status !== 'completed'
          );
          // Warn if reducing capacity would leave sessions over capacity
          if (capacityChanged && newCapacity < Number(original.capacity || 0)) {
            const overCapacity = affected.filter(s => (s.enrolledStudents?.length || 0) > newCapacity);
            if (overCapacity.length > 0) {
              const ok = confirm(
                `${overCapacity.length} aula(s) já têm mais alunos do que a nova capacidade (${newCapacity}). ` +
                `Os alunos extras manter-se-ão inscritos mas a aula ficará acima do limite. Continuar?`
              );
              if (!ok) {
                setSaving(false);
                return;
              }
            }
          }
          if (affected.length > 0) {
            // writeBatch caps at 500 ops — chunk if needed
            for (let i = 0; i < affected.length; i += 400) {
              const batch = writeBatch(db);
              affected.slice(i, i + 400).forEach(s => {
                const update: any = { updatedAt: new Date() };
                if (capacityChanged) update.maxCapacity = newCapacity;
                if (nameChanged) update.locationName = newName;
                batch.update(doc(db, 'sessions', s.id), update);
              });
              await batch.commit();
            }
            toast.success(`Espaço atualizado · ${affected.length} aula(s) futuras sincronizadas.`);
          } else {
            toast.success('Espaço atualizado.');
          }
        }
      }

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
              <input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Sala Principal, Pavilhão Municipal..." />
            </div>
            <div className="form-group">
              <label className="label">Morada</label>
              <input className="input" value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} placeholder="Rua do Yoga, 123" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Descrição</label>
            <textarea className="input textarea" rows={3} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="Descreve o espaço..." />
          </div>

          <div className="edit-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group">
              <label className="label">Renda mensal base (€)</label>
              <input className="input" type="number" min="0" step="0.01" value={editData.costMonthlyBase ?? ''} onChange={e => setEditData({ ...editData, costMonthlyBase: e.target.value })} placeholder="62" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Valor sem IVA (ex: 62€/mês para 2x/semana).
              </span>
            </div>
            <div className="form-group">
              <label className="label">IVA (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.1" value={editData.costMonthlyVatPercent ?? ''} onChange={e => setEditData({ ...editData, costMonthlyVatPercent: e.target.value })} placeholder="23" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Default — pode ser ajustado mês a mês.
              </span>
            </div>
            <div className="form-group">
              <label className="label">Capacidade (alunos)</label>
              <input className="input" type="number" min="1" value={editData.capacity} onChange={e => setEditData({ ...editData, capacity: e.target.value })} />
            </div>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: '#1e40af', marginBottom: '1rem' }}>
            ℹ️ O custo por aula é calculado automaticamente: <strong>(renda + IVA) ÷ aulas realizadas no mês</strong>. Se um mês tiver 4 semanas dá um valor, se tiver 5 semanas dá outro. Podes alterar a renda/IVA de um mês específico no detalhe do espaço.
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
            <div key={loc.id} className={`list-row ${!loc.isActive ? 'inactive' : ''}`} onClick={() => { if (!editing) { setDetailLoc(loc); setDetailMonth(new Date()); } }} style={{ cursor: editing ? 'default' : 'pointer' }}>
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Renda/mês</div>
                  <div style={{ fontWeight: 600 }}>
                    {Number(loc.costMonthlyBase || 0) > 0
                      ? `${(Number(loc.costMonthlyBase) * (1 + Number(loc.costMonthlyVatPercent || 0) / 100)).toFixed(2)}€`
                      : `${(loc.costPerSession || 0).toFixed(2)}€/aula`}
                  </div>
                </div>
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
        const now = new Date();
        const completed = locSessions.filter(s => s.status === 'completed' || (s.status === 'scheduled' && s.date < now));
        const scheduled = locSessions.filter(s => s.status === 'scheduled' && s.date >= now);
        const cancelled = locSessions.filter(s => s.status === 'cancelled');
        const monthKey = getMonthKey(loc.id, detailMonth);
        const isPaid = paidMonths[monthKey] || false;

        // Resolve monthly rent for THIS month (override > location default)
        const mKey = monthlyKey(loc.id, detailMonth);
        const monthOverride = monthlyCosts.get(mKey);
        const effectiveBase = monthOverride?.base ?? Number(loc.costMonthlyBase || 0);
        const effectiveVat = monthOverride?.vatPercent ?? Number(loc.costMonthlyVatPercent || 0);
        const monthlyTotal = effectiveBase * (1 + effectiveVat / 100);

        const billable = locSessions.filter(s => s.status !== 'cancelled');
        const dynamicPerSession = monthlyTotal > 0 && billable.length > 0
          ? monthlyTotal / billable.length
          : Number(loc.costPerSession || 0);

        const effectiveCost = (s: Session): number => {
          const override = (s as any).spaceCost;
          return typeof override === 'number' ? override : dynamicPerSession;
        };
        const monthlyCost = billable.reduce((acc, s) => acc + effectiveCost(s), 0);
        const weeklySlots = new Set(locSessions.map(s => s.date.getDay())).size;

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

              {/* Per-month rent override */}
              <div className="month-rent-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.875rem' }}>Renda deste mês</strong>
                  {monthOverride && <span className="badge badge-warning" style={{ fontSize: '0.625rem' }}>Override</span>}
                  {!monthOverride && Number(loc.costMonthlyBase || 0) > 0 && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>(usar default do espaço)</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Base (€)</span>
                    <input
                      key={`base_${mKey}_${effectiveBase}`}
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={effectiveBase || ''}
                      onBlur={async e => {
                        const newBase = Number(e.target.value || 0);
                        if (newBase === effectiveBase) return;
                        await saveMonthlyOverride(loc.id, detailMonth, newBase, effectiveVat);
                      }}
                      style={{ padding: '0.4rem 0.5rem' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>IVA (%)</span>
                    <input
                      key={`vat_${mKey}_${effectiveVat}`}
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      defaultValue={effectiveVat || ''}
                      onBlur={async e => {
                        const newVat = Number(e.target.value || 0);
                        if (newVat === effectiveVat) return;
                        await saveMonthlyOverride(loc.id, detailMonth, effectiveBase, newVat);
                      }}
                      style={{ padding: '0.4rem 0.5rem' }}
                    />
                  </label>
                  <div style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total mês:</span>{' '}
                    <strong>{monthlyTotal.toFixed(2)}€</strong>
                  </div>
                  <div style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Por aula:</span>{' '}
                    <strong style={{ color: '#1d4ed8' }}>{dynamicPerSession.toFixed(2)}€</strong>
                    {billable.length > 0 && monthlyTotal > 0 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', marginLeft: '0.25rem' }}>
                        ({monthlyTotal.toFixed(2)} ÷ {billable.length})
                      </span>
                    )}
                  </div>
                </div>
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
                <div className="detail-stat-card">
                  <span className="detail-stat-val">{weeklySlots}</span>
                  <span className="detail-stat-lbl">Slots/semana</span>
                </div>
                <div className="detail-stat-card highlight">
                  <span className="detail-stat-val" style={{ color: 'var(--error)' }}>{monthlyCost.toFixed(0)}€</span>
                  <span className="detail-stat-lbl">Custo mês</span>
                </div>
              </div>

              {/* Sessions table */}
              {locSessions.length > 0 ? (
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Horário</th>
                      <th>Alunos</th>
                      <th>Estado</th>
                      <th style={{ width: 110 }}>Custo (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locSessions.map(s => (
                      <tr key={s.id} className={s.status === 'cancelled' ? 'row-cancelled' : ''}>
                        <td>{s.date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                        <td>{s.startTime} - {s.endTime}</td>
                        <td>{s.enrolledStudents.filter(st => st.status !== 'cancelled').length}/{s.maxCapacity}</td>
                        <td>
                          {(() => {
                            const isPast = s.status === 'scheduled' && s.date < now;
                            const effective = s.status === 'completed' || isPast ? 'completed' : s.status;
                            return (
                              <span className={`badge badge-sm badge-${effective === 'completed' ? 'success' : effective === 'cancelled' ? 'error' : 'primary'}`}>
                                {effective === 'completed' ? 'Feita' : effective === 'cancelled' ? 'Cancelada' : 'Agendada'}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          {s.status === 'cancelled' ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              key={`${s.id}_${dynamicPerSession.toFixed(4)}`}
                              defaultValue={(typeof (s as any).spaceCost === 'number' ? (s as any).spaceCost : dynamicPerSession).toFixed(2)}
                              onBlur={async e => {
                                const newVal = Number(e.target.value || 0);
                                const currentVal = typeof (s as any).spaceCost === 'number' ? (s as any).spaceCost : dynamicPerSession;
                                if (Math.abs(newVal - currentVal) < 0.005) return;
                                try {
                                  await updateDoc(doc(db, 'sessions', s.id), { spaceCost: newVal, updatedAt: new Date() });
                                  await loadLocations();
                                } catch (err) { console.error(err); }
                              }}
                              style={{ width: 80, padding: '0.3rem 0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--sand)', fontSize: '0.875rem' }}
                              title="Editar custo desta aula"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sem aulas neste mês</div>
              )}

              {/* Cost summary */}
              {locSessions.length > 0 && (
                <div className="paid-toggle-section">
                  <div className="paid-info">
                    <span style={{ fontWeight: 600 }}>Custo do mês:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>{monthlyCost.toFixed(2)}€</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({billable.length} aula{billable.length !== 1 ? 's' : ''} cobr{billable.length === 1 ? 'ada' : 'adas'})</span>
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
        .month-rent-box { margin: 0 1.5rem 1rem; padding: 0.75rem; background: var(--bg-secondary); border: 1px solid var(--sand); border-radius: var(--radius-lg); }
        @media (max-width: 600px) { .month-rent-box > div:nth-child(2) { grid-template-columns: 1fr 1fr !important; } }

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

        @media (max-width: 768px) {
          .edit-grid { grid-template-columns: 1fr; }
          .list-row { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
