import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Subscription, Plan, Location } from '../../types';
import { MapPin, Calendar, Clock, Users, Check, AlertCircle } from 'lucide-react';

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function ClientPlan() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const subSnap = await getDocs(query(collection(db, 'subscriptions'), where('userId', '==', user!.uid), where('status', '==', 'active'), limit(1)));
      if (!subSnap.empty) {
        const subData = subSnap.docs[0].data();
        const sub = { id: subSnap.docs[0].id, ...subData, startDate: subData.startDate?.toDate(), currentPeriodStart: subData.currentPeriodStart?.toDate(), currentPeriodEnd: subData.currentPeriodEnd?.toDate(), createdAt: subData.createdAt?.toDate(), updatedAt: subData.updatedAt?.toDate() } as Subscription;
        setSubscription(sub);

        if (sub.planId) {
          const planDoc = await getDoc(doc(db, 'plans', sub.planId));
          if (planDoc.exists()) setPlan({ id: planDoc.id, ...planDoc.data() } as Plan);
        }
        if (sub.locationId) {
          const locDoc = await getDoc(doc(db, 'locations', sub.locationId));
          if (locDoc.exists()) setLocation({ id: locDoc.id, ...locDoc.data() } as Location);
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  if (!subscription) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <AlertCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '1.25rem' }}>Sem plano ativo</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Ainda não subscreveste nenhum plano de aulas.</p>
        <Link to="/#servicos" className="btn btn-primary">Ver Planos Disponíveis</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Plan Summary */}
      <div className="plan-card">
        <div className="plan-header">
          <div>
            <h2 style={{ margin: '0 0 0.25rem', fontFamily: 'var(--font-heading)', fontSize: '1.75rem' }}>{subscription.planName}</h2>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}><MapPin size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> {subscription.locationName}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{subscription.priceMonthly.toFixed(2).replace('.', ',')}€</div>
            <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>/mês</span>
          </div>
        </div>

        <div className="plan-stats">
          <div className="stat">
            <span className="stat-value">{subscription.sessionsPerWeek}x</span>
            <span className="stat-label">por semana</span>
          </div>
          <div className="stat">
            <span className="stat-value">{subscription.sessionsUsedThisPeriod}/{subscription.sessionsAllowedThisPeriod}</span>
            <span className="stat-label">sessões usadas</span>
          </div>
          <div className="stat">
            <span className="stat-value">{subscription.status === 'active' ? 'Ativo' : subscription.status}</span>
            <span className="stat-label">estado</span>
          </div>
        </div>
      </div>

      <div className="details-grid">
        {/* Schedule */}
        {plan && plan.schedule.length > 0 && (
          <div className="detail-card">
            <h3><Calendar size={18} /> Horário</h3>
            <div className="schedule-list">
              {plan.schedule.map((s, i) => (
                <div key={i} className="schedule-item">
                  <span className="schedule-day">{DAY_NAMES[s.dayOfWeek]}</span>
                  <span className="schedule-time">{s.startTime} - {s.endTime}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {location && (
          <div className="detail-card">
            <h3><MapPin size={18} /> Espaço</h3>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{location.name}</div>
            <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{location.address}</div>
            {location.description && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{location.description}</p>}
            {location.amenities.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                {location.amenities.map((a, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', background: 'var(--beige)', padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-full)' }}>
                    <Check size={12} color="var(--primary)" /> {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subscription Info */}
        <div className="detail-card">
          <h3><Clock size={18} /> Detalhes da Subscrição</h3>
          <div className="info-list">
            <div className="info-row"><span>Início</span><strong>{subscription.startDate.toLocaleDateString('pt-PT')}</strong></div>
            <div className="info-row"><span>Período atual</span><strong>{subscription.currentPeriodStart.toLocaleDateString('pt-PT')} - {subscription.currentPeriodEnd.toLocaleDateString('pt-PT')}</strong></div>
            {subscription.nextPaymentDue && <div className="info-row"><span>Próximo pagamento</span><strong>{new Date(subscription.nextPaymentDue).toLocaleDateString('pt-PT')}</strong></div>}
          </div>
        </div>
      </div>

      <style>{`
        .plan-card { background: var(--primary-gradient); color: white; border-radius: var(--radius-xl); padding: 2rem; margin-bottom: 2rem; }
        .plan-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .plan-stats { display: flex; gap: 2rem; }
        .stat { display: flex; flex-direction: column; }
        .stat-value { font-size: 1.25rem; font-weight: 700; }
        .stat-label { font-size: 0.75rem; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em; }
        .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .detail-card { background: white; border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-sm); }
        .detail-card h3 { font-family: var(--font-body); font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; color: var(--primary-dark); margin-bottom: 1rem; }
        .schedule-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .schedule-item { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--beige); }
        .schedule-item:last-child { border: none; }
        .schedule-day { font-weight: 500; }
        .schedule-time { color: var(--text-secondary); }
        .info-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .info-row { display: flex; justify-content: space-between; font-size: 0.9375rem; }
        .info-row span { color: var(--text-secondary); }

        @media (max-width: 768px) {
          .plan-header { flex-direction: column; gap: 1rem; }
          .plan-stats { flex-wrap: wrap; }
          .details-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
