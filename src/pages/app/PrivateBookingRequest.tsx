import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, getDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, MapPin, MessageSquare, CheckCircle, Loader } from 'lucide-react';

const TIME_PREFS = ['Manhã (8h-12h)', 'Almoço (12h-14h)', 'Tarde (14h-18h)', 'Noite (18h-21h)'];

export function PrivateBookingRequest() {
  const { user, appUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const purchaseId = searchParams.get('purchaseId');
  const planId = searchParams.get('planId');

  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [dates, setDates] = useState(['', '', '']);
  const [timePref, setTimePref] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => { if (user && purchaseId) loadPurchase(); }, [user, purchaseId]);

  const loadPurchase = async () => {
    try {
      if (purchaseId) {
        const snap = await getDoc(doc(db, 'purchases', purchaseId));
        if (snap.exists()) setPurchase({ id: snap.id, ...snap.data() });
      }
      if (appUser?.phone) setPhone(appUser.phone);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggleTime = (t: string) => {
    setTimePref(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSubmit = async () => {
    if (!user || !dates.filter(Boolean).length) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'bookingRequests'), {
        userId: user.uid,
        userName: appUser?.name || user.email || '',
        userEmail: user.email || '',
        userPhone: phone,
        purchaseId: purchaseId || '',
        planId: planId || purchase?.planId || '',
        planName: purchase?.planName || '',
        sessionsTotal: purchase?.sessionsTotal || 1,
        sessionsRemaining: purchase?.sessionsRemaining || 1,
        preferredDates: dates.filter(Boolean),
        preferredTimes: timePref,
        notes,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setSubmitted(true);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>;

  if (submitted) {
    return (
      <div className="booking-page">
        <div className="booking-card" style={{ textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <CheckCircle size={40} color="#16a34a" />
          </div>
          <h2>Pedido enviado!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            O Joaquim irá verificar a disponibilidade e entrar em contacto para confirmar a data da tua aula privada.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/app')}>Ir para o Dashboard</button>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="booking-page">
      <div className="booking-card">
        <div className="booking-header">
          <h2>Agendar Aula Privada</h2>
          {purchase && (
            <div className="plan-badge">
              <MapPin size={14} /> {purchase.planName} · {purchase.sessionsRemaining} aula{purchase.sessionsRemaining !== 1 ? 's' : ''} disponíve{purchase.sessionsRemaining !== 1 ? 'is' : 'l'}
            </div>
          )}
          <p className="booking-subtitle">
            Indica as tuas preferências de data e horário. Vamos verificar a disponibilidade e confirmar contigo.
          </p>
        </div>

        {/* Preferred dates */}
        <div className="form-section">
          <label className="section-label"><Calendar size={16} /> Datas preferidas (preenche até 3 opções)</label>
          <div className="dates-grid">
            {dates.map((d, i) => (
              <div key={i} className="form-group">
                <label className="label">Opção {i + 1}{i === 0 ? ' *' : ''}</label>
                <input
                  className="input"
                  type="date"
                  value={d}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => {
                    const nd = [...dates];
                    nd[i] = e.target.value;
                    setDates(nd);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Time preferences */}
        <div className="form-section">
          <label className="section-label"><Clock size={16} /> Horário preferido (podes escolher vários)</label>
          <div className="time-chips">
            {TIME_PREFS.map(t => (
              <button
                key={t}
                className={`time-chip ${timePref.includes(t) ? 'active' : ''}`}
                onClick={() => toggleTime(t)}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Phone */}
        <div className="form-section">
          <div className="form-group">
            <label className="label">Telemóvel para contacto</label>
            <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+351 9XX XXX XXX" />
          </div>
        </div>

        {/* Notes */}
        <div className="form-section">
          <div className="form-group">
            <label className="section-label"><MessageSquare size={16} /> Notas / Objetivos</label>
            <textarea
              className="input textarea"
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Tenho dores nas costas e gostava de trabalhar postura. Prefiro um ritmo mais suave..."
            />
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={handleSubmit}
          disabled={submitting || !dates.filter(Boolean).length}
        >
          {submitting ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 'Enviar Pedido de Agendamento'}
        </button>
      </div>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .booking-page { min-height: 100vh; background: var(--bg-secondary); padding: 2rem 1rem; display: flex; justify-content: center; }
  .booking-card { background: white; border-radius: var(--radius-xl); padding: 2rem; max-width: 600px; width: 100%; box-shadow: var(--shadow-md); height: fit-content; }
  .booking-header { margin-bottom: 2rem; }
  .booking-header h2 { font-family: var(--font-heading); font-size: 1.75rem; font-weight: 400; margin: 0 0 0.75rem; }
  .plan-badge { display: inline-flex; align-items: center; gap: 0.375rem; background: rgba(124,154,114,0.12); color: var(--primary-dark); padding: 0.375rem 0.875rem; border-radius: 999px; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem; }
  .booking-subtitle { color: var(--text-secondary); font-size: 0.9375rem; margin: 0; }
  .form-section { margin-bottom: 1.75rem; }
  .section-label { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.9375rem; color: var(--text-primary); margin-bottom: 0.75rem; }
  .dates-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .time-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .time-chip { padding: 0.5rem 1rem; border-radius: 999px; border: 1.5px solid var(--sand); background: white; font-size: 0.875rem; font-family: var(--font-body); cursor: pointer; transition: all 0.15s; }
  .time-chip.active { background: var(--primary); color: white; border-color: var(--primary); }
  .time-chip:hover:not(.active) { border-color: var(--primary); color: var(--primary-dark); }
  .textarea { resize: vertical; min-height: 100px; }
  @media (max-width: 600px) { .dates-grid { grid-template-columns: 1fr; } }
`;
