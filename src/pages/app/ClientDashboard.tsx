import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Subscription, Session, Payment } from '../../types';
import { Calendar, CreditCard, ClipboardList, MapPin, Clock, ArrowRight, Sparkles, Award } from 'lucide-react';

export function ClientDashboard() {
  const { user, appUser } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [nextSession, setNextSession] = useState<Session | null>(null);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [totalAttended, setTotalAttended] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Load active subscription
      const subSnap = await getDocs(query(
        collection(db, 'subscriptions'),
        where('userId', '==', user!.uid),
        where('status', '==', 'active'),
        limit(1)
      ));
      if (!subSnap.empty) {
        const subData = subSnap.docs[0].data();
        setSubscription({ id: subSnap.docs[0].id, ...subData, startDate: subData.startDate?.toDate(), currentPeriodStart: subData.currentPeriodStart?.toDate(), currentPeriodEnd: subData.currentPeriodEnd?.toDate(), createdAt: subData.createdAt?.toDate(), updatedAt: subData.updatedAt?.toDate() } as Subscription);
      }

      // Load next upcoming session
      const now = new Date();
      const sessionsSnap = await getDocs(query(
        collection(db, 'sessions'),
        where('status', '==', 'scheduled'),
        orderBy('date', 'asc'),
        limit(20)
      ));
      const userSession = sessionsSnap.docs.find(d => {
        const data = d.data();
        return data.date?.toDate() >= now && data.enrolledStudents?.some((s: any) => s.userId === user!.uid);
      });
      if (userSession) {
        const sd = userSession.data();
        setNextSession({ id: userSession.id, ...sd, date: sd.date?.toDate() } as Session);
      }

      // Load recent payments
      const paymentsSnap = await getDocs(query(
        collection(db, 'payments'),
        where('userId', '==', user!.uid),
        orderBy('createdAt', 'desc'),
        limit(3)
      ));
      setRecentPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() } as Payment)));

      // Count total attended sessions for loyalty
      const allSessionsSnap = await getDocs(collection(db, 'sessions'));
      let attended = 0;
      allSessionsSnap.docs.forEach(d => {
        const data = d.data();
        data.enrolledStudents?.forEach((s: any) => {
          if (s.userId === user!.uid && s.status === 'attended') attended++;
        });
      });
      setTotalAttended(attended);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Welcome */}
      <div className="welcome-card">
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 400, margin: '0 0 0.5rem' }}>
            Olá, {appUser?.name?.split(' ')[0] || 'Yogui'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            {subscription ? `Plano: ${subscription.planName}` : 'Bem-vindo ao JOY. Explora os nossos planos!'}
          </p>
        </div>
        <Sparkles size={48} style={{ opacity: 0.3 }} />
      </div>

      <div className="dashboard-grid">
        {/* Next Session */}
        <div className="dash-card">
          <div className="dash-card-header">
            <Calendar size={20} />
            <h3>Próxima Sessão</h3>
          </div>
          {nextSession ? (
            <div>
              <div className="session-date">
                {DAY_NAMES[nextSession.dayOfWeek]}, {nextSession.date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
              </div>
              <div className="session-time">
                <Clock size={16} /> {nextSession.startTime} - {nextSession.endTime}
              </div>
              <div className="session-location">
                <MapPin size={16} /> {nextSession.locationName}
              </div>
            </div>
          ) : (
            <p className="empty-text">Sem sessões agendadas</p>
          )}
          <Link to="/app/sessions" className="dash-link">Ver todas as sessões <ArrowRight size={16} /></Link>
        </div>

        {/* My Plan */}
        <div className="dash-card">
          <div className="dash-card-header">
            <ClipboardList size={20} />
            <h3>Meu Plano</h3>
          </div>
          {subscription ? (
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.5rem' }}>{subscription.planName}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {subscription.locationName}
              </div>
              <div className="sessions-counter">
                <span className="sessions-used">{subscription.sessionsUsedThisPeriod}</span>
                <span className="sessions-sep">/</span>
                <span className="sessions-total">{subscription.sessionsAllowedThisPeriod}</span>
                <span className="sessions-label">sessões este período</span>
              </div>
            </div>
          ) : (
            <div>
              <p className="empty-text">Ainda não tens um plano ativo</p>
              <Link to="/#servicos" className="btn btn-primary btn-sm">Ver Planos</Link>
            </div>
          )}
          <Link to="/app/plan" className="dash-link">Detalhes do plano <ArrowRight size={16} /></Link>
        </div>

        {/* Recent Payments */}
        <div className="dash-card">
          <div className="dash-card-header">
            <CreditCard size={20} />
            <h3>Últimos Pagamentos</h3>
          </div>
          {recentPayments.length > 0 ? (
            <div className="payments-list">
              {recentPayments.map(p => (
                <div key={p.id} className="payment-item">
                  <div>
                    <span style={{ fontWeight: 500 }}>{p.planName || p.plan || '-'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{p.createdAt.toLocaleDateString('pt-PT')}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 600 }}>{p.amount.toFixed(2).replace('.', ',')}€</span>
                    <span className={`badge badge-${p.status === 'Paid' ? 'success' : p.status === 'Pending' ? 'warning' : 'error'}`} style={{ display: 'block', marginTop: '0.25rem' }}>
                      {p.status === 'Paid' ? 'Pago' : p.status === 'Pending' ? 'Pendente' : p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-text">Sem pagamentos registados</p>
          )}
          <Link to="/app/payments" className="dash-link">Ver todos <ArrowRight size={16} /></Link>
        </div>

        {/* Loyalty / Fidelidade */}
        <div className="dash-card loyalty-card">
          <div className="dash-card-header">
            <Award size={20} />
            <h3>Programa de Fidelidade</h3>
          </div>
          <div className="loyalty-progress">
            <div className="loyalty-total">
              <span className="loyalty-num">{totalAttended}</span>
              <span className="loyalty-label">sessões frequentadas</span>
            </div>
            <div className="loyalty-level">
              <span className="level-name">
                {totalAttended < 10 ? 'Iniciante' : totalAttended < 25 ? 'Praticante' : totalAttended < 50 ? 'Dedicado' : totalAttended < 100 ? 'Avançado' : 'Mestre Yogui'}
              </span>
              <div className="level-bar">
                <div className="level-fill" style={{
                  width: `${Math.min(100, totalAttended < 10 ? (totalAttended / 10) * 100 : totalAttended < 25 ? ((totalAttended - 10) / 15) * 100 : totalAttended < 50 ? ((totalAttended - 25) / 25) * 100 : totalAttended < 100 ? ((totalAttended - 50) / 50) * 100 : 100)}%`
                }} />
              </div>
              <span className="level-next">
                {totalAttended < 10 ? `${10 - totalAttended} sessões para Praticante` : totalAttended < 25 ? `${25 - totalAttended} para Dedicado` : totalAttended < 50 ? `${50 - totalAttended} para Avançado` : totalAttended < 100 ? `${100 - totalAttended} para Mestre` : 'Nível máximo!'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .welcome-card { background: var(--primary-gradient); color: white; border-radius: var(--radius-xl); padding: 2rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .dash-card { background: white; border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; }
        .dash-card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; color: var(--primary-dark); }
        .dash-card-header h3 { font-family: var(--font-body); font-size: 1rem; font-weight: 600; margin: 0; }
        .session-date { font-weight: 600; font-size: 1.0625rem; margin-bottom: 0.5rem; text-transform: capitalize; }
        .session-time, .session-location { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; color: var(--text-secondary); margin-bottom: 0.25rem; }
        .sessions-counter { display: flex; align-items: baseline; gap: 0.25rem; margin-top: 1rem; }
        .sessions-used { font-size: 2rem; font-weight: 700; color: var(--primary-dark); font-family: var(--font-heading); }
        .sessions-sep { font-size: 1.25rem; color: var(--text-muted); }
        .sessions-total { font-size: 1.25rem; font-weight: 600; color: var(--text-secondary); }
        .sessions-label { font-size: 0.8125rem; color: var(--text-muted); margin-left: 0.5rem; }
        .payments-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .payment-item { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--beige); }
        .payment-item:last-child { border: none; }
        .empty-text { color: var(--text-muted); font-size: 0.9375rem; }
        .dash-link { display: flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; color: var(--primary); font-weight: 500; margin-top: auto; padding-top: 1rem; text-decoration: none; transition: gap var(--transition-fast); }
        .dash-link:hover { gap: 0.625rem; }

        .loyalty-card { background: linear-gradient(135deg, #faf8f5 0%, #f0ebe3 100%) !important; }
        .loyalty-progress { display: flex; align-items: center; gap: 1.5rem; }
        .loyalty-total { text-align: center; min-width: 80px; }
        .loyalty-num { font-size: 2.5rem; font-weight: 700; font-family: var(--font-heading); color: var(--primary-dark); display: block; line-height: 1; }
        .loyalty-label { font-size: 0.6875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .loyalty-level { flex: 1; }
        .level-name { font-weight: 600; font-size: 1.0625rem; color: var(--primary-dark); display: block; margin-bottom: 0.5rem; }
        .level-bar { height: 8px; background: var(--sand); border-radius: var(--radius-full); overflow: hidden; margin-bottom: 0.375rem; }
        .level-fill { height: 100%; background: var(--primary-gradient); border-radius: var(--radius-full); transition: width 0.6s ease; }
        .level-next { font-size: 0.75rem; color: var(--text-muted); }

        @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } .loyalty-progress { flex-direction: column; text-align: center; } }
      `}</style>
    </div>
  );
}
