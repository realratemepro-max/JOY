import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Session, Payment, LoyaltyConfig } from '../../types';
import { computeJourney, normaliseLoyaltyConfig } from '../../services/loyaltyPresets';
import { Calendar, CreditCard, ClipboardList, MapPin, Clock, ArrowRight, Sparkles, Award, AlertTriangle, Users, Copy, CheckCheck, Star, MessageCircle } from 'lucide-react';
import { TestimonialComposer } from '../../components/TestimonialComposer';

interface Purchase {
  id: string; planName: string; locationName: string;
  sessionsTotal: number; sessionsUsed: number; sessionsRemaining: number;
  status: string; startDate: Date; endDate: Date; priceMonthly: number;
}

export function ClientDashboard() {
  const { user, appUser } = useAuth();
  const [activePurchase, setActivePurchase] = useState<Purchase | null>(null);
  const [nextSession, setNextSession] = useState<Session | null>(null);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [totalAttended, setTotalAttended] = useState(0);
  const [sessionsWarning, setSessionsWarning] = useState<{ remaining: number; available: number; expiry: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [referralEnabled, setReferralEnabled] = useState(false);
  const [referralDesc, setReferralDesc] = useState('');
  const [welcomePromo, setWelcomePromo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig | null>(null);
  const [showTestimonialComposer, setShowTestimonialComposer] = useState(false);
  const [hasTestimonial, setHasTestimonial] = useState<boolean | null>(null);

  useEffect(() => { if (user) loadData(); }, [user]);

  // Check if user already has a testimonial
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'testimonials', user.uid));
        setHasTestimonial(snap.exists());
      } catch { setHasTestimonial(false); }
    })();
  }, [user]);

  const loadData = async () => {
    try {
      // Load active purchase (not subscription)
      const purchasesSnap = await getDocs(query(collection(db, 'purchases'), where('userId', '==', user!.uid), where('status', '==', 'active')));
      const now = new Date();
      const active = purchasesSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, startDate: data.startDate?.toDate(), endDate: data.endDate?.toDate() } as Purchase;
      }).filter(p => p.endDate >= now);
      if (active.length > 0) setActivePurchase(active[0]);

      // Load next upcoming session (where user is enrolled)
      const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('status', '==', 'scheduled'), orderBy('date', 'asc'), limit(50)));
      const userSession = sessionsSnap.docs.find(d => {
        const data = d.data();
        return data.date?.toDate() >= now && data.enrolledStudents?.some((s: any) => s.userId === user!.uid);
      });
      if (userSession) {
        const sd = userSession.data();
        setNextSession({ id: userSession.id, ...sd, date: sd.date?.toDate() } as Session);
      }

      // Load recent payments
      const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('userId', '==', user!.uid), orderBy('createdAt', 'desc'), limit(3)));
      setRecentPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() } as Payment)));

      // Count total attended sessions + check sessions expiry warning
      const allSessionsSnap = await getDocs(collection(db, 'sessions'));
      let attended = 0;
      const activePurchaseData = active.length > 0 ? active[0] : null;
      let availableBeforeExpiry = 0;

      allSessionsSnap.docs.forEach(d => {
        const data = d.data();
        const sessionDate: Date = data.date?.toDate();
        data.enrolledStudents?.forEach((s: any) => {
          if (s.userId === user!.uid && s.status === 'attended') attended++;
        });
        // Count sessions available before plan expiry (not enrolled, not full, future)
        if (activePurchaseData && sessionDate >= now && sessionDate <= activePurchaseData.endDate) {
          const alreadyEnrolled = data.enrolledStudents?.some((s: any) => s.userId === user!.uid);
          const isFull = (data.enrolledStudents?.length || 0) >= (data.maxCapacity || 99);
          if (!alreadyEnrolled && !isFull && data.status === 'scheduled') availableBeforeExpiry++;
        }
      });
      setTotalAttended(attended);

      // Warn if client has sessions remaining but not enough classes available before expiry
      if (activePurchaseData && activePurchaseData.sessionsRemaining > 0 && availableBeforeExpiry <= activePurchaseData.sessionsRemaining) {
        setSessionsWarning({ remaining: activePurchaseData.sessionsRemaining, available: availableBeforeExpiry, expiry: activePurchaseData.endDate });
      }
      // Load referral program config + user referral code + loyalty config
      const [cfgDoc, userDoc, mainCfgDoc] = await Promise.all([
        getDoc(doc(db, 'siteConfig', 'referrals')),
        getDoc(doc(db, 'users', user!.uid)),
        getDoc(doc(db, 'siteConfig', 'main')),
      ]);
      if (mainCfgDoc.exists() && mainCfgDoc.data().loyalty) {
        setLoyalty(mainCfgDoc.data().loyalty as LoyaltyConfig);
      }
      const cfg = cfgDoc.exists() ? cfgDoc.data() : null;
      if (cfg?.enabled) {
        setReferralEnabled(true);
        setReferralDesc(cfg.description || '');
        const userData = userDoc.data();
        let code = userData?.referralCode as string | undefined;
        if (!code) {
          // Generate and store referral code
          const firstName = (userData?.name || '').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'JOY';
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let suffix = '';
          for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
          code = `${firstName}-${suffix}`;
          await updateDoc(doc(db, 'users', user!.uid), { referralCode: code });
        }
        setReferralCode(code);
        setWelcomePromo(userDoc.data()?.referralWelcomePromoCode || null);
        const refSnap = await getDocs(query(collection(db, 'referrals'), where('referrerId', '==', user!.uid)));
        setReferralCount(refSnap.size);
      }
    } catch (err) { console.error('Error loading dashboard:', err); }
    finally { setLoading(false); }
  };

  const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  const daysLeft = activePurchase ? Math.max(0, Math.ceil((activePurchase.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div>
      {/* Welcome */}
      <div className="welcome-card">
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 400, margin: '0 0 0.5rem' }}>
            Olá, {appUser?.name?.split(' ')[0] || 'Yogui'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            {activePurchase ? `${activePurchase.planName} · ${activePurchase.sessionsRemaining} aulas restantes` : 'Bem-vindo ao JOY. Explora os nossos planos!'}
          </p>
        </div>
        <Sparkles size={48} style={{ opacity: 0.3 }} />
      </div>

      {/* Sessions expiry warning */}
      {sessionsWarning && sessionsWarning.available < sessionsWarning.remaining && (
        <div className="sessions-warning">
          <AlertTriangle size={20} />
          <div>
            <strong>Atenção:</strong> Tens <strong>{sessionsWarning.remaining} aula{sessionsWarning.remaining !== 1 ? 's' : ''}</strong> por usar mas o estúdio só tem <strong>{sessionsWarning.available} aula{sessionsWarning.available !== 1 ? 's' : ''}</strong> disponíve{sessionsWarning.available !== 1 ? 'is' : 'l'} até {sessionsWarning.expiry.toLocaleDateString('pt-PT')}. Reserva agora para não perderes!
          </div>
          <Link to="/app/sessions" className="btn btn-sm btn-warning" style={{ whiteSpace: 'nowrap' }}>Ver Aulas</Link>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Next Session */}
        <div className="dash-card">
          <div className="dash-card-header"><Calendar size={20} /><h3>Próxima Aula</h3></div>
          {nextSession ? (
            <div>
              <div className="session-date">{DAY_NAMES[nextSession.dayOfWeek]}, {nextSession.date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}</div>
              <div className="session-time"><Clock size={16} /> {nextSession.startTime} - {nextSession.endTime}</div>
              <div className="session-location"><MapPin size={16} /> {nextSession.locationName}</div>
            </div>
          ) : (
            <p className="empty-text">Sem aulas agendadas</p>
          )}
          <Link to="/app/sessions" className="dash-link">Ver todas as aulas <ArrowRight size={16} /></Link>
        </div>

        {/* My Plan */}
        <div className="dash-card">
          <div className="dash-card-header"><ClipboardList size={20} /><h3>Meu Plano</h3></div>
          {activePurchase ? (
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>{activePurchase.planName}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                <MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {activePurchase.locationName}
              </div>
              <div className="sessions-counter">
                <span className="sessions-used">{activePurchase.sessionsUsed}</span>
                <span className="sessions-sep">/</span>
                <span className="sessions-total">{activePurchase.sessionsTotal}</span>
                <span className="sessions-label">aulas usadas</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: daysLeft <= 7 ? 'var(--error)' : 'var(--text-muted)', marginTop: '0.5rem' }}>
                Expira em {daysLeft} dias ({activePurchase.endDate.toLocaleDateString('pt-PT')})
              </div>
            </div>
          ) : (
            <div>
              <p className="empty-text">Ainda não tens um plano ativo</p>
              <Link to="/app/plan" className="btn btn-primary btn-sm">Ver Planos</Link>
            </div>
          )}
          <Link to="/app/plan" className="dash-link">Detalhes do plano <ArrowRight size={16} /></Link>
        </div>

        {/* Recent Payments */}
        <div className="dash-card">
          <div className="dash-card-header"><CreditCard size={20} /><h3>Últimos Pagamentos</h3></div>
          {recentPayments.length > 0 ? (
            <div className="payments-list">
              {recentPayments.map(p => (
                <div key={p.id} className="payment-item">
                  <div>
                    <span style={{ fontWeight: 500 }}>{p.planName || p.plan || '-'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{p.createdAt?.toLocaleDateString('pt-PT')}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 600 }}>{p.amount?.toFixed(2).replace('.', ',')}€</span>
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

        {/* Referral Program */}
        {referralEnabled && referralCode && (
          <div className="dash-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
            <div className="dash-card-header"><Users size={20} /><h3>Programa de Referência</h3></div>
            {referralDesc && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1rem' }}>{referralDesc}</p>}
            <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', marginBottom: '0.875rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>O teu código</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary)', letterSpacing: '0.05em' }}>{referralCode}</span>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register?ref=${referralCode}`); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                  style={{ background: 'none', border: '1px solid var(--sand)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: copied ? 'var(--success)' : 'var(--text-muted)' }}>
                  {copied ? <><CheckCheck size={12} /> Copiado!</> : <><Copy size={12} /> Copiar link</>}
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
              <span><strong style={{ color: 'var(--primary-dark)' }}>{referralCount}</strong> amigo{referralCount !== 1 ? 's' : ''} referido{referralCount !== 1 ? 's' : ''}</span>
            </div>
            {welcomePromo && (
              <div style={{ marginTop: '0.875rem', padding: '0.625rem 0.75rem', background: 'rgba(124,154,114,0.12)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--primary-dark)' }}>
                🎁 O teu código de boas-vindas: <strong>{welcomePromo}</strong>
              </div>
            )}
          </div>
        )}

        {/* Testimonial CTA — after 3rd class, before they have written one */}
        {totalAttended >= 3 && hasTestimonial === false && (
          <div className="dash-card" style={{ borderLeft: '4px solid #f59e0b', cursor: 'pointer' }} onClick={() => setShowTestimonialComposer(true)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageCircle size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '0.9375rem' }}>Partilha a tua experiência</strong>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Já praticas connosco há algumas aulas. Importas-te de deixar a tua opinião? Ajudas outros a descobrir o JOY 🌿</span>
              </div>
              <button className="btn btn-sm btn-primary" style={{ flexShrink: 0 }}><Star size={14} /> Escrever</button>
            </div>
          </div>
        )}

        {/* Edit own testimonial CTA */}
        {hasTestimonial === true && (
          <div className="dash-card" style={{ cursor: 'pointer' }} onClick={() => setShowTestimonialComposer(true)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <CheckCheck size={16} color="#10b981" />
              <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>O teu testemunho já está submetido. <strong style={{ color: 'var(--primary)' }}>Editar?</strong></span>
            </div>
          </div>
        )}

        {/* Loyalty */}
        {(() => {
          if (!loyalty?.enabled) return null;
          const norm = normaliseLoyaltyConfig(loyalty);
          if (!norm.themes || norm.themes.length === 0) return null;
          const { currentLevel: current, nextLevel: next, toNextLevel } = computeJourney(totalAttended, norm.themes);
          const currentThreshold = current?.threshold || 0;
          const nextThreshold = next?.threshold || currentThreshold;
          const span = Math.max(1, nextThreshold - currentThreshold);
          const progress = next ? Math.min(100, ((totalAttended - currentThreshold) / span) * 100) : 100;
          return (
            <Link to="/app/conquistas" className="dash-card loyalty-card" style={{ textDecoration: 'none', color: 'inherit', borderLeft: `4px solid ${current?.color || 'var(--primary)'}` }}>
              <div className="dash-card-header"><Award size={20} /><h3>Programa de Fidelidade</h3></div>
              <div className="loyalty-progress">
                <div className="loyalty-total">
                  <span className="loyalty-num" style={{ color: current?.color }}>{totalAttended}</span>
                  <span className="loyalty-label">aulas frequentadas</span>
                </div>
                <div className="loyalty-level">
                  <span className="level-name" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {current?.icon && <span style={{ fontSize: '1.125rem' }}>{current.icon}</span>}
                    {current?.name || 'Sem nível'}
                  </span>
                  <div className="level-bar">
                    <div className="level-fill" style={{ width: `${progress}%`, background: current?.color || 'var(--primary)' }} />
                  </div>
                  <span className="level-next">
                    {next
                      ? `${Math.max(0, nextThreshold - totalAttended)} aulas para ${next.name}`
                      : 'Nível máximo atingido 🎉'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })()}
      </div>

      <style>{`
        .sessions-warning { background: #fff8e1; border: 1.5px solid #f59e0b; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; color: #92400e; font-size: 0.9375rem; }
        .sessions-warning svg { flex-shrink: 0; color: #f59e0b; }
        .sessions-warning > div { flex: 1; }
        .btn-warning { background: #f59e0b; color: white; border: none; padding: 0.375rem 0.875rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; font-size: 0.8125rem; text-decoration: none; }
        .welcome-card { background: var(--primary-gradient); color: white; border-radius: var(--radius-xl); padding: 2rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .dash-card { background: white; border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; }
        .dash-card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; color: var(--primary-dark); }
        .dash-card-header h3 { font-family: var(--font-body); font-size: 1rem; font-weight: 600; margin: 0; }
        .session-date { font-weight: 600; font-size: 1.0625rem; margin-bottom: 0.5rem; text-transform: capitalize; }
        .session-time, .session-location { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; color: var(--text-secondary); margin-bottom: 0.25rem; }
        .sessions-counter { display: flex; align-items: baseline; gap: 0.25rem; }
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

      {showTestimonialComposer && (
        <TestimonialComposer
          onClose={() => setShowTestimonialComposer(false)}
          onSubmitted={() => { setHasTestimonial(true); }}
        />
      )}
    </div>
  );
}
