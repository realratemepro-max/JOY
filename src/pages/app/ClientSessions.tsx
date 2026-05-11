import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, query, orderBy, getDoc, where, addDoc, setDoc, increment, runTransaction, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Session, Location, SessionRating, Plan } from '../../types';
import { Calendar, MapPin, Clock, Check, X as XIcon, Minus, Plus, Users, Loader, AlertTriangle, RefreshCw, Package, Video, MonitorSmartphone, Home, ListOrdered, Star, Trophy, CalendarDays, Copy, CheckCheck, CreditCard, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { updateDoc as firestoreUpdate } from 'firebase/firestore';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getPeriodBounds(period: 'week' | 'month', offset: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (period === 'week') {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day) + offset * 7;
    const start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    const sameMonth = start.getMonth() === end.getMonth();
    const label = sameMonth
      ? `${start.getDate()} – ${end.getDate()} ${MONTH_SHORT[end.getMonth()]}`
      : `${start.getDate()} ${MONTH_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTH_SHORT[end.getMonth()]}`;
    return { start, end, label };
  }
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end, label: `${MONTH_FULL[start.getMonth()]} ${start.getFullYear()}` };
}

interface ActivePurchase {
  id: string;
  endDate: Date;
  planName: string;
  sessionsRemaining: number;
  sessionsTotal: number;
  billingType?: 'subscription' | 'dropin';
}

interface CancelModal {
  session: Session;
  withinWindow: boolean;
  cancelLimitHours: number;
  hoursUntil: number;
  refundPurchase: ActivePurchase | null; // the specific purchase the cancel will refund (or null if none)
}

