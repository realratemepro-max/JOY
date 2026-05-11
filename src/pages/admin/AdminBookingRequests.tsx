import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Calendar, Clock, User, Phone, MessageSquare, Check, X, Loader, MapPin } from 'lucide-react';

interface BookingRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  purchaseId: string;
  planName: string;
  sessionsTotal: number;
  sessionsRemaining: number;
  preferredDates: string[];
  preferredTimes: string[];
  notes: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  confirmedDate?: string;
  confirmedTime?: string;
  professorName?: string;
  locationName?: string;
  createdAt: Date;
}

export function AdminBookingRequests() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{ date: string; time: string; professorName: string; locationName: string; notes: string }>({ date: '', time: '', professorName: '', locationName: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'bookingRequests'), orderBy('createdAt', 'desc')));
      setRequests(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate() } as BookingRequest;
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openConfirm = (req: BookingRequest) => {
    setConfirming(req.id);
    setConfirmData({
      date: req.preferredDates[0] || '',
      time: req.preferredTimes[0] || '',
      professorName: req.professorName || '',
      locationName: req.locationName || '',
      notes: '',
    });
  };

  const handleConfirm = async (req: BookingRequest) => {
    setSaving(true);
    try {
      // Update booking request status
      await updateDoc(doc(db, 'bookingRequests', req.id), {
        status: 'confirmed',
        confirmedDate: confirmData.date,
        confirmedTime: confirmData.time,
        professorName: confirmData.professorName,
        locationName: confirmData.locationName,
        adminNotes: confirmData.notes,
        updatedAt: new Date(),
      });
      await loadData();
      setConfirming(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleCancel = async (reqId: string) => {
    if (!confirm('Cancelar este pedido?')) return;
    await updateDoc(doc(db, 'bookingRequests', reqId), { status: 'cancelled', updatedAt: new Date() });
    await loadData();
  };

  const filtered = requests.filter(r => r.status === tab);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.25rem', background: 'white', borderRadius: 'var(--radius-lg)', padding: '0.25rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem', width: 'fit-content' }}>
        {(['pending', 'confirmed', 'cancelled'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ background: tab === t ? 'var(--primary)' : 'none', color: tab === t ? 'white' : 'var(--text-secondary)', border: 'none', padding: '0.5rem 1.25rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {t === 'pending' ? 'Pendentes' : t === 'confirmed' ? 'Confirmados' : 'Cancelados'}
            {t === 'pending' && pendingCount > 0 && (
              <span style={{ background: 'var(--error)', color: 'white', borderRadius: '999px', fontSize: '0.6875rem', padding: '0.125rem 0.4rem', fontWeight: 700 }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-xl)', color: 'var(--text-secondary)' }}>
          {tab === 'pending' ? 'Sem pedidos pendentes' : tab === 'confirmed' ? 'Sem pedidos confirmados' : 'Sem pedidos cancelados'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map(req => (
            <div key={req.id} style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', border: req.status === 'pending' ? '2px solid rgba(124,154,114,0.3)' : '1px solid var(--beige)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <User size={16} color="var(--primary)" />
                    <strong style={{ fontSize: '1.0625rem' }}>{req.userName}</strong>
                    <span className={`badge badge-${req.status === 'pending' ? 'warning' : req.status === 'confirmed' ? 'success' : 'error'}`}>
                      {req.status === 'pending' ? 'Pendente' : req.status === 'confirmed' ? 'Confirmado' : 'Cancelado'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <span>{req.userEmail}</span>
                    {req.userPhone && <span><Phone size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {req.userPhone}</span>}
                    <span style={{ color: 'var(--primary-dark)', fontWeight: 500 }}>{req.planName} · {req.sessionsRemaining} aula{req.sessionsRemaining !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{req.createdAt?.toLocaleDateString('pt-PT')}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Datas preferidas</div>
                  {req.preferredDates.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      <Calendar size={13} color="var(--primary)" />
                      {new Date(d + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                  ))}
                </div>
                {req.preferredTimes.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Horários preferidos</div>
                    {req.preferredTimes.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        <Clock size={13} color="var(--primary)" /> {t}
                      </div>
                    ))}
                  </div>
                )}
                {req.notes && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Notas do cliente</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{req.notes}</div>
                  </div>
                )}
              </div>

              {/* Confirm panel */}
              {confirming === req.id ? (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginTop: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Confirmar Agendamento</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">Data confirmada</label>
                      <input className="input" type="date" value={confirmData.date} onChange={e => setConfirmData({ ...confirmData, date: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">Hora</label>
                      <input className="input" type="time" value={confirmData.time} onChange={e => setConfirmData({ ...confirmData, time: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">Professor</label>
                      <input className="input" value={confirmData.professorName} onChange={e => setConfirmData({ ...confirmData, professorName: e.target.value })} placeholder="Nome do professor" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">Espaço</label>
                      <input className="input" value={confirmData.locationName} onChange={e => setConfirmData({ ...confirmData, locationName: e.target.value })} placeholder="Nome do espaço" />
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: '0 0 1rem' }}>
                    <label className="label">Notas para o cliente (opcional)</label>
                    <textarea className="input" rows={2} value={confirmData.notes} onChange={e => setConfirmData({ ...confirmData, notes: e.target.value })} placeholder="Informações adicionais..." style={{ resize: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary" onClick={() => handleConfirm(req)} disabled={saving || !confirmData.date || !confirmData.time}>
                      {saving ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><Check size={16} /> Confirmar</>}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setConfirming(null)}>Cancelar</button>
                  </div>
                </div>
              ) : req.status === 'confirmed' ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-lg)', padding: '0.875rem 1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                  <span><Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {req.confirmedDate && new Date(req.confirmedDate + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  <span><Clock size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {req.confirmedTime}</span>
                  {req.professorName && <span><User size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {req.professorName}</span>}
                  {req.locationName && <span><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {req.locationName}</span>}
                </div>
              ) : null}

              {req.status === 'pending' && confirming !== req.id && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => openConfirm(req)}><Check size={14} /> Confirmar Data</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleCancel(req.id)}><X size={14} /> Recusar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
