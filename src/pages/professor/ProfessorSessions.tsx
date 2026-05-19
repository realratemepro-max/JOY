import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, setDoc, getDoc, where, limit, onSnapshot, runTransaction } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Session, SessionStudent, CancelReason } from '../../types';
import {
  Calendar, CalendarDays, Clock, MapPin, Users, Check, X as XIcon, Loader,
  ListOrdered, UserPlus, Banknote, Search, Copy, CheckCheck, UserCheck, MoreVertical,
  AlertTriangle, XCircle, CreditCard, AlertCircle, Mail,
} from 'lucide-react';
import { getFunctions } from 'firebase/functions';
import { RequestStudentPaymentModal } from '../../components/RequestStudentPaymentModal';

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTH_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

interface StudentDetail {
  userId: string;
  userName: string;
  studentIndex: number;
  sessionId: string;
  userEmail?: string;
  userPhone?: string;
  memberSince?: Date;
  dateOfBirth?: string;
  activePlan?: string;
  sessionsRemaining?: number;
  planExpiry?: Date;
  lastVisit?: { date: Date; name: string };
  status: string;
  cashPayment?: any;
}

interface Toast { msg: string; type: 'success' | 'error' }

export function ProfessorSessions() {
  const { user, professorData, professorPermissions } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Cancel/Substitute modal
  const [cancelModal, setCancelModal] = useState<{
    sessionId: string;
    action: 'cancel' | 'substitute';
    reason: CancelReason;
    reasonText: string;
    replacementProfessorId: string;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [otherProfessors, setOtherProfessors] = useState<{ id: string; name: string }[]>([]);

  const CANCEL_REASONS: Record<CancelReason, string> = {
    professor_sick: 'Doença do professor',
    space_unavailable: 'Espaço indisponível',
    weather: 'Meteorologia',
    other: 'Outro',
  };

  // Add student modal
  const [addStudentModal, setAddStudentModal] = useState<{ sessionId: string } | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Cash payment modal
  const [cashModal, setCashModal] = useState<{ sessionId: string; studentIndex: number; studentName: string } | null>(null);
  const [paymentRequestModal, setPaymentRequestModal] = useState<{ session: Session; student: any } | null>(null);
  const [cashAmount, setCashAmount] = useState('');

  // Calendar modal
  const [calendarModal, setCalendarModal] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Student detail modal
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const showToast = (msg: string, type: Toast['type'] = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!professorData) return;
    // Live listener — auto-updates when admin or other professors change session data
    const unsub = onSnapshot(query(collection(db, 'sessions'), orderBy('date', 'asc')), snap => {
      const all = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate() } as Session;
      });
      setSessions(all.filter(s => s.professorId === professorData!.id));
      setLoading(false);
    }, err => {
      console.error('sessions snapshot error', err);
      setLoading(false);
    });
    loadOtherProfessors();
    return () => unsub();
  }, [professorData]);

  // Kept for compatibility with code that might still reference it (no-op — onSnapshot handles updates)
  const loadSessions = async () => { /* noop: live listener takes care of it */ };

  const loadOtherProfessors = async () => {
    if (!professorPermissions.canSubstituteSession || !professorData) return;
    try {
      const snap = await getDocs(query(collection(db, 'professors'), where('isActive', '==', true), orderBy('name')));
      setOtherProfessors(snap.docs
        .filter(d => d.id !== professorData.id)
        .map(d => ({ id: d.id, name: d.data().name as string }))
      );
    } catch (e) { console.error('Failed to load other professors', e); }
  };

  const now = new Date();
  const todayKey = now.toDateString();
  const upcoming = sessions.filter(s => s.date >= now && s.status === 'scheduled');
  const past = sessions.filter(s => s.date < now || s.status === 'completed').reverse();
  const displayed = tab === 'upcoming' ? upcoming : past;

  // Group by day
  const dayGroups: { dateKey: string; date: Date; sessions: Session[] }[] = [];
  for (const s of displayed) {
    const key = s.date.toDateString();
    const group = dayGroups.find(g => g.dateKey === key);
    if (group) group.sessions.push(s);
    else dayGroups.push({ dateKey: key, date: s.date, sessions: [s] });
  }

  const markAttendance = async (session: Session, userId: string, status: 'attended' | 'absent' | 'enrolled') => {
    if (!professorPermissions.canMarkAttendance) return;
    setSaving(session.id + userId);
    try {
      const ref = doc(db, 'sessions', session.id);
      // Atomic: read fresh, mutate just this student, write back — never overwrites concurrent additions
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Sessão não encontrada');
        const fresh: SessionStudent[] = snap.data().enrolledStudents || [];
        const target = fresh.find(s => s.userId === userId);
        if (!target) throw new Error('Aluno já não está inscrito nesta aula');
        const updated = fresh.map(s => s.userId === userId ? { ...s, status: status as any } : s);
        tx.update(ref, { enrolledStudents: updated, updatedAt: new Date() });
      });
      const studentName = session.enrolledStudents.find(s => s.userId === userId)?.userName;
      if (status === 'attended') showToast(`Check-in de ${studentName} realizado`);
      if (studentDetail?.userId === userId) setStudentDetail(d => d ? { ...d, status } : d);
    } catch (err: any) { console.error(err); showToast(err?.message || 'Erro ao marcar presença', 'error'); }
    finally { setSaving(null); }
  };

  const openStudentDetail = async (session: Session, student: SessionStudent, idx: number) => {
    setStudentDetail({ userId: student.userId, userName: student.userName, studentIndex: idx, sessionId: session.id, status: student.status, cashPayment: student.cashPayment });
    setLoadingDetail(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', student.userId));
      const userData = userDoc.exists() ? userDoc.data() : {};
      // Load active purchase
      const purchasesSnap = await getDocs(query(collection(db, 'purchases'), where('userId', '==', student.userId), where('status', '==', 'active')));
      const activePurchase = purchasesSnap.docs.length > 0 ? purchasesSnap.docs[0].data() : null;
      // Find last attended session
      const allSessionsSnap = await getDocs(query(collection(db, 'sessions'), orderBy('date', 'desc'), limit(50)));
      let lastVisit: { date: Date; name: string } | undefined;
      for (const sd of allSessionsSnap.docs) {
        const data = sd.data();
        const sessionDate: Date = data.date?.toDate();
        if (sessionDate < now) {
          const found = data.enrolledStudents?.find((s: any) => s.userId === student.userId && s.status === 'attended');
          if (found) { lastVisit = { date: sessionDate, name: data.name || 'Aula' }; break; }
        }
      }
      setStudentDetail({
        userId: student.userId, userName: student.userName, studentIndex: idx, sessionId: session.id,
        status: student.status, cashPayment: student.cashPayment,
        userEmail: userData.email,
        userPhone: userData.phone,
        memberSince: userData.createdAt?.toDate ? userData.createdAt.toDate() : undefined,
        dateOfBirth: userData.dateOfBirth,
        activePlan: activePurchase?.planName,
        sessionsRemaining: activePurchase?.sessionsRemaining,
        planExpiry: activePurchase?.endDate?.toDate ? activePurchase.endDate.toDate() : undefined,
        lastVisit,
      });
    } catch (err) { console.error(err); }
    finally { setLoadingDetail(false); }
  };

  const openAddStudentModal = async (sessionId: string) => {
    setAddStudentModal({ sessionId });
    setStudentSearch('');
    if (allUsers.length === 0) {
      setLoadingUsers(true);
      try {
        // Use Cloud Function — clients aren't readable directly by professors due to Firestore rules
        const fn = httpsCallable(functions, 'listClientsForProfessor');
        const result: any = await fn({});
        setAllUsers(result?.data?.clients || []);
      } catch (err: any) {
        console.error(err);
        showToast(err?.message || 'Erro ao carregar lista de alunos', 'error');
      }
      finally { setLoadingUsers(false); }
    }
  };

  const handleAddStudent = async (sessionId: string, userId: string, userName: string) => {
    try {
      const ref = doc(db, 'sessions', sessionId);
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Sessão não encontrada');
        const fresh: SessionStudent[] = snap.data().enrolledStudents || [];
        if (fresh.some(s => s.userId === userId)) throw new Error('Aluno já inscrito');
        const updated = [...fresh, { userId, userName, status: 'enrolled' as const }];
        tx.update(ref, { enrolledStudents: updated, updatedAt: new Date() });
      });
      showToast(`${userName} adicionado à aula`);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Erro ao adicionar aluno', 'error');
    }
  };

  const handleCashPayment = async () => {
    if (!cashModal) return;
    const { sessionId, studentIndex, studentName } = cashModal;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) { alert('Valor inválido.'); return; }
    const students = [...session.enrolledStudents];
    students[studentIndex] = { ...students[studentIndex], status: 'attended', cashPayment: { amount, recordedBy: professorData?.id || 'professor', recordedAt: new Date() } };
    const payRef = doc(collection(db, 'payments'));
    await setDoc(payRef, {
      userId: students[studentIndex].userId, userEmail: '',
      amount, method: 'Numerário', status: 'Paid',
      identifier: `CASH-${Date.now()}`, type: 'single_class',
      sessionId, sessionDate: session.date, paidAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
    await updateDoc(doc(db, 'sessions', sessionId), { enrolledStudents: students, updatedAt: new Date() });
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, enrolledStudents: students } : s));
    setCashModal(null);
    setCashAmount('');
    showToast(`Pagamento de ${studentName} registado — ${amount.toFixed(2)}€`);
  };

  const openCalendarModal = async () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    let token = snap.data()?.calendarToken as string | undefined;
    if (!token) {
      token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
      await updateDoc(userRef, { calendarToken: token });
    }
    setCalendarUrl(`https://europe-west1-realrateme-731f1.cloudfunctions.net/userCalendar?uid=${user.uid}&token=${token}`);
    setCalendarModal(true);
    setCopied(false);
  };

  const openCancelModal = (sessionId: string) => {
    if (!professorPermissions.canCancelSessions && !professorPermissions.canSubstituteSession) return;
    const defaultAction: 'cancel' | 'substitute' = professorPermissions.canCancelSessions ? 'cancel' : 'substitute';
    setCancelModal({ sessionId, action: defaultAction, reason: 'professor_sick', reasonText: '', replacementProfessorId: '' });
  };

  const confirmCancelSession = async () => {
    if (!cancelModal) return;
    const { sessionId, action, reason, reasonText, replacementProfessorId } = cancelModal;
    setCancelling(true);
    try {
      if (action === 'cancel') {
        const fn = httpsCallable(functions, 'cancelSessionWithRefund');
        const result: any = await fn({ sessionId, reason, reasonText: reason === 'other' ? reasonText : '' });
        const refundedCount = (result?.data?.refunded || []).filter((r: any) => r.refunded).length;
        setCancelModal(null);
        showToast(`Aula cancelada — ${refundedCount} aluno${refundedCount === 1 ? '' : 's'} ${refundedCount === 1 ? 'reembolsado' : 'reembolsados'}`);
      } else {
        const fn = httpsCallable(functions, 'substituteSessionProfessor');
        const result: any = await fn({ sessionId, replacementProfessorId, reason, reasonText: reason === 'other' ? reasonText : '' });
        setCancelModal(null);
        showToast(`Substituição enviada para ${result?.data?.studentsNotified || 0} aluno(s) — aguarda resposta`);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Erro ao processar', 'error');
    } finally {
      setCancelling(false);
    }
    await loadSessions();
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="tabs-bar">
          <button className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
            Próximas ({upcoming.length})
          </button>
          <button className={`tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
            Passadas ({past.length})
          </button>
        </div>
        <button onClick={openCalendarModal} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'white', border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-md)', color: 'var(--primary)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
          <CalendarDays size={15} /> Subscrever Calendário
        </button>
      </div>

      {/* Day-grouped agenda */}
      {dayGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-xl)', color: 'var(--text-secondary)' }}>
          {tab === 'upcoming' ? 'Sem aulas agendadas' : 'Sem aulas no histórico'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {dayGroups.map(group => {
            const isToday = group.dateKey === todayKey;
            const dayLabel = `${DAY_NAMES_FULL[group.date.getDay()]}, ${group.date.getDate()} de ${MONTH_PT[group.date.getMonth()]} de ${group.date.getFullYear()}${isToday ? ' (Hoje)' : ''}`;
            return (
              <div key={group.dateKey}>
                {/* Day header */}
                <div style={{
                  padding: '0.625rem 1rem', marginBottom: '0.625rem',
                  background: isToday ? '#1e293b' : 'var(--sand)',
                  color: isToday ? 'white' : 'var(--text-secondary)',
                  borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600,
                }}>
                  {dayLabel}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {group.sessions.map(session => {
                    const isExpanded = expandedId === session.id;
                    const attended = session.enrolledStudents.filter(s => s.status === 'attended').length;
                    const absent = session.enrolledStudents.filter(s => s.status === 'absent').length;
                    const isPast = session.date < now;
                    const waitlist = (session.waitlist || []) as any[];

                    return (
                      <div key={session.id} style={{ background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                        {/* Session header row */}
                        <div
                          style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
                          onClick={() => setExpandedId(isExpanded ? null : session.id)}
                        >
                          <div style={{ minWidth: 48, textAlign: 'center', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.625rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DAY_NAMES_SHORT[session.dayOfWeek]}</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)', lineHeight: 1 }}>{session.date.getDate()}</div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{session.date.toLocaleDateString('pt-PT', { month: 'short' })}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {session.name && <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--primary)', marginBottom: '0.25rem' }}>{session.name}</div>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <Clock size={13} color="var(--text-muted)" />
                              <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{session.startTime}–{session.endTime}</span>
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={11} /> {session.locationName}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Users size={11} /> {session.enrolledStudents.length}/{session.maxCapacity}</span>
                              {waitlist.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#d97706' }}><ListOrdered size={11} /> {waitlist.length} espera</span>}
                              {isPast && attended > 0 && <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ {attended} check-ins</span>}
                              {isPast && absent > 0 && <span style={{ color: 'var(--error)' }}>✗ {absent} faltas</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexShrink: 0 }}>
                            {(professorPermissions.canCancelSessions || professorPermissions.canSubstituteSession) && !isPast && (
                              <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); openCancelModal(session.id); }} style={{ fontSize: '0.75rem' }}>
                                Cancelar
                              </button>
                            )}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Expanded check-in panel */}
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid var(--sand)', padding: '0.875rem 1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Check-in e Inscrição ({session.enrolledStudents.length}/{session.maxCapacity})
                              </span>
                              {professorPermissions.canAddStudentsToSession && (
                                <button className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => openAddStudentModal(session.id)}>
                                  <UserPlus size={13} /> Adicionar
                                </button>
                              )}
                            </div>

                            {session.enrolledStudents.length === 0 ? (
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Sem alunos inscritos.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {session.enrolledStudents.map((student, si) => {
                                  const s = student as any;
                                  const isLoading = saving === session.id + student.userId;
                                  const isAttended = student.status === 'attended';
                                  const isAbsent = student.status === 'absent';
                                  const isPaid = !!s.cashPayment || !!s.purchaseId || s.paymentStatus === 'paid';
                                  const paymentPendingOnline = s.paymentStatus === 'pending' && (s.paymentMethod === 'mbway' || s.paymentMethod === 'multibanco');
                                  const tryMarkAttended = () => {
                                    if (!isPaid && !isAttended) {
                                      alert(`${student.userName} ainda não pagou. Pede o pagamento primeiro.`);
                                      return;
                                    }
                                    markAttendance(session, student.userId, isAttended ? 'enrolled' : 'attended');
                                  };
                                  return (
                                    <div key={student.userId} style={{
                                      display: 'flex', alignItems: 'center', gap: '0.875rem',
                                      padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-lg)',
                                      background: isAttended ? 'rgba(124,154,114,0.08)' : isAbsent ? 'rgba(220,53,69,0.05)' : 'var(--beige)',
                                      border: `1px solid ${isAttended ? 'rgba(124,154,114,0.2)' : isAbsent ? 'rgba(220,53,69,0.15)' : 'transparent'}`,
                                    }}>
                                      {/* Avatar — click to open detail */}
                                      <div
                                        onClick={() => openStudentDetail(session, student, si)}
                                        style={{ width: 38, height: 38, borderRadius: '50%', background: isAttended ? 'var(--primary)' : 'var(--primary-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}
                                        title="Ver detalhes"
                                      >
                                        {student.userName?.charAt(0)?.toUpperCase()}
                                      </div>

                                      {/* Name */}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                          style={{ fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                          onClick={() => openStudentDetail(session, student, si)}
                                        >
                                          {student.userName}
                                        </div>
                                        {professorPermissions.canViewStudentContacts && (student as any).userEmail && (
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(student as any).userEmail}</div>
                                        )}
                                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', marginTop: '0.125rem', flexWrap: 'wrap' }}>
                                          {student.cashPayment && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: '#065f46', background: '#d1fae5', padding: '0.1rem 0.4rem', borderRadius: 999, fontWeight: 600 }}>
                                              <Banknote size={10} /> {student.cashPayment.amount}€ em mão
                                            </span>
                                          )}
                                          {!student.cashPayment && s.purchaseId && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: '#065f46', background: '#d1fae5', padding: '0.1rem 0.4rem', borderRadius: 999, fontWeight: 600 }}>
                                              <Check size={10} /> Pago{s.paymentMethod ? ` · ${s.paymentMethod === 'mbway' ? 'MB Way' : 'Multibanco'}` : ''}
                                            </span>
                                          )}
                                          {paymentPendingOnline && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: '#92400e', background: '#fef3c7', padding: '0.1rem 0.4rem', borderRadius: 999, fontWeight: 600 }}>
                                              <Clock size={10} /> {s.paymentMethod === 'mbway' ? 'MB Way pendente' : 'Multibanco pendente'}
                                            </span>
                                          )}
                                          {!isPaid && !paymentPendingOnline && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: '#991b1b', background: '#fee2e2', padding: '0.1rem 0.4rem', borderRadius: 999, fontWeight: 600 }}>
                                              <AlertCircle size={10} /> Por pagar
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Actions */}
                                      {isLoading ? (
                                        <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
                                      ) : (
                                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexShrink: 0 }}>
                                          {professorPermissions.canMarkAttendance && (
                                            <>
                                              {/* Main check-in button */}
                                              <button
                                                onClick={tryMarkAttended}
                                                disabled={!isPaid && !isAttended}
                                                style={{
                                                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                                                  padding: '0.4rem 0.875rem',
                                                  background: isAttended ? 'rgba(124,154,114,0.15)' : (!isPaid ? 'rgba(0,0,0,0.06)' : 'var(--primary)'),
                                                  color: isAttended ? 'var(--success)' : (!isPaid ? 'var(--text-muted)' : 'white'),
                                                  border: isAttended ? '1.5px solid rgba(124,154,114,0.35)' : 'none',
                                                  borderRadius: 'var(--radius-md)', cursor: !isPaid && !isAttended ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                                                  transition: 'all 0.15s',
                                                  opacity: !isPaid && !isAttended ? 0.6 : 1,
                                                }}
                                                title={!isPaid && !isAttended ? 'Pede pagamento antes de marcar presença' : ''}
                                              >
                                                <UserCheck size={14} />
                                                {isAttended ? 'Check-in realizado' : 'Check-in'}
                                              </button>
                                              {/* Absent button */}
                                              <button
                                                onClick={() => markAttendance(session, student.userId, isAbsent ? 'enrolled' : 'absent')}
                                                style={{
                                                  width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                                  background: isAbsent ? 'var(--error)' : 'rgba(0,0,0,0.07)',
                                                  color: isAbsent ? 'white' : 'var(--text-muted)',
                                                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                                                }}
                                                title="Marcar falta"
                                              >
                                                <XIcon size={14} />
                                              </button>
                                            </>
                                          )}
                                          {/* Request payment (MB Way / Multibanco / Cash) */}
                                          {!isPaid && (professorPermissions.canRequestOnlinePayment || professorPermissions.canAcceptCashPayment) && (
                                            <button
                                              onClick={() => setPaymentRequestModal({
                                                session,
                                                student: { userId: s.userId, userName: s.userName, userEmail: s.userEmail, userPhone: s.userPhone },
                                              })}
                                              style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(124,154,114,0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                              title="Pedir pagamento (direto)"
                                            >
                                              <CreditCard size={14} />
                                            </button>
                                          )}
                                          {/* Send payment link by email */}
                                          {!isPaid && professorPermissions.canRequestOnlinePayment && (
                                            <button
                                              onClick={async () => {
                                                if (!confirm(`Enviar link de pagamento por email para ${s.userName}?`)) return;
                                                try {
                                                  const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'sendPaymentLink');
                                                  const res: any = await fn({ sessionId: session.id, studentId: s.userId });
                                                  if (res.data?.emailSent) alert(`Email enviado para ${s.userName}.`);
                                                  else alert(`Email falhou: ${res.data?.emailError}\nLink:\n${res.data?.payUrl}`);
                                                } catch (err: any) {
                                                  alert(err?.message || 'Erro');
                                                }
                                              }}
                                              style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(193,127,89,0.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                              title="Enviar link de pagamento por email"
                                            >
                                              <Mail size={14} />
                                            </button>
                                          )}
                                          {/* More (opens student detail) */}
                                          <button
                                            onClick={() => openStudentDetail(session, student, si)}
                                            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            title="Detalhes do aluno"
                                          >
                                            <MoreVertical size={14} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Waitlist */}
                            {waitlist.length > 0 && (
                              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--sand)' }}>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#d97706', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                  <ListOrdered size={13} /> Lista de Espera
                                </div>
                                {waitlist.map((entry: any, i: number) => (
                                  <div key={entry.userId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--sand)' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                      {i + 1}
                                    </div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{entry.userName}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student Detail Modal */}
      {studentDetail && (
        <div className="modal-overlay" onClick={() => setStudentDetail(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ padding: '0 0 1.25rem', textAlign: 'center', borderBottom: '1px solid var(--beige)' }}>
              <button onClick={() => setStudentDetail(null)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><XIcon size={20} /></button>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--primary-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, margin: '1.5rem auto 0.75rem' }}>
                {studentDetail.userName?.charAt(0)?.toUpperCase()}
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{studentDetail.userName}</div>
              {/* Status */}
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.625rem' }}>
                {professorPermissions.canMarkAttendance && (
                  <>
                    <button
                      onClick={() => { markAttendance({ id: studentDetail.sessionId, enrolledStudents: sessions.find(s => s.id === studentDetail.sessionId)?.enrolledStudents || [] } as any, studentDetail.userId, studentDetail.status === 'attended' ? 'enrolled' : 'attended'); }}
                      style={{ padding: '0.5rem 1.125rem', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', background: studentDetail.status === 'attended' ? 'rgba(124,154,114,0.15)' : '#e0eaff', color: studentDetail.status === 'attended' ? 'var(--success)' : '#2563eb', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                    >
                      <UserCheck size={15} /> {studentDetail.status === 'attended' ? 'Cancelar check-in' : 'Fazer check-in'}
                    </button>
                    <button
                      onClick={() => { markAttendance({ id: studentDetail.sessionId, enrolledStudents: sessions.find(s => s.id === studentDetail.sessionId)?.enrolledStudents || [] } as any, studentDetail.userId, studentDetail.status === 'absent' ? 'enrolled' : 'absent'); }}
                      style={{ padding: '0.5rem 1.125rem', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', background: studentDetail.status === 'absent' ? 'rgba(220,53,69,0.12)' : 'rgba(220,53,69,0.08)', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                    >
                      <XIcon size={15} /> Cancelar reserva
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="modal-body" style={{ position: 'relative' }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: '1.5rem' }}><div className="spinner" /></div>
              ) : (
                <>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalhes do cliente</div>
                  {[
                    studentDetail.userEmail && ['E-mail', studentDetail.userEmail],
                    studentDetail.userPhone && ['Telemóvel', studentDetail.userPhone],
                    studentDetail.memberSince && ['Membro desde', studentDetail.memberSince.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })],
                    studentDetail.dateOfBirth && ['Data de nascimento', new Date(studentDetail.dateOfBirth).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })],
                    studentDetail.activePlan && ['Subscrição ativa', studentDetail.activePlan],
                    studentDetail.sessionsRemaining !== undefined && ['Aulas restantes', `${studentDetail.sessionsRemaining}`],
                    studentDetail.planExpiry && ['Expira em', studentDetail.planExpiry.toLocaleDateString('pt-PT')],
                    studentDetail.lastVisit && ['Última visita', `${studentDetail.lastVisit.date.toLocaleDateString('pt-PT')} — ${studentDetail.lastVisit.name}`],
                    studentDetail.cashPayment && ['Pagamento em mão', `${studentDetail.cashPayment.amount}€`],
                  ].filter(Boolean).map((row) => {
                    const [label, value] = row as [string, string];
                    return (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--beige)', fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                        <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStudentDetail(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {addStudentModal && (() => {
        const session = sessions.find(s => s.id === addStudentModal.sessionId);
        const enrolledIds = new Set(session?.enrolledStudents.map(s => s.userId) || []);
        const filtered = allUsers.filter(u =>
          !enrolledIds.has(u.id) &&
          (u.name.toLowerCase().includes(studentSearch.toLowerCase()) || u.email.toLowerCase().includes(studentSearch.toLowerCase()))
        );
        return (
          <div className="modal-overlay" onClick={() => setAddStudentModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserPlus size={18} /> Adicionar Aluno</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => setAddStudentModal(null)}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="input" placeholder="Pesquisar..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} autoFocus style={{ paddingLeft: '2.25rem' }} />
                </div>
                {loadingUsers ? <div style={{ textAlign: 'center', padding: '1rem' }}><div className="spinner" /></div> : filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum aluno disponível</div>
                ) : (
                  <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {filtered.slice(0, 20).map(u => (
                      <button key={u.id} className="btn btn-secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '0.625rem 0.875rem' }}
                        onClick={async () => { await handleAddStudent(addStudentModal.sessionId, u.id, u.name); setAddStudentModal(null); }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>{u.name.charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Request Student Payment Modal */}
      {paymentRequestModal && (
        <RequestStudentPaymentModal
          session={paymentRequestModal.session}
          student={paymentRequestModal.student}
          onClose={() => setPaymentRequestModal(null)}
          allowMethods={[
            ...(professorPermissions.canRequestOnlinePayment ? ['mbway', 'multibanco'] as const : []),
            ...(professorPermissions.canAcceptCashPayment ? ['cash'] as const : []),
          ]}
        />
      )}

      {/* Cash Payment Modal */}
      {cashModal && (
        <div className="modal-overlay" onClick={() => setCashModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Banknote size={18} /> Pagamento em Mão</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setCashModal(null)}><XIcon size={14} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>Pagamento de <strong>{cashModal.studentName}</strong></p>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Valor (€)</label>
                <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={cashAmount} onChange={e => setCashAmount(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCashModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCashPayment} disabled={!cashAmount || parseFloat(cashAmount) <= 0}>
                <Banknote size={14} /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Subscribe Modal */}
      {calendarModal && (
        <div className="modal-overlay" onClick={() => setCalendarModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CalendarDays size={18} /> Subscrever Calendário</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setCalendarModal(false)}><XIcon size={14} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Adiciona as tuas aulas ao teu calendário. O link atualiza automaticamente.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                <input readOnly value={calendarUrl} style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1.5px solid var(--sand)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--beige)', fontFamily: 'monospace', minWidth: 0 }} onClick={e => (e.target as HTMLInputElement).select()} />
                <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(calendarUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); }} style={{ flexShrink: 0, gap: '0.375rem' }}>
                  {copied ? <><CheckCheck size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                </button>
              </div>
              <div style={{ background: 'var(--beige)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Como adicionar:</div>
                <div><strong>Google Calendar:</strong> Outros calendários → + → A partir de URL → colar o link</div>
                <div style={{ marginTop: '0.25rem' }}><strong>Apple Calendar:</strong> Arquivo → Nova subscrição → colar o link</div>
                <div style={{ marginTop: '0.25rem' }}><strong>Outlook:</strong> Adicionar calendário → Subscrever pela Internet</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#1e293b' : '#dc2626',
          color: 'white', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)', zIndex: 2000, display: 'flex', alignItems: 'center', gap: '0.625rem',
          fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', animation: 'toast-in 0.2s ease',
        }}>
          {toast.type === 'success' ? <Check size={16} /> : <XIcon size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Cancel/Substitute Modal — same UX as admin */}
      {cancelModal && (() => {
        const session = sessions.find(s => s.id === cancelModal.sessionId);
        const enrolled = session?.enrolledStudents.filter(s => s.status === 'enrolled' || s.status === 'attended') || [];
        const showCancel = professorPermissions.canCancelSessions;
        const showSubstitute = professorPermissions.canSubstituteSession && otherProfessors.length > 0;
        return (
          <div className="prof-modal-overlay" onClick={() => !cancelling && setCancelModal(null)}>
            <div className="prof-modal-content" onClick={e => e.stopPropagation()}>
              <div className="prof-modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontFamily: 'var(--font-body)', fontSize: '1.0625rem' }}>
                  <AlertTriangle size={18} color="var(--error)" /> Cancelar / Substituir Aula
                </h3>
                <button className="btn btn-sm btn-secondary" onClick={() => setCancelModal(null)} disabled={cancelling}><XIcon size={14} /></button>
              </div>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Motivo</label>
                  <select className="input" value={cancelModal.reason} onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value as CancelReason })} style={{ width: '100%', marginTop: '0.375rem' }}>
                    {Object.entries(CANCEL_REASONS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                {cancelModal.reason === 'other' && (
                  <input className="input" value={cancelModal.reasonText} onChange={e => setCancelModal({ ...cancelModal, reasonText: e.target.value })} placeholder="Descreva o motivo..." />
                )}

                {(showCancel && showSubstitute) && (
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Ação</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.375rem' }}>
                      <button
                        type="button"
                        className={`prof-action-btn ${cancelModal.action === 'cancel' ? 'active' : ''}`}
                        onClick={() => setCancelModal({ ...cancelModal, action: 'cancel' })}
                      >
                        <XCircle size={16} />
                        <span>Cancelar Aula</span>
                        <small>Crédito/devolução para alunos</small>
                      </button>
                      <button
                        type="button"
                        className={`prof-action-btn ${cancelModal.action === 'substitute' ? 'active' : ''}`}
                        onClick={() => setCancelModal({ ...cancelModal, action: 'substitute' })}
                      >
                        <UserCheck size={16} />
                        <span>Substituir Professor</span>
                        <small>Alunos aceitam ou recusam</small>
                      </button>
                    </div>
                  </div>
                )}

                {cancelModal.action === 'substitute' && showSubstitute && (
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Novo Professor</label>
                    <select className="input" value={cancelModal.replacementProfessorId} onChange={e => setCancelModal({ ...cancelModal, replacementProfessorId: e.target.value })} style={{ width: '100%', marginTop: '0.375rem' }}>
                      <option value="">Selecionar professor...</option>
                      {otherProfessors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: '#92400e' }}>
                  <AlertTriangle size={14} />
                  {enrolled.length > 0
                    ? cancelModal.action === 'cancel'
                      ? <span>{enrolled.length} aluno{enrolled.length > 1 ? 's' : ''} inscrito{enrolled.length > 1 ? 's' : ''} — receberão a sessão de volta + extensão de validade</span>
                      : <span>{enrolled.length} aluno{enrolled.length > 1 ? 's' : ''} receberão notificação para aceitar ou recusar a substituição</span>
                    : <span>Sem alunos inscritos.</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem 1.25rem', borderTop: '1px solid var(--beige)', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setCancelModal(null)} disabled={cancelling}>Voltar</button>
                <button
                  className={`btn ${cancelModal.action === 'cancel' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={confirmCancelSession}
                  disabled={cancelling || (cancelModal.action === 'substitute' && !cancelModal.replacementProfessorId)}
                >
                  {cancelling ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : (
                    cancelModal.action === 'cancel' ? <><XCircle size={14} /> Cancelar Aula</> : <><UserCheck size={14} /> Substituir</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        .prof-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1500; padding: 1rem; }
        .prof-modal-content { background: white; border-radius: var(--radius-xl); width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden; }
        .prof-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--beige); }
        .prof-action-btn { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.875rem 0.625rem; background: white; border: 2px solid var(--sand); border-radius: var(--radius-lg); cursor: pointer; transition: all var(--transition-fast); text-align: center; }
        .prof-action-btn:hover { border-color: var(--primary); }
        .prof-action-btn.active { border-color: var(--error); background: rgba(220,53,69,0.04); }
        .prof-action-btn span { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); }
        .prof-action-btn small { font-size: 0.6875rem; color: var(--text-muted); line-height: 1.3; }
      `}</style>

      <style>{`
        .tabs-bar { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); width: fit-content; }
        .tab { background: none; border: none; padding: 0.5rem 1.25rem; font-family: var(--font-body); font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all 0.15s; }
        .tab.active { background: var(--primary); color: white; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .modal-content { background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); width: 100%; max-height: 90vh; overflow-y: auto; position: relative; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--beige); }
        .modal-header h3 { margin: 0; font-family: var(--font-body); font-size: 1.0625rem; font-weight: 600; }
        .modal-body { padding: 1.25rem 1.5rem; }
        .modal-footer { padding: 1rem 1.5rem; border-top: 1px solid var(--beige); display: flex; gap: 0.75rem; justify-content: flex-end; }
        @keyframes toast-in { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