export function ClientSessions() {
  const navigate = useNavigate();
  const { user, appUser } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [dropinPlans, setDropinPlans] = useState<Plan[]>([]);
  const [activePurchases, setActivePurchases] = useState<ActivePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'available' | 'booked' | 'past'>('available');
  const [booking, setBooking] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<CancelModal | null>(null);
  const [hybridModal, setHybridModal] = useState<Session | null>(null);
  const [bookModal, setBookModal] = useState<{ session: Session; mode: 'presencial' | 'online' } | null>(null);
  const [waitlistModal, setWaitlistModal] = useState<Session | null>(null);
  const [ratingModal, setRatingModal] = useState<Session | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [myRatings, setMyRatings] = useState<Set<string>>(new Set()); // sessionIds already rated
  const [totalAttendances, setTotalAttendances] = useState(0);
  const [cancelLimitHours, setCancelLimitHours] = useState(2);
  const [dropinValidityDays, setDropinValidityDays] = useState(15);
  const [activePurchase, setActivePurchase] = useState<{ endDate: Date; planName: string } | null>(null);
  const [calendarModal, setCalendarModal] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewPeriod, setViewPeriod] = useState<'week' | 'month'>('week');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => { if (user) loadData(); }, [user]);

  // Live listener for sessions — keeps client view in sync with admin/professor changes
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(collection(db, 'sessions'), orderBy('date', 'asc')), snap => {
      setSessions(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate() } as Session;
      }));
    }, err => console.error('client sessions snapshot error', err));
    return () => unsub();
  }, [user]);

  const loadData = async () => {
    try {
      const [locsSnap, configSnap, purchasesSnap, userSnap, ratingsSnap, dropinSnap] = await Promise.all([
        getDocs(collection(db, 'locations')),
        getDoc(doc(db, 'siteConfig', 'main')),
        getDocs(query(collection(db, 'purchases'), where('userId', '==', user!.uid), where('status', '==', 'active'))),
        getDoc(doc(db, 'users', user!.uid)),
        getDocs(query(collection(db, 'sessionRatings'), where('userId', '==', user!.uid))),
        getDocs(query(collection(db, 'plans'), where('billingType', '==', 'dropin'), where('isActive', '==', true))),
      ]);
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
      setDropinPlans(dropinSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan)));
      if (configSnap.exists()) {
        setCancelLimitHours(configSnap.data().cancelLimitHoursBefore ?? 2);
        setDropinValidityDays(configSnap.data().dropinValidityDays ?? 15);
      }
      const now2 = new Date();
      const active: ActivePurchase[] = purchasesSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          endDate: data.endDate?.toDate(),
          planName: data.planName || '',
          sessionsRemaining: data.sessionsRemaining ?? 0,
          sessionsTotal: data.sessionsTotal ?? 0,
          billingType: data.billingType,
        };
      }).filter(p => p.endDate >= now2);
      setActivePurchases(active);
      const usable = active.find(p => p.sessionsRemaining > 0);
      if (usable) setActivePurchase({ endDate: usable.endDate, planName: usable.planName });
      if (userSnap.exists()) setTotalAttendances(userSnap.data()?.totalAttendances || 0);
      setMyRatings(new Set(ratingsSnap.docs.map(d => d.data().sessionId as string)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const now = new Date();
  const isEnrolled = (s: Session) => s.enrolledStudents?.some(e => e.userId === user!.uid);
  const isOnWaitlist = (s: Session) => (s.waitlist || []).some((e: any) => e.userId === user!.uid);
  const waitlistPosition = (s: Session) => {
    const idx = (s.waitlist || []).findIndex((e: any) => e.userId === user!.uid);
    return idx >= 0 ? idx + 1 : null;
  };
  const isExternalSession = (s: Session) => {
    const loc = locations.find(l => l.id === s.locationId);
    return loc?.isExternal === true;
  };

  const available = sessions.filter(s => s.date >= now && s.status === 'scheduled' && !isEnrolled(s) && !isOnWaitlist(s) && !isExternalSession(s));
  const booked = sessions.filter(s => s.date >= now && s.status === 'scheduled' && isEnrolled(s));
  const waitlisted = sessions.filter(s => s.date >= now && s.status === 'scheduled' && isOnWaitlist(s));
  const past = sessions.filter(s => (s.date < now || s.status === 'completed') && isEnrolled(s));

  const openBookFlow = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    // If hybrid, show mode picker first; default to presencial otherwise
    if ((session as any).isHybrid) {
      setHybridModal(session);
      return;
    }
    setBookModal({ session, mode: 'presencial' });
  };

  const handlePickHybridMode = (mode: 'presencial' | 'online') => {
    if (!hybridModal) return;
    const session = hybridModal;
    setHybridModal(null);
    setBookModal({ session, mode });
  };

  const dropinForLocation = (locationId: string) =>
    dropinPlans.find(p => p.locationId === locationId) || null;

  const confirmBookWithPlan = async (purchaseId: string) => {
    if (!user || !appUser || !bookModal) return;
    const { session, mode } = bookModal;
    setBooking(session.id);
    try {
      const newStudent = {
        userId: user.uid,
        userName: appUser.name || user.email || '',
        status: 'enrolled' as const,
        attendanceMode: mode,
        purchaseId,
      };
      const sessionRef = doc(db, 'sessions', session.id);
      // Atomic — read fresh enrolledStudents and append, never overwrite concurrent additions
      await runTransaction(db, async tx => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists()) throw new Error('Aula não encontrada');
        const fresh = (snap.data().enrolledStudents || []) as any[];
        if (fresh.some(s => s.userId === user.uid)) {
          // Already enrolled (idempotent) — silently succeed
          return;
        }
        if (fresh.length >= (snap.data().maxCapacity || 99)) {
          throw new Error('Aula cheia. Tenta a lista de espera.');
        }
        tx.update(sessionRef, { enrolledStudents: [...fresh, newStudent], updatedAt: new Date() });
      });
      // Decrement purchase
      await updateDoc(doc(db, 'purchases', purchaseId), {
        sessionsUsed: increment(1),
        sessionsRemaining: increment(-1),
        updatedAt: new Date(),
      });
      setActivePurchases(prev => prev.map(p => p.id === purchaseId ? { ...p, sessionsRemaining: p.sessionsRemaining - 1 } : p).filter(p => p.sessionsRemaining > 0));
      setBookModal(null);
      setTab('booked');
      const dateLabel = session.date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
      setToast({ type: 'success', message: `Aula marcada para ${dateLabel} às ${session.startTime}` });
      setTimeout(() => setToast(null), 5000);
    } catch (err: any) {
      console.error(err);
      setToast({ type: 'error', message: err?.message || 'Erro ao marcar aula. Tenta novamente.' });
      setTimeout(() => setToast(null), 5000);
    }
    finally { setBooking(null); }
  };

  const goToDropinCheckout = () => {
    if (!bookModal) return;
    const { session, mode } = bookModal;
    const dropin = dropinForLocation(session.locationId);
    if (!dropin) return;
    setBookModal(null);
    navigate(`/checkout?plan=${dropin.id}&type=dropin&sessionId=${session.id}&mode=${mode}`);
  };

  const goToPlans = () => {
    setBookModal(null);
    navigate('/app/plan');
  };

  const openCancelModal = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const hoursUntil = (session.date.getTime() - Date.now()) / (1000 * 60 * 60);
    const withinWindow = hoursUntil >= cancelLimitHours;
    // Look up which purchase will be refunded (if any)
    const myEnrollment = (session.enrolledStudents || []).find(e => e.userId === user!.uid);
    const purchaseId = (myEnrollment as any)?.purchaseId;
    const refundPurchase = purchaseId ? activePurchases.find(p => p.id === purchaseId) || null : null;
    setCancelModal({ session, withinWindow, cancelLimitHours, hoursUntil, refundPurchase });
  };

  const confirmCancel = async () => {
    if (!user || !cancelModal) return;
    const sessionId = cancelModal.session.id;
    const withinWindow = cancelModal.withinWindow;
    setCancelModal(null);
    setBooking(sessionId);
    try {
      // Atomic — read fresh array, recover purchaseId, remove only my entry, write back
      const sessionRef = doc(db, 'sessions', sessionId);
      let refundPurchaseId: string | null = null;
      await runTransaction(db, async tx => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists()) throw new Error('Aula não encontrada');
        const fresh = (snap.data().enrolledStudents || []) as any[];
        const myEnrollment = fresh.find(e => e.userId === user.uid);
        if (!myEnrollment) return; // already removed — idempotent
        refundPurchaseId = withinWindow ? myEnrollment.purchaseId || null : null;
        const updated = fresh.filter(e => e.userId !== user.uid);
        tx.update(sessionRef, { enrolledStudents: updated, updatedAt: new Date() });
      });
      // Refund the purchase if cancelled within the policy window
      if (refundPurchaseId) {
        try {
          await updateDoc(doc(db, 'purchases', refundPurchaseId), {
            sessionsUsed: increment(-1),
            sessionsRemaining: increment(1),
            updatedAt: new Date(),
          });
          setActivePurchases(prev => {
            const found = prev.find(p => p.id === refundPurchaseId);
            if (found) {
              return prev.map(p => p.id === refundPurchaseId ? { ...p, sessionsRemaining: p.sessionsRemaining + 1 } : p);
            }
            return prev; // purchase wasn't in active list (already exhausted) — will be picked up on next loadData
          });
        } catch (e) { console.error('Refund failed:', e); }
      }
      const msg = refundPurchaseId
        ? 'Aula cancelada. Sessão devolvida ao teu plano.'
        : withinWindow
          ? 'Aula cancelada.'
          : 'Aula cancelada (fora do prazo — sem reembolso).';
      setToast({ type: 'success', message: msg });
      setTimeout(() => setToast(null), 5000);
    } catch (err) { console.error(err); }
    finally { setBooking(null); }
  };

  const handleJoinWaitlist = async (session: Session) => {
    if (!user || !appUser) return;
    setWaitlistModal(null);
    setBooking(session.id);
    try {
      const currentWaitlist: any[] = (session.waitlist || []) as any[];
      const newEntry = {
        userId: user.uid,
        userName: appUser.name || user.email || '',
        userEmail: user.email || '',
        position: currentWaitlist.length + 1,
        joinedAt: new Date(),
      };
      await updateDoc(doc(db, 'sessions', session.id), { waitlist: [...currentWaitlist, newEntry], updatedAt: new Date() });
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, waitlist: [...currentWaitlist, newEntry] as any } : s));
    } catch (err) { console.error(err); }
    finally { setBooking(null); }
  };

  const handleLeaveWaitlist = async (sessionId: string) => {
    if (!user) return;
    setBooking(sessionId);
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;
      const newWaitlist = ((session.waitlist || []) as any[])
        .filter((e: any) => e.userId !== user.uid)
        .map((e: any, i: number) => ({ ...e, position: i + 1 }));
      await updateDoc(doc(db, 'sessions', sessionId), { waitlist: newWaitlist, updatedAt: new Date() });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, waitlist: newWaitlist as any } : s));
    } catch (err) { console.error(err); }
    finally { setBooking(null); }
  };

  const openRatingModal = (session: Session) => {
    setRatingModal(session);
    setRatingStars(5);
    setRatingComment('');
  };

  const handleSubmitRating = async () => {
    if (!ratingModal || !user || !appUser || ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      const hasComment = ratingComment.trim().length > 0;
      const status = hasComment ? 'pending' : 'auto_approved';
      const ratingRef = await addDoc(collection(db, 'sessionRatings'), {
        sessionId: ratingModal.id,
        sessionName: ratingModal.name || `${ratingModal.startTime} ${ratingModal.locationName}`,
        sessionDate: ratingModal.date,
        userId: user.uid,
        userName: appUser.name,
        stars: ratingStars,
        comment: hasComment ? ratingComment.trim() : null,
        status,
        createdAt: new Date(),
      });
      // Auto-approved (no comment) → immediately create testimonial
      if (status === 'auto_approved') {
        await addDoc(collection(db, 'testimonials'), {
          name: appUser.name,
          text: `${ratingStars} estrela${ratingStars !== 1 ? 's' : ''} — aula de ${ratingModal.date?.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}`,
          rating: ratingStars,
          isActive: true,
          order: 99,
          source: 'rating',
          ratingId: ratingRef.id,
          createdAt: new Date(),
        });
      }
      setMyRatings(prev => new Set([...prev, ratingModal.id]));
      setRatingModal(null);
    } catch (err) { console.error(err); }
    finally { setRatingSubmitting(false); }
  };

  const getMyAttendance = (session: Session) => session.enrolledStudents?.find(e => e.userId === user!.uid)?.status || 'enrolled';
  const attendanceLabel = (status: string) => status === 'attended' ? 'Presente' : status === 'absent' ? 'Faltou' : status === 'cancelled' ? 'Cancelada' : 'Inscrito';
  const attendanceColor = (status: string) => status === 'attended' ? 'var(--success)' : status === 'absent' ? 'var(--error)' : status === 'cancelled' ? 'var(--text-muted)' : 'var(--primary)';

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  const periodBounds = getPeriodBounds(viewPeriod, periodOffset);
  const availableInPeriod = available.filter(s => s.date >= periodBounds.start && s.date <= periodBounds.end);
  const displayed = tab === 'available' ? availableInPeriod : tab === 'booked' ? [...booked, ...waitlisted] : past;

  const openCalendarModal = async () => {
    if (!user) return;
    let token = (await import('firebase/firestore').then(m => m.getDoc(m.doc(db, 'users', user.uid)))).data()?.calendarToken as string | undefined;
    if (!token) {
      token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
      await firestoreUpdate(doc(db, 'users', user.uid), { calendarToken: token });
    }
    setCalendarUrl(`https://europe-west1-realrateme-731f1.cloudfunctions.net/userCalendar?uid=${user.uid}&token=${token}`);
    setCalendarModal(true);
    setCopied(false);
  };

  const copyCalendarUrl = () => {
    if (!calendarUrl) return;
    navigator.clipboard.writeText(calendarUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`book-toast ${toast.type}`} role="status">
          {toast.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="book-toast-close" aria-label="Fechar"><XIcon size={14} /></button>
        </div>
      )}

      {/* Ranking banner */}
      {totalAttendances > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 'var(--radius-xl)', padding: '1rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy size={22} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9375rem' }}>
              {totalAttendances} {totalAttendances === 1 ? 'presença' : 'presenças'} registadas!
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#a16207' }}>
              {totalAttendances < 5 ? 'Começo promissor! Continua assim 🌱' : totalAttendances < 15 ? 'Estás a criar um hábito incrível! 🌿' : totalAttendances < 30 ? 'Dedicação de verdade! 🌟' : 'Praticante comprometido — Namaste! 🧘'}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        <div className="tabs-bar" style={{ margin: 0 }}>
          <button className={`tab ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>
            Disponíveis ({available.length})
          </button>
          <button className={`tab ${tab === 'booked' ? 'active' : ''}`} onClick={() => setTab('booked')}>
            Minhas ({booked.length + waitlisted.length}{waitlisted.length > 0 ? ` · ${waitlisted.length} espera` : ''})
          </button>
          <button className={`tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
            Histórico ({past.length})
          </button>
        </div>
        <button
          onClick={openCalendarModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white', border: '1px solid var(--sand)', borderRadius: 'var(--radius-md)', padding: '0.45rem 0.875rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
        >
          <CalendarDays size={15} color="var(--primary)" /> Subscrever Calendário
        </button>
      </div>

      {tab === 'available' && (
        <div className="period-bar">
          <div className="period-toggle">
            <button className={viewPeriod === 'week' ? 'active' : ''} onClick={() => { setViewPeriod('week'); setPeriodOffset(0); }}>Semana</button>
            <button className={viewPeriod === 'month' ? 'active' : ''} onClick={() => { setViewPeriod('month'); setPeriodOffset(0); }}>Mês</button>
          </div>
          <div className="period-nav">
            <button className="period-nav-btn" onClick={() => setPeriodOffset(o => o - 1)} aria-label="Anterior"><ChevronLeft size={16} /></button>
            <span className="period-label">{periodBounds.label}</span>
            <button className="period-nav-btn" onClick={() => setPeriodOffset(o => o + 1)} aria-label="Seguinte"><ChevronRight size={16} /></button>
            {periodOffset !== 0 && (
              <button className="period-today" onClick={() => setPeriodOffset(0)}>Hoje</button>
            )}
          </div>
        </div>
      )}

      {tab === 'past' && past.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'white', borderRadius: 'var(--radius-lg)', padding: '0.875rem 1.25rem', marginBottom: '0.75rem', boxShadow: 'var(--shadow-sm)' }}>
          <Star size={18} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <span style={{ fontWeight: 600 }}>{totalAttendances} presenças</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}> registadas no total</span>
          </div>
        </div>
      )}
      {displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-xl)', color: 'var(--text-secondary)' }}>
          {tab === 'available' ? `Sem aulas disponíveis ${viewPeriod === 'week' ? 'esta semana' : 'este mês'}` : tab === 'booked' ? 'Não estás inscrito em nenhuma aula' : 'Sem aulas no histórico'}
        </div>
      ) : (
        <div className="sessions-list">
          {displayed.map(session => {
            const isFull = session.enrolledStudents.length >= session.maxCapacity;
            const attendance = tab === 'past' ? getMyAttendance(session) : null;
            return (
              <div key={session.id} className="session-row">
                <div className="session-date-col">
                  <span className="session-day-name">{DAY_NAMES[session.dayOfWeek]}</span>
                  <span className="session-day-num">{session.date.getDate()}</span>
                  <span className="session-month">{session.date.toLocaleDateString('pt-PT', { month: 'short' })}</span>
                </div>
                <div className="session-info">
                  <div className="session-time-row">
                    <Clock size={14} /> {session.startTime} - {session.endTime}
                    {(session as any).isHybrid && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: '999px', padding: '0.1rem 0.4rem', marginLeft: '0.25rem' }}><Video size={10} /> Híbrida</span>}
                    {tab === 'booked' && isOnWaitlist(session) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', background: '#fef3c7', color: '#d97706', borderRadius: '999px', padding: '0.1rem 0.4rem', marginLeft: '0.25rem' }}><ListOrdered size={10} /> Em espera</span>}
                  </div>
                  <div className="session-location-row"><MapPin size={14} /> {session.locationName}</div>
                  {session.professorName && <div className="session-location-row" style={{ fontSize: '0.8125rem' }}>👤 {session.professorName}</div>}
                  <div className="session-spots" style={{ gap: '0.75rem' }}>
                    <span><Users size={12} /> {session.enrolledStudents.length}/{session.maxCapacity} presencial</span>
                    {(session as any).isHybrid && <span><Video size={12} /> {((session as any).onlineEnrolled || []).length}/{(session as any).onlineCapacity || '?'} online</span>}
                  </div>
                  {/* Zoom link for online bookings */}
                  {tab === 'booked' && (() => {
                    const myEnroll = session.enrolledStudents.find(e => e.userId === user!.uid);
                    if ((myEnroll as any)?.attendanceMode === 'online' && (session as any).zoomLink) {
                      return (
                        <a href={(session as any).zoomLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.375rem', fontSize: '0.8125rem', color: '#1d4ed8', fontWeight: 500 }}>
                          <Video size={13} /> Entrar na aula online
                        </a>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="session-actions">
                  {tab === 'available' && (
                    session.classType === 'both' ? (
                      <span style={{ fontSize: '0.75rem', background: '#cffafe', color: '#0e7490', padding: '0.25rem 0.75rem', borderRadius: 999, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Users size={12} /> Turma Fechada
                      </span>
                    ) : isFull ? (
                      <button className="btn btn-sm" style={{ background: '#fef3c7', color: '#d97706', border: '1.5px solid #fcd34d', fontFamily: 'var(--font-body)' }} onClick={() => setWaitlistModal(session)} disabled={!!booking}>
                        <ListOrdered size={14} /> Lista de Espera
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-primary" onClick={() => openBookFlow(session.id)} disabled={!!booking}>
                        {booking === session.id ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><Plus size={14} /> Marcar</>}
                      </button>
                    )
                  )}
                  {tab === 'booked' && !isOnWaitlist(session) && (
                    <button className="btn btn-sm btn-secondary" onClick={() => openCancelModal(session.id)} disabled={!!booking}>
                      {booking === session.id ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><XIcon size={14} /> Cancelar</>}
                    </button>
                  )}
                  {tab === 'booked' && isOnWaitlist(session) && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#d97706', padding: '0.25rem 0.625rem', borderRadius: 999, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ListOrdered size={12} /> Posição #{waitlistPosition(session)}
                      </span>
                      <button className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => handleLeaveWaitlist(session.id)} disabled={!!booking}>
                        {booking === session.id ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Sair da fila'}
                      </button>
                    </div>
                  )}
                  {tab === 'past' && attendance && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                      <span className="session-status" style={{ color: attendanceColor(attendance) }}>
                        {attendance === 'attended' ? <Check size={14} /> : attendance === 'absent' ? <XIcon size={14} /> : <Minus size={14} />}
                        {attendanceLabel(attendance)}
                      </span>
                      {attendance === 'attended' && (
                        myRatings.has(session.id) ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Star size={11} fill="#f59e0b" color="#f59e0b" /> Avaliado
                          </span>
                        ) : (
                          <button
                            className="btn btn-sm"
                            style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', border: '1.5px solid #fcd34d', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => openRatingModal(session)}
                          >
                            <Star size={12} /> Avaliar
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Book Session Modal — payment options */}
      {bookModal && (() => {
        const { session, mode } = bookModal;
        const dropin = dropinForLocation(session.locationId);
        const usablePurchases = activePurchases.filter(p => p.sessionsRemaining > 0);
        const planUsable = usablePurchases.length > 0;
        return (
          <div className="modal-overlay" onClick={() => setBookModal(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <CreditCard size={22} color="var(--primary)" />
                <h3>Como queres pagar?</h3>
              </div>
              <div className="modal-session-info">
                <div><Calendar size={14} /> {DAY_NAMES[session.dayOfWeek]}, {session.date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}</div>
                <div><Clock size={14} /> {session.startTime} - {session.endTime}</div>
                <div><MapPin size={14} /> {session.locationName}</div>
                {(session as any).isHybrid && (
                  <div>{mode === 'online' ? <Video size={14} /> : <Home size={14} />} {mode === 'online' ? 'Online' : 'Presencial'}</div>
                )}
              </div>

              {!planUsable && !dropin && (
                <div className="modal-policy policy-warn">
                  <div className="policy-title"><AlertTriangle size={16} /> Sem opções de pagamento</div>
                  <p>Não tens plano ativo nem está disponível aula avulsa para este espaço. Compra um plano para reservar esta aula.</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {planUsable && usablePurchases.map(p => (
                  <button
                    key={p.id}
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', gap: '1rem', padding: '1rem 1.25rem', textAlign: 'left' }}
                    onClick={() => confirmBookWithPlan(p.id)}
                    disabled={!!booking}
                  >
                    <Wallet size={22} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Usar plano "{p.planName}"</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {p.sessionsRemaining} {p.sessionsRemaining === 1 ? 'aula restante' : 'aulas restantes'} · válido até {p.endDate.toLocaleDateString('pt-PT')}
                      </div>
                    </div>
                  </button>
                ))}

                {dropin && (
                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', gap: '1rem', padding: '1rem 1.25rem', textAlign: 'left' }}
                    onClick={goToDropinCheckout}
                    disabled={!!booking}
                  >
                    <CreditCard size={22} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Aula avulsa — {(dropin.pricePerSession || 0).toFixed(0)}€</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Pagar agora via MB Way ou Multibanco</div>
                    </div>
                  </button>
                )}

                {!planUsable && (
                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', gap: '1rem', padding: '1rem 1.25rem', textAlign: 'left', borderStyle: 'dashed' }}
                    onClick={goToPlans}
                  >
                    <Package size={22} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Comprar plano de aulas</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Mais económico se vais a várias aulas</div>
                    </div>
                  </button>
                )}
              </div>

              <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setBookModal(null)}>Cancelar</button>
            </div>
          </div>
        );
      })()}

      {/* Hybrid Mode Modal */}
      {hybridModal && (
        <div className="modal-overlay" onClick={() => setHybridModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <MonitorSmartphone size={22} color="var(--primary)" />
              <h3>Como queres participar?</h3>
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
              <strong>{hybridModal.startTime} - {hybridModal.endTime}</strong> · {hybridModal.locationName}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '1rem', padding: '1rem 1.25rem', textAlign: 'left' }}
                onClick={() => handlePickHybridMode('presencial')}
                disabled={!!booking}
              >
                <Home size={22} color="var(--primary)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Presencial</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{hybridModal.enrolledStudents.length}/{hybridModal.maxCapacity} vagas</div>
                </div>
              </button>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '1rem', padding: '1rem 1.25rem', textAlign: 'left' }}
                onClick={() => handlePickHybridMode('online')}
                disabled={!!booking || !(hybridModal as any).zoomLink}
              >
                <Video size={22} color="#1d4ed8" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#1d4ed8' }}>Online</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {(hybridModal as any).zoomLink ? `${((hybridModal as any).onlineEnrolled || []).length}/${(hybridModal as any).onlineCapacity || '?'} vagas · Recebes o link Zoom` : 'Link ainda não disponível'}
                  </div>
                </div>
              </button>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setHybridModal(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Waitlist Modal */}
      {waitlistModal && (
        <div className="modal-overlay" onClick={() => setWaitlistModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <ListOrdered size={22} color="#d97706" />
              <h3>Lista de Espera</h3>
            </div>
            <div className="modal-session-info">
              <div><Calendar size={14} /> {DAY_NAMES[waitlistModal.dayOfWeek]}, {waitlistModal.date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}</div>
              <div><Clock size={14} /> {waitlistModal.startTime} - {waitlistModal.endTime}</div>
              <div><MapPin size={14} /> {waitlistModal.locationName}</div>
            </div>
            <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <ListOrdered size={16} /> Como funciona?
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#a16207', lineHeight: 1.7 }}>
                <li>Ficas na fila por ordem de inscrição.</li>
                <li>Quando alguém cancelar, entras automaticamente e recebes uma notificação.</li>
                <li>A aula é adicionada às tuas reservas imediatamente.</li>
                <li>Podes sair da lista a qualquer momento.</li>
              </ul>
              {((waitlistModal.waitlist || []) as any[]).length > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#92400e', fontWeight: 500 }}>
                  Há {((waitlistModal.waitlist || []) as any[]).length} {((waitlistModal.waitlist || []) as any[]).length === 1 ? 'pessoa' : 'pessoas'} na fila à tua frente.
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" style={{ background: '#d97706', borderColor: '#d97706' }} onClick={() => handleJoinWaitlist(waitlistModal)} disabled={!!booking}>
                {booking ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><ListOrdered size={16} /> Entrar na lista de espera</>}
              </button>
              <button className="btn btn-secondary" onClick={() => setWaitlistModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingModal && (
        <div className="modal-overlay" onClick={() => setRatingModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <Star size={22} color="#f59e0b" fill="#f59e0b" />
              <h3>Avaliar Aula</h3>
            </div>
            <div className="modal-session-info">
              <div><Calendar size={14} /> {DAY_NAMES[ratingModal.dayOfWeek]}, {ratingModal.date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}</div>
              <div><Clock size={14} /> {ratingModal.startTime} - {ratingModal.endTime}</div>
              <div><MapPin size={14} /> {ratingModal.locationName}</div>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9375rem', marginBottom: '0.625rem', color: 'var(--text-primary)' }}>A tua classificação</label>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setRatingStars(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                    <Star size={32} fill={n <= ratingStars ? '#f59e0b' : 'none'} color={n <= ratingStars ? '#f59e0b' : '#d1d5db'} />
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9375rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Comentário <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}>(opcional)</span>
              </label>
              <textarea
                className="input textarea"
                rows={3}
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                placeholder="Partilha a tua experiência... (ficará visível no site após aprovação)"
              />
              {ratingComment.trim().length > 0 && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                  O teu comentário será publicado após aprovação pelo professor.
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSubmitRating} disabled={ratingSubmitting}>
                {ratingSubmitting ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><Star size={16} /> Submeter Avaliação</>}
              </button>
              <button className="btn btn-secondary" onClick={() => setRatingModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <AlertTriangle size={22} color={cancelModal.withinWindow ? 'var(--accent)' : 'var(--error)'} />
              <h3>Cancelar Inscrição</h3>
            </div>

            <div className="modal-session-info">
              <div><Calendar size={14} /> {DAY_NAMES[cancelModal.session.dayOfWeek]}, {cancelModal.session.date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}</div>
              <div><Clock size={14} /> {cancelModal.session.startTime} - {cancelModal.session.endTime}</div>
              <div><MapPin size={14} /> {cancelModal.session.locationName}</div>
            </div>

            <div className={`modal-policy ${cancelModal.withinWindow ? 'policy-ok' : 'policy-warn'}`}>
              {cancelModal.withinWindow ? (
                <>
                  <div className="policy-title"><Check size={16} /> Cancelamento gratuito</div>
                  {cancelModal.refundPurchase ? (
                    cancelModal.refundPurchase.billingType === 'dropin' ? (
                      <p>A aula avulsa <strong>"{cancelModal.refundPurchase.planName}"</strong> volta a ficar disponível na tua conta. Podes usá-la até <strong>{cancelModal.refundPurchase.endDate.toLocaleDateString('pt-PT')}</strong> (validade original).</p>
                    ) : (
                      <p>A aula volta ao teu plano <strong>"{cancelModal.refundPurchase.planName}"</strong>. Podes usá-la até <strong>{cancelModal.refundPurchase.endDate.toLocaleDateString('pt-PT')}</strong> (validade original do plano).</p>
                    )
                  ) : (
                    <p>A aula é cancelada sem reembolso (sem plano ou aula avulsa associada).</p>
                  )}
                  {cancelModal.refundPurchase && <div className="policy-detail"><RefreshCw size={13} /> Podes remarcar qualquer outra aula disponível</div>}
                  {cancelModal.refundPurchase && <div className="policy-detail"><Package size={13} /> A validade {cancelModal.refundPurchase.billingType === 'dropin' ? 'da aula avulsa' : 'do plano'} não é estendida</div>}
                </>
              ) : (
                <>
                  <div className="policy-title"><AlertTriangle size={16} /> Fora do prazo de cancelamento</div>
                  <p>O prazo limite é de <strong>{cancelModal.cancelLimitHours}h</strong> antes da aula. Faltam apenas <strong>{Math.round(cancelModal.hoursUntil * 10) / 10}h</strong> para a aula.</p>
                  <div className="policy-detail" style={{ color: 'var(--error)' }}>Esta aula não será devolvida ao teu plano</div>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-danger" onClick={confirmCancel}>
                Confirmar Cancelamento
              </button>
              <button className="btn btn-secondary" onClick={() => setCancelModal(null)}>
                Manter Inscrição
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .tabs-bar { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); margin-bottom: 1.5rem; width: fit-content; }
        .tab { background: none; border: none; padding: 0.5rem 1.25rem; font-family: var(--font-body); font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .tab.active { background: var(--primary); color: white; }
        .sessions-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .session-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1.25rem; box-shadow: var(--shadow-sm); }
        .session-row:hover { box-shadow: var(--shadow-md); }
        .session-date-col { display: flex; flex-direction: column; align-items: center; min-width: 50px; }
        .session-day-name { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--primary); font-weight: 600; }
        .session-day-num { font-size: 1.5rem; font-weight: 700; font-family: var(--font-heading); line-height: 1; }
        .session-month { font-size: 0.6875rem; text-transform: uppercase; color: var(--text-muted); }
        .session-info { flex: 1; }
        .session-time-row, .session-location-row { display: flex; align-items: center; gap: 0.375rem; font-size: 0.9375rem; color: var(--text-secondary); }
        .session-time-row { margin-bottom: 0.25rem; }
        .session-spots { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }
        .session-actions { display: flex; align-items: center; gap: 0.5rem; }
        .session-status { display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; font-weight: 500; }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-box { background: white; border-radius: var(--radius-xl); padding: 1.75rem; max-width: 420px; width: 100%; box-shadow: var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.2)); }
        .modal-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; }
        .modal-header h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; }
        .modal-session-info { background: var(--beige, #f5f0e8); border-radius: var(--radius-lg); padding: 0.875rem 1rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.375rem; font-size: 0.9rem; color: var(--text-secondary); }
        .modal-session-info > div { display: flex; align-items: center; gap: 0.5rem; }
        .modal-policy { border-radius: var(--radius-lg); padding: 1rem; margin-bottom: 1.5rem; }
        .policy-ok { background: rgba(124,154,114,0.1); border: 1.5px solid rgba(124,154,114,0.3); }
        .policy-warn { background: rgba(220,53,69,0.07); border: 1.5px solid rgba(220,53,69,0.25); }
        .policy-title { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.9375rem; margin-bottom: 0.5rem; }
        .policy-ok .policy-title { color: var(--primary-dark); }
        .policy-warn .policy-title { color: var(--error); }
        .modal-policy p { font-size: 0.875rem; color: var(--text-secondary); margin: 0 0 0.5rem; line-height: 1.5; }
        .policy-detail { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--primary-dark); font-weight: 500; }
        .modal-actions { display: flex; flex-direction: column; gap: 0.625rem; }

        /* Period bar */
        .period-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: white;
          border-radius: var(--radius-lg);
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.875rem;
          box-shadow: var(--shadow-sm);
          flex-wrap: wrap;
        }
        .period-toggle {
          display: flex;
          background: var(--bg-secondary);
          border-radius: var(--radius-full);
          padding: 3px;
          gap: 2px;
        }
        .period-toggle button {
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--text-secondary);
          padding: 0.35rem 0.875rem;
          border-radius: var(--radius-full);
          transition: all var(--transition-fast);
        }
        .period-toggle button.active {
          background: var(--primary);
          color: white;
          font-weight: 600;
        }
        .period-nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .period-nav-btn {
          width: 30px;
          height: 30px;
          background: var(--bg-secondary);
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          transition: all var(--transition-fast);
        }
        .period-nav-btn:hover {
          background: var(--primary);
          color: white;
        }
        .period-label {
          font-weight: 600;
          font-size: 0.9375rem;
          color: var(--text-primary);
          min-width: 130px;
          text-align: center;
        }
        .period-today {
          background: none;
          border: 1.5px solid var(--sand);
          border-radius: var(--radius-full);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--primary);
          padding: 0.25rem 0.75rem;
          margin-left: 0.25rem;
          transition: all var(--transition-fast);
        }
        .period-today:hover {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        /* Toast */
        .book-toast {
          position: fixed;
          top: 1.5rem;
          right: 1.5rem;
          background: white;
          border-radius: var(--radius-lg);
          padding: 0.875rem 1rem 0.875rem 1.25rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-size: 0.9375rem;
          font-weight: 500;
          z-index: 2000;
          max-width: 420px;
          animation: toast-in 0.25s ease-out;
          border-left: 4px solid var(--primary);
        }
        .book-toast.success { color: #166534; border-left-color: #16a34a; }
        .book-toast.success svg:first-child { color: #16a34a; }
        .book-toast.error { color: #991b1b; border-left-color: #dc2626; }
        .book-toast.error svg:first-child { color: #dc2626; }
        .book-toast-close {
          background: none; border: none; cursor: pointer; padding: 0.25rem;
          color: var(--text-muted); display: flex; margin-left: 0.5rem;
        }
        .book-toast-close:hover { color: var(--text-primary); }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .session-row { flex-wrap: wrap; }
          .tabs-bar { width: 100%; }
          .period-bar { padding: 0.625rem 0.875rem; }
          .period-label { min-width: 100px; font-size: 0.875rem; }
          .book-toast { top: 1rem; right: 1rem; left: 1rem; max-width: none; }
        }
      `}</style>

      {/* Calendar Subscribe Modal */}
      {calendarModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setCalendarModal(false)}>
          <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 480, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--beige)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '1.0625rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarDays size={18} color="var(--primary)" /> Subscrever Calendário
              </h3>
              <button onClick={() => setCalendarModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}><XIcon size={18} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Subscreve este link no teu Google Calendar, Apple Calendar ou Outlook para veres as tuas aulas automaticamente atualizadas.
              </p>

              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '0.875rem', marginBottom: '1.25rem', display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                <code style={{ flex: 1, fontSize: '0.7rem', color: 'var(--text-secondary)', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>{calendarUrl}</code>
                <button
                  onClick={copyCalendarUrl}
                  style={{ background: copied ? 'var(--primary)' : 'white', border: '1px solid var(--sand)', borderRadius: 'var(--radius-md)', padding: '0.45rem', cursor: 'pointer', color: copied ? 'white' : 'var(--text-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                  title="Copiar link"
                >
                  {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Como subscrever:</div>
                <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', color: 'var(--text-secondary)' }}>
                  <span style={{ background: '#4285f4', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0, marginTop: '0.1rem' }}>G</span>
                  <div><strong style={{ color: 'var(--text-primary)' }}>Google Calendar</strong> → Outros calendários → <em>A partir de URL</em> → cola o link</div>
                </div>
                <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', color: 'var(--text-secondary)' }}>
                  <span style={{ background: '#555', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0, marginTop: '0.1rem' }}>A</span>
                  <div><strong style={{ color: 'var(--text-primary)' }}>Apple Calendar</strong> → Ficheiro → Nova subscrição de calendário → cola o link</div>
                </div>
                <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', color: 'var(--text-secondary)' }}>
                  <span style={{ background: '#0072c6', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0, marginTop: '0.1rem' }}>O</span>
                  <div><strong style={{ color: 'var(--text-primary)' }}>Outlook</strong> → Adicionar calendário → Subscrever da Web → cola o link</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
