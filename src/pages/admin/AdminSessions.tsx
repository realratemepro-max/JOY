import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, Timestamp, increment, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Session, SessionStudent, Plan, Location, Professor, CancelReason, Credit } from '../../types';
import {
  Plus, Save, X, Loader, Calendar, MapPin, Clock, Check,
  XCircle, Minus, ChevronLeft, ChevronRight, Users, Edit2, Trash2, AlertTriangle, UserCheck, Video, Link,
  UserPlus, Banknote, Search,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getWeekDates(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function AdminSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekBase, setWeekBase] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [expandedExternalLoc, setExpandedExternalLoc] = useState<string | null>(null);
  const [gracePeriodDays, setGracePeriodDays] = useState(7);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{ sessionId: string } | null>(null);

  // Edit session
  const [editSessionData, setEditSessionData] = useState<any>(null);
  const [saveScopeModal, setSaveScopeModal] = useState<{ data: any } | null>(null);

  // Cancel/Substitute modal
  const [cancelModal, setCancelModal] = useState<{
    sessionId: string;
    action: 'cancel' | 'substitute';
    reason: CancelReason;
    reasonText: string;
    replacementProfessorId: string;
  } | null>(null);

  // New session form
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);

  interface RecurringSlot {
    dayOfWeek: number;
    startTime: string;
    duration: number;
    recurrenceEndDate: string; // yyyy-mm-dd
  }

  const [newSession, setNewSession] = useState({
    locationId: '', professorId: '',
    classType: 'group' as 'group' | 'private',
    name: '', notes: '',
    startTime: '09:00',
    duration: 60,
    mode: 'single' as 'single' | 'recurring',
    recurrenceEndDate: '',
    extraSlots: [] as RecurringSlot[],
    isHybrid: false,
    onlineCapacity: 10,
  });
  const [generatingZoom, setGeneratingZoom] = useState<string | null>(null);

  // Add student modal
  const [addStudentModal, setAddStudentModal] = useState<{ sessionId: string } | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Cash payment modal
  const [cashModal, setCashModal] = useState<{ sessionId: string; studentIndex: number; studentName: string } | null>(null);
  const [cashAmount, setCashAmount] = useState('');

  const addExtraSlot = () => setNewSession(prev => ({
    ...prev,
    extraSlots: [...prev.extraSlots, {
      dayOfWeek: 1,
      startTime: prev.startTime,
      duration: prev.duration,
      recurrenceEndDate: prev.recurrenceEndDate,
    }],
  }));
  const removeExtraSlot = (i: number) => setNewSession(prev => ({ ...prev, extraSlots: prev.extraSlots.filter((_, idx) => idx !== i) }));
  const updateExtraSlot = (i: number, field: keyof RecurringSlot, value: any) => {
    setNewSession(prev => {
      const extraSlots = [...prev.extraSlots];
      extraSlots[i] = { ...extraSlots[i], [field]: value };
      return { ...prev, extraSlots };
    });
  };

  const calcEndTime = (startTime: string, duration: number): string => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + duration;
    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  };

  useEffect(() => { loadData(); }, [weekBase]);

  const loadData = async () => {
    try {
      const weekDates = getWeekDates(weekBase);
      const weekStart = weekDates[0];
      const weekEnd = new Date(weekDates[6]);
      weekEnd.setHours(23, 59, 59);

      const [plansSnap, locsSnap, profsSnap, configSnap] = await Promise.all([
        getDocs(query(collection(db, 'plans'), orderBy('order'))),
        getDocs(query(collection(db, 'locations'), orderBy('order'))),
        getDocs(query(collection(db, 'professors'), orderBy('name'))),
        getDoc(doc(db, 'siteConfig', 'main')),
      ]);

      if (configSnap.exists()) {
        setGracePeriodDays(configSnap.data().cancellationGracePeriodDays ?? 7);
      }

      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan)));
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
      setProfessors(profsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Professor)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Live snapshot for sessions — admin sees professor check-ins / additions in real-time
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'sessions'), orderBy('date', 'asc')), snap => {
      const all = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Session;
      });
      setSessions(all);
    }, err => console.error('admin sessions snapshot error', err));
    return () => unsub();
  }, []);

  const weekDates = getWeekDates(weekBase);
  const today = new Date();

  const prevWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); };
  const nextWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); };
  const prevMonth = () => { const d = new Date(weekBase); d.setMonth(d.getMonth() - 1); setWeekBase(d); };
  const nextMonth = () => { const d = new Date(weekBase); d.setMonth(d.getMonth() + 1); setWeekBase(d); };
  const goToday = () => setWeekBase(new Date());

  // Month calendar helper
  const getMonthDates = (): (Date | null)[][] => {
    const year = weekBase.getFullYear();
    const month = weekBase.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
    const weeks: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = Array(startDow).fill(null);
    for (let day = 1; day <= lastDay.getDate(); day++) {
      currentWeek.push(new Date(year, month, day));
      if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }
    return weeks;
  };

  const getSessionsForDay = (date: Date) => sessions.filter(s => isSameDay(s.date, date));

  const handleAttendance = async (sessionId: string, studentIndex: number, status: 'attended' | 'absent' | 'cancelled') => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const targetUserId = session.enrolledStudents[studentIndex]?.userId;
    if (!targetUserId) return;
    try {
      const ref = doc(db, 'sessions', sessionId);
      // Atomic — read fresh array, update by userId (not by stale index), write back
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Sessão não encontrada');
        const fresh = (snap.data().enrolledStudents || []) as SessionStudent[];
        const updated = fresh.map(s => s.userId === targetUserId ? { ...s, status } : s);
        tx.update(ref, { enrolledStudents: updated, updatedAt: new Date() });
      });
    } catch (err) { console.error(err); }
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { status: 'completed', updatedAt: new Date() });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'completed' as const } : s));
    } catch (err) { console.error(err); }
  };

  const openCancelModal = (sessionId: string) => {
    setCancelModal({
      sessionId,
      action: 'cancel',
      reason: 'professor_sick',
      reasonText: '',
      replacementProfessorId: '',
    });
  };

  const CANCEL_REASONS: Record<CancelReason, string> = {
    professor_sick: 'Doença do professor',
    space_unavailable: 'Espaço indisponível',
    weather: 'Meteorologia',
    other: 'Outro',
  };

  const handleCancelOrSubstitute = async () => {
    if (!cancelModal) return;
    const { sessionId, action, reason, reasonText, replacementProfessorId } = cancelModal;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    try {
      setSaving(true);
      const now = new Date();

      if (action === 'cancel') {
        // Use Cloud Function to handle cancel + refund + endDate extension uniformly
        const fn = httpsCallable(functions, 'cancelSessionWithRefund');
        await fn({ sessionId, reason, reasonText: reason === 'other' ? reasonText : '' });

        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s, status: 'cancelled' as const, cancelReason: reason, cancelledAt: now,
        } : s));

      } else if (action === 'substitute') {
        // Substitute professor
        const newProf = professors.find(p => p.id === replacementProfessorId);
        if (!newProf) return;

        // Mark students as pending replacement response
        const updatedStudents = session.enrolledStudents.map(s => ({
          ...s,
          replacementResponse: 'pending' as const,
        }));

        await updateDoc(doc(db, 'sessions', sessionId), {
          status: 'replaced',
          cancelReason: reason,
          cancelReasonText: reason === 'other' ? reasonText : null,
          replacementProfessorId: newProf.id,
          replacementProfessorName: newProf.name,
          enrolledStudents: updatedStudents,
          updatedAt: Timestamp.fromDate(now),
        });

        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          status: 'replaced' as const,
          replacementProfessorId: newProf.id,
          replacementProfessorName: newProf.name,
          enrolledStudents: updatedStudents,
        } : s));
      }

      setCancelModal(null);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDeleteSingle = async (sessionId: string) => {
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setDeleteModal(null);
    } catch (err) { console.error(err); }
  };

  const handleDeleteFuture = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    try {
      // Find all future sessions with same day of week, start time, and location
      const toDelete = sessions.filter(s =>
        s.id === sessionId ||
        (s.date >= session.date &&
         s.dayOfWeek === session.dayOfWeek &&
         s.startTime === session.startTime &&
         s.locationId === session.locationId &&
         s.status === 'scheduled')
      );
      for (const s of toDelete) {
        await deleteDoc(doc(db, 'sessions', s.id));
      }
      setSessions(prev => prev.filter(s => !toDelete.some(d => d.id === s.id)));
      setDeleteModal(null);
    } catch (err) { console.error(err); }
  };

  const createSessionsForSlot = async (
    startTime: string, duration: number, dayOfWeek: number,
    baseDate: Date, recurrenceEndDate: string,
    sharedData: Record<string, any>, now: ReturnType<typeof Timestamp.fromDate>
  ) => {
    const endTime = calcEndTime(startTime, duration);
    const [sh, sm] = startTime.split(':').map(Number);

    // Find first occurrence of this day of week from baseDate
    const currentDow = baseDate.getDay();
    let daysUntil = (dayOfWeek - currentDow + 7) % 7;
    const firstDate = new Date(baseDate);
    firstDate.setDate(baseDate.getDate() + daysUntil);
    firstDate.setHours(sh, sm, 0, 0);

    const slotData = {
      ...sharedData,
      startTime,
      endTime,
      duration,
      createdAt: now,
      updatedAt: now,
    };

    if (recurrenceEndDate) {
      const endDate = new Date(recurrenceEndDate + 'T23:59:59');
      let current = new Date(firstDate);
      while (current <= endDate) {
        const ref = doc(collection(db, 'sessions'));
        await setDoc(ref, {
          ...slotData,
          date: Timestamp.fromDate(new Date(current)),
          dayOfWeek: current.getDay(),
          recurrence: 'weekly',
          recurrenceEndDate: Timestamp.fromDate(endDate),
        });
        current.setDate(current.getDate() + 7);
      }
    } else {
      const ref = doc(collection(db, 'sessions'));
      await setDoc(ref, {
        ...slotData,
        date: Timestamp.fromDate(firstDate),
        dayOfWeek: firstDate.getDay(),
        recurrence: 'none',
      });
    }
  };

  const handleCreateSession = async () => {
    if (!selectedDate || !newSession.locationId) return;
    try {
      setSaving(true);
      const loc = locations.find(l => l.id === newSession.locationId);
      const prof = professors.find(p => p.id === newSession.professorId);
      const now = Timestamp.fromDate(new Date());

      const sharedData = {
        name: newSession.name || '',
        locationId: newSession.locationId,
        locationName: loc?.name || '',
        professorId: newSession.professorId || null,
        professorName: prof?.name || null,
        enrolledStudents: [],
        maxCapacity: loc?.capacity || 10,
        classType: newSession.classType,
        isHybrid: newSession.isHybrid,
        onlineCapacity: newSession.isHybrid ? newSession.onlineCapacity : 0,
        onlineEnrolled: [],
        status: 'scheduled',
        notes: newSession.notes || '',
      };

      // 1. Create the base session (selected day)
      await createSessionsForSlot(
        newSession.startTime, newSession.duration,
        selectedDate.getDay(), selectedDate,
        newSession.mode === 'recurring' ? newSession.recurrenceEndDate : '',
        sharedData, now
      );

      // 2. Create extra slots (other days/times)
      if (newSession.mode === 'recurring') {
        for (const slot of newSession.extraSlots) {
          await createSessionsForSlot(
            slot.startTime, slot.duration,
            slot.dayOfWeek, selectedDate,
            slot.recurrenceEndDate,
            sharedData, now
          );
        }
      }

      setShowNewForm(false);
      setNewSession({ locationId: '', professorId: '', classType: 'group', name: '', notes: '', startTime: '09:00', duration: 60, mode: 'single', recurrenceEndDate: '', extraSlots: [], isHybrid: false, onlineCapacity: 10 });
      await loadData();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleGenerateZoom = async (session: Session) => {
    setGeneratingZoom(session.id);
    try {
      const startISO = session.date.toISOString().slice(0, 16);
      const fn = httpsCallable(functions, 'createZoomMeeting');
      const result: any = await fn({ sessionId: session.id, topic: session.name || `Aula ${session.date.toLocaleDateString('pt-PT')}`, startTime: startISO, durationMinutes: session.duration || 60 });
      if (result.data?.success) {
        setSessions(prev => prev.map(s => s.id === session.id ? { ...s, zoomLink: result.data.joinUrl, zoomMeetingId: result.data.meetingId } as any : s));
      } else {
        alert('Erro ao criar reunião Zoom');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao criar reunião Zoom');
    } finally {
      setGeneratingZoom(null);
    }
  };

  const openAddStudentModal = async (sessionId: string) => {
    setAddStudentModal({ sessionId });
    setStudentSearch('');
    if (allUsers.length === 0) {
      setLoadingUsers(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), orderBy('name')));
        setAllUsers(snap.docs.map(d => ({ id: d.id, name: d.data().name || d.data().email, email: d.data().email })));
      } catch (err) { console.error(err); }
      finally { setLoadingUsers(false); }
    }
  };

  const handleAddStudent = async (sessionId: string, userId: string, userName: string) => {
    try {
      const ref = doc(db, 'sessions', sessionId);
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Sessão não encontrada');
        const fresh = (snap.data().enrolledStudents || []) as SessionStudent[];
        if (fresh.some(s => s.userId === userId)) throw new Error('Este aluno já está inscrito nesta aula.');
        const updated = [...fresh, { userId, userName, status: 'enrolled' as const }];
        tx.update(ref, { enrolledStudents: updated, updatedAt: new Date() });
      });
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Erro ao adicionar aluno');
    }
  };

  const handleCashPayment = async () => {
    if (!cashModal) return;
    const { sessionId, studentIndex, studentName } = cashModal;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) { alert('Insere um valor válido.'); return; }

    const targetUserId = session.enrolledStudents[studentIndex]?.userId;
    if (!targetUserId) return;

    try {
      // Create payment record first
      const payRef = doc(collection(db, 'payments'));
      await setDoc(payRef, {
        userId: targetUserId,
        userEmail: '',
        amount,
        method: 'Numerário',
        status: 'Paid',
        identifier: `CASH-${Date.now()}`,
        type: 'single_class',
        sessionId,
        sessionDate: session.date,
        sessionName: session.name || `${session.startTime} ${session.locationName}`,
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Atomic enrolledStudents update
      const sessionRef = doc(db, 'sessions', sessionId);
      await runTransaction(db, async tx => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists()) throw new Error('Sessão não encontrada');
        const fresh = (snap.data().enrolledStudents || []) as SessionStudent[];
        const updated = fresh.map(s => s.userId === targetUserId ? {
          ...s,
          status: 'attended' as const,
          cashPayment: { amount, recordedBy: 'admin', recordedAt: new Date() },
        } : s);
        tx.update(sessionRef, { enrolledStudents: updated, updatedAt: new Date() });
      });
      setCashModal(null);
      setCashAmount('');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Erro ao registar pagamento');
    }
  };

  const openEditSession = (session: Session) => {
    setEditSessionData({
      id: session.id,
      name: session.name || '',
      locationId: session.locationId,
      professorId: session.professorId || '',
      startTime: session.startTime,
      duration: session.duration || 60,
      maxCapacity: session.maxCapacity || 10,
      classType: session.classType,
      isHybrid: (session as any).isHybrid || false,
      onlineCapacity: (session as any).onlineCapacity || 10,
      notes: session.notes || '',
      // for matching future sessions
      _origStartTime: session.startTime,
      _origDayOfWeek: session.dayOfWeek,
      _origLocationId: session.locationId,
      _origDate: session.date,
    });
  };

  const handleSaveSession = async (scope: 'single' | 'future') => {
    if (!editSessionData) return;
    try {
      setSaving(true);
      const loc = locations.find(l => l.id === editSessionData.locationId);
      const prof = professors.find(p => p.id === editSessionData.professorId);
      const endTime = calcEndTime(editSessionData.startTime, editSessionData.duration);

      const update: any = {
        name: editSessionData.name,
        locationId: editSessionData.locationId,
        locationName: loc?.name || '',
        professorId: editSessionData.professorId || null,
        professorName: prof?.name || null,
        startTime: editSessionData.startTime,
        endTime,
        duration: editSessionData.duration,
        maxCapacity: editSessionData.maxCapacity,
        classType: editSessionData.classType,
        isHybrid: editSessionData.isHybrid,
        onlineCapacity: editSessionData.isHybrid ? editSessionData.onlineCapacity : 0,
        notes: editSessionData.notes,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (scope === 'single') {
        await updateDoc(doc(db, 'sessions', editSessionData.id), update);
      } else {
        // Update this + all future sessions with same schedule
        const futures = sessions.filter(s =>
          (s.id === editSessionData.id ||
            (s.date >= editSessionData._origDate &&
             s.dayOfWeek === editSessionData._origDayOfWeek &&
             s.startTime === editSessionData._origStartTime &&
             s.locationId === editSessionData._origLocationId &&
             s.status === 'scheduled'))
        );
        for (const s of futures) {
          await updateDoc(doc(db, 'sessions', s.id), update);
        }
      }

      setSaveScopeModal(null);
      setEditSessionData(null);
      await loadData();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // Location color palette
  const LOC_COLORS = ['#7c9a72', '#c17f59', '#5b8db8', '#d4a843', '#9b6b9e', '#e07070', '#4a9e8f', '#8b7355'];
  const getLocColor = (locationId: string) => {
    const idx = locations.findIndex(l => l.id === locationId);
    return LOC_COLORS[idx >= 0 ? idx % LOC_COLORS.length : 0];
  };

  const statusColor = (status: string) => {
    if (status === 'attended') return 'var(--success)';
    if (status === 'absent') return 'var(--error)';
    if (status === 'cancelled') return 'var(--text-muted)';
    return 'var(--warning)';
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Navigation */}
      <div className="week-nav">
        <div className="view-toggle">
          <button className={`toggle-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>Semana</button>
          <button className={`toggle-btn ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>Mês</button>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={viewMode === 'week' ? prevWeek : prevMonth}><ChevronLeft size={16} /></button>
        <button className="btn btn-sm btn-secondary" onClick={goToday}>Hoje</button>
        <span className="week-label">
          {viewMode === 'week'
            ? `${weekDates[0].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} - ${weekDates[6].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : weekBase.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
          }
        </span>
        <button className="btn btn-sm btn-secondary" onClick={viewMode === 'week' ? nextWeek : nextMonth}><ChevronRight size={16} /></button>
      </div>

      {/* External sessions summary */}
      {viewMode === 'month' && (() => {
        const monthStart = new Date(weekBase.getFullYear(), weekBase.getMonth(), 1);
        const monthEnd = new Date(weekBase.getFullYear(), weekBase.getMonth() + 1, 0, 23, 59, 59);
        const monthSessions = sessions.filter(s => s.date >= monthStart && s.date <= monthEnd);
        const externalLocs = locations.filter(l => l.isExternal);
        if (externalLocs.length === 0) return null;
        const summaries = externalLocs.map(loc => {
          const locSessions = monthSessions.filter(s => s.locationId === loc.id).sort((a, b) => a.date.getTime() - b.date.getTime());
          const done = locSessions.filter(s => s.status === 'completed');
          const pending = locSessions.filter(s => s.status === 'scheduled');
          const cancelled = locSessions.filter(s => s.status === 'cancelled');
          const calcVal = (list: Session[]) => list.reduce((sum, s) => sum + ((loc.externalRatePerHour || 0) * (s.duration || 60) / 60), 0);
          return { loc, locSessions, total: locSessions.length, done: done.length, pending: pending.length, cancelled: cancelled.length, earned: calcVal(done), projected: calcVal(done) + calcVal(pending) };
        }).filter(s => s.total > 0);
        if (summaries.length === 0) return null;
        const totalEarned = summaries.reduce((sum, s) => sum + s.earned, 0);
        const totalProjected = summaries.reduce((sum, s) => sum + s.projected, 0);
        return (
          <>
            <div className="external-summary-bar">
              {summaries.map(s => (
                <div key={s.loc.id} className={`external-summary-item ${expandedExternalLoc === s.loc.id ? 'active' : ''}`} onClick={() => setExpandedExternalLoc(expandedExternalLoc === s.loc.id ? null : s.loc.id)} style={{ cursor: 'pointer', borderLeftColor: getLocColor(s.loc.id) }}>
                  <span className="ext-name">{s.loc.name}</span>
                  <span className="ext-stat">{s.done}/{s.total} aulas</span>
                  <span className="ext-earned">{s.earned.toFixed(0)}€</span>
                  {s.pending > 0 && <span className="ext-projected">→ {s.projected.toFixed(0)}€</span>}
                </div>
              ))}
              {summaries.length > 1 && (
                <div className="external-summary-total">
                  Total: <strong>{totalEarned.toFixed(0)}€</strong>
                  {totalProjected > totalEarned && <span className="ext-projected"> → {totalProjected.toFixed(0)}€</span>}
                </div>
              )}
            </div>

            {/* Location color legend */}
            <div className="loc-legend">
              {locations.filter(l => {
                const monthStart = new Date(weekBase.getFullYear(), weekBase.getMonth(), 1);
                const monthEnd = new Date(weekBase.getFullYear(), weekBase.getMonth() + 1, 0, 23, 59, 59);
                return sessions.some(s => s.locationId === l.id && s.date >= monthStart && s.date <= monthEnd);
              }).map(l => (
                <div key={l.id} className="loc-legend-item">
                  <span className="loc-legend-dot" style={{ background: getLocColor(l.id) }} />
                  <span>{l.name}</span>
                </div>
              ))}
            </div>

            {/* Expanded detail for selected external location */}
            {expandedExternalLoc && (() => {
              const s = summaries.find(x => x.loc.id === expandedExternalLoc);
              if (!s) return null;
              return (
                <div className="external-detail-panel">
                  <div className="ext-detail-header">
                    <h4>{s.loc.name} — {weekBase.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</h4>
                    <button className="btn btn-sm btn-secondary" onClick={() => setExpandedExternalLoc(null)}><X size={14} /></button>
                  </div>
                  <div className="ext-detail-stats">
                    <div className="ext-detail-stat">
                      <span className="ext-detail-stat-value">{s.done}</span>
                      <span className="ext-detail-stat-label">Concluídas</span>
                    </div>
                    <div className="ext-detail-stat">
                      <span className="ext-detail-stat-value">{s.pending}</span>
                      <span className="ext-detail-stat-label">Agendadas</span>
                    </div>
                    {s.cancelled > 0 && (
                      <div className="ext-detail-stat">
                        <span className="ext-detail-stat-value" style={{ color: 'var(--error)' }}>{s.cancelled}</span>
                        <span className="ext-detail-stat-label">Canceladas</span>
                      </div>
                    )}
                    <div className="ext-detail-stat">
                      <span className="ext-detail-stat-value" style={{ color: 'var(--success)' }}>{s.earned.toFixed(0)}€</span>
                      <span className="ext-detail-stat-label">Ganho</span>
                    </div>
                    <div className="ext-detail-stat">
                      <span className="ext-detail-stat-value" style={{ color: 'var(--primary)' }}>{s.projected.toFixed(0)}€</span>
                      <span className="ext-detail-stat-label">Previsto</span>
                    </div>
                    <div className="ext-detail-stat">
                      <span className="ext-detail-stat-value">{s.loc.externalRatePerHour || 0}€/h</span>
                      <span className="ext-detail-stat-label">Taxa</span>
                    </div>
                  </div>
                  <table className="ext-detail-table">
                    <thead>
                      <tr><th>Data</th><th>Horário</th><th>Duração</th><th>Estado</th><th>Valor</th></tr>
                    </thead>
                    <tbody>
                      {s.locSessions.map(sess => {
                        const val = (s.loc.externalRatePerHour || 0) * (sess.duration || 60) / 60;
                        return (
                          <tr key={sess.id} className={sess.status === 'cancelled' ? 'cancelled-row' : ''}>
                            <td>{sess.date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' })}</td>
                            <td>{sess.startTime} - {sess.endTime}</td>
                            <td>{sess.duration || 60}min</td>
                            <td>
                              <span className={`badge badge-sm badge-${sess.status === 'completed' ? 'success' : sess.status === 'cancelled' ? 'error' : 'primary'}`}>
                                {sess.status === 'completed' ? 'Feita' : sess.status === 'cancelled' ? 'Cancelada' : 'Agendada'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: sess.status === 'cancelled' ? 'var(--text-muted)' : 'var(--success)' }}>
                              {sess.status === 'cancelled' ? '—' : `${val.toFixed(0)}€`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        );
      })()}

      {/* Month Calendar */}
      {viewMode === 'month' && (
        <div className="month-grid-wrapper">
          <div className="month-header-row">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="month-header-cell">{d}</div>
            ))}
          </div>
          {getMonthDates().map((week, wi) => (
            <div key={wi} className="month-row">
              {week.map((date, di) => {
                if (!date) return <div key={di} className="month-cell empty" />;
                const daySessions = getSessionsForDay(date);
                const isToday = isSameDay(date, today);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                return (
                  <div key={di} className={`month-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${daySessions.length > 0 ? 'has-sessions' : ''}`} onClick={() => setSelectedDate(date)}>
                    <span className="month-day-num">{date.getDate()}</span>
                    {daySessions.length > 0 && (
                      <div className="month-timeline">
                        {daySessions
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .slice(0, 3)
                          .map((s, si) => {
                            const dur = s.duration || 60;
                            const color = getLocColor(s.locationId);
                            const isCancelled = s.status === 'cancelled';
                            return (
                              <div key={si} className={`tl-bar ${s.status}`} style={{ background: isCancelled ? '#e5e7eb' : color }} title={`${s.locationName} · ${dur}min`}>
                                <span className="tl-times">{s.startTime}-{s.endTime}</span>
                              </div>
                            );
                          })}
                        {daySessions.length > 3 && <span className="month-more">+{daySessions.length - 3}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Week Calendar */}
      {viewMode === 'week' && <div className="week-grid">
        {weekDates.map((date, i) => {
          const daySessions = getSessionsForDay(date);
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          return (
            <div key={i} className={`day-col ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedDate(date)}>
              <div className="day-header">
                <span className="day-name">{DAY_NAMES[date.getDay()]}</span>
                <span className="day-num">{date.getDate()}</span>
              </div>
              <div className="day-sessions">
                {daySessions.map(s => (
                  <div key={s.id} className={`session-dot ${s.status}`} title={`${s.startTime} - ${s.locationName} (${s.enrolledStudents.length})`}>
                    <span className="dot-time">{s.startTime}</span>
                    <span className="dot-count"><Users size={10} /> {s.enrolledStudents.length}</span>
                  </div>
                ))}
                {daySessions.length === 0 && <span className="no-sessions">-</span>}
              </div>
            </div>
          );
        })}
      </div>}

      {/* Day Detail */}
      {selectedDate && (
        <div className="day-detail">
          <div className="day-detail-header">
            <h3>
              <Calendar size={18} />
              {DAY_NAMES_FULL[selectedDate.getDay()]}, {selectedDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
            </h3>
            <button className="btn btn-sm btn-primary" onClick={() => setShowNewForm(true)}><Plus size={16} /> Nova Sessão</button>
          </div>

          {/* New Session Form */}
          {showNewForm && (
            <div className="new-session-form">
              {/* Row 1: Name + Type */}
              <div className="form-section-title">Dados da Aula</div>
              <div className="form-row">
                <input className="input" value={newSession.name} onChange={e => setNewSession({ ...newSession, name: e.target.value })} placeholder="Nome da aula (opcional)" style={{ flex: 1 }} />
                <select className="input" value={newSession.classType} onChange={e => setNewSession({ ...newSession, classType: e.target.value as any })} style={{ width: 150 }}>
                  <option value="group">Grupo</option>
                  <option value="private">Privada</option>
                  <option value="both">Grupo+Privada</option>
                </select>
              </div>
              {/* Hybrid toggle */}
              <div className="form-row" style={{ alignItems: 'center', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9375rem' }}>
                  <input type="checkbox" checked={newSession.isHybrid} onChange={e => setNewSession({ ...newSession, isHybrid: e.target.checked })} />
                  <Video size={16} color="#5b8db8" /> Aula Híbrida (online + presencial)
                </label>
                {newSession.isHybrid && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label className="label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Vagas online:</label>
                    <input type="number" className="input" value={newSession.onlineCapacity} onChange={e => setNewSession({ ...newSession, onlineCapacity: Number(e.target.value) })} style={{ width: 70 }} min={1} max={100} />
                  </div>
                )}
              </div>
              {/* Row 2: Location + Professor */}
              <div className="form-row">
                <select className="input" value={newSession.locationId} onChange={e => setNewSession({ ...newSession, locationId: e.target.value })}>
                  <option value="">Espaço...</option>
                  {locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <select className="input" value={newSession.professorId} onChange={e => setNewSession({ ...newSession, professorId: e.target.value })}>
                  <option value="">Professor...</option>
                  {professors.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Row 3: Base Time + Duration */}
              <div className="form-section-title" style={{ marginTop: '0.75rem' }}>Horário</div>
              <div className="form-row">
                <input type="time" className="input" value={newSession.startTime} onChange={e => setNewSession({ ...newSession, startTime: e.target.value })} style={{ width: 110 }} />
                <select className="input" value={newSession.duration} onChange={e => setNewSession({ ...newSession, duration: Number(e.target.value) })} style={{ width: 110 }}>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={75}>75 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                </select>
                <span className="slot-end-time">até {calcEndTime(newSession.startTime, newSession.duration)}</span>
              </div>

              {/* Row 4: Recurrence toggle */}
              <div className="form-section-title" style={{ marginTop: '0.75rem' }}>Recorrência</div>
              <div className="recurrence-toggle">
                <button className={`rec-btn ${newSession.mode === 'single' ? 'active' : ''}`} onClick={() => setNewSession({ ...newSession, mode: 'single', extraSlots: [], recurrenceEndDate: '' })}>
                  Única
                </button>
                <button className={`rec-btn ${newSession.mode === 'recurring' ? 'active' : ''}`} onClick={() => setNewSession({ ...newSession, mode: 'recurring' })}>
                  Recorrente
                </button>
              </div>

              {/* Recurring section */}
              {newSession.mode === 'recurring' && (
                <div className="recurring-section">
                  {/* Base day recurrence */}
                  <div className="slot-row">
                    <span className="slot-label">{DAY_NAMES_FULL[selectedDate.getDay()]}</span>
                    <span className="slot-time">{newSession.startTime} → {calcEndTime(newSession.startTime, newSession.duration)}</span>
                    <span className="slot-recurrence-label">até</span>
                    <input type="date" className="input" value={newSession.recurrenceEndDate} onChange={e => setNewSession({ ...newSession, recurrenceEndDate: e.target.value })} style={{ width: 155 }} />
                  </div>

                  {/* Extra slots */}
                  {newSession.extraSlots.map((slot, i) => (
                    <div key={i} className="slot-row">
                      <select className="input" value={slot.dayOfWeek} onChange={e => updateExtraSlot(i, 'dayOfWeek', Number(e.target.value))} style={{ width: 110 }}>
                        {DAY_NAMES_FULL.map((name, di) => <option key={di} value={di}>{name}</option>)}
                      </select>
                      <input type="time" className="input" value={slot.startTime} onChange={e => updateExtraSlot(i, 'startTime', e.target.value)} style={{ width: 100 }} />
                      <select className="input" value={slot.duration} onChange={e => updateExtraSlot(i, 'duration', Number(e.target.value))} style={{ width: 100 }}>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                        <option value={75}>75 min</option>
                        <option value={90}>90 min</option>
                        <option value={120}>120 min</option>
                      </select>
                      <span className="slot-recurrence-label">até</span>
                      <input type="date" className="input" value={slot.recurrenceEndDate} onChange={e => updateExtraSlot(i, 'recurrenceEndDate', e.target.value)} style={{ width: 155 }} />
                      <button className="btn btn-sm btn-danger" onClick={() => removeExtraSlot(i)} title="Remover"><X size={14} /></button>
                    </div>
                  ))}

                  <button className="btn btn-sm btn-secondary" onClick={addExtraSlot} style={{ marginTop: '0.5rem' }}>
                    <Plus size={14} /> Adicionar Horário
                  </button>
                </div>
              )}

              {/* Notes + Actions */}
              <div className="form-row" style={{ marginTop: '0.75rem' }}>
                <input className="input" value={newSession.notes} onChange={e => setNewSession({ ...newSession, notes: e.target.value })} placeholder="Notas (opcional)" style={{ flex: 1 }} />
              </div>
              <div className="form-row" style={{ marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-sm" onClick={handleCreateSession} disabled={saving || !newSession.locationId}>
                  {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={14} /> Criar</>}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowNewForm(false)}><X size={14} /></button>
              </div>
            </div>
          )}

          {/* Sessions List for Selected Day */}
          {getSessionsForDay(selectedDate).length === 0 && !showNewForm ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sem sessões neste dia</div>
          ) : (
            <div className="sessions-detail-list">
              {getSessionsForDay(selectedDate).map(session => {
                const sessionLoc = locations.find(l => l.id === session.locationId);
                const isExternal = sessionLoc?.isExternal || false;
                const externalEarnings = isExternal && sessionLoc?.externalRatePerHour ? (sessionLoc.externalRatePerHour * (session.duration || 60) / 60) : 0;
                return (
                <div key={session.id} className={`session-detail-card ${session.status}`} style={{ borderLeftColor: getLocColor(session.locationId) }}>
                  <div className="session-detail-header">
                    <div className="session-detail-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Clock size={16} /> <strong>{session.startTime} - {session.endTime}</strong>
                        <span className={`badge badge-${session.status === 'scheduled' ? 'primary' : session.status === 'completed' ? 'success' : session.status === 'replaced' ? 'warning' : 'error'}`}>
                          {session.status === 'scheduled' ? 'Agendada' : session.status === 'completed' ? 'Concluída' : session.status === 'replaced' ? 'Substituído' : 'Cancelada'}
                        </span>
                        {isExternal && <span className="badge badge-accent">Externa</span>}
                        {session.replacementProfessorName && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <UserCheck size={12} /> {session.replacementProfessorName}
                          </span>
                        )}
                        {!isExternal && <span className={`badge ${session.classType === 'private' ? 'badge-primary' : session.classType === 'both' ? '' : 'badge-success'}`} style={session.classType === 'both' ? { background: '#cffafe', color: '#0e7490' } : {}}>{session.classType === 'private' ? 'Privada' : session.classType === 'both' ? 'Grupo+Privada' : 'Grupo'}</span>}
                        {(session as any).isHybrid && <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}><Video size={10} style={{ marginRight: 3 }} />Híbrida</span>}
                        {session.professorName && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{session.professorName}</span>
                        )}
                        {isExternal && externalEarnings > 0 && (
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--success)' }}>{externalEarnings.toFixed(0)}€</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                        <MapPin size={14} /> {session.locationName}
                      </div>
                    </div>
                    <div className="session-detail-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => openEditSession(session)} title="Editar"><Edit2 size={14} /></button>
                      {(session as any).isHybrid && (
                        (session as any).zoomLink
                          ? <a href={(session as any).zoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" title="Abrir Zoom"><Video size={14} /> Zoom</a>
                          : <button className="btn btn-sm btn-secondary" onClick={() => handleGenerateZoom(session)} disabled={generatingZoom === session.id} title="Gerar link Zoom">
                              {generatingZoom === session.id ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><Video size={14} /> Gerar Zoom</>}
                            </button>
                      )}
                      {session.status === 'scheduled' && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => handleCompleteSession(session.id)} title="Marcar como concluída"><Check size={14} /> Concluir</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => openCancelModal(session.id)} title="Cancelar / Substituir"><XCircle size={14} /></button>
                        </>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteModal({ sessionId: session.id })} title="Apagar"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {/* Inline Edit Form */}
                  {editSessionData?.id === session.id && (
                    <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', margin: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="label">Nome</label>
                          <input className="input" value={editSessionData.name} onChange={e => setEditSessionData({ ...editSessionData, name: e.target.value })} placeholder="Nome da aula" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="label">Tipo</label>
                          <select className="input" value={editSessionData.classType} onChange={e => setEditSessionData({ ...editSessionData, classType: e.target.value })}>
                            <option value="group">Grupo</option>
                            <option value="private">Privada</option>
                            <option value="both">Grupo+Privada</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="label">Espaço</label>
                          <select className="input" value={editSessionData.locationId} onChange={e => setEditSessionData({ ...editSessionData, locationId: e.target.value })}>
                            {locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="label">Professor</label>
                          <select className="input" value={editSessionData.professorId} onChange={e => setEditSessionData({ ...editSessionData, professorId: e.target.value })}>
                            <option value="">—</option>
                            {professors.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="label">Hora</label>
                          <input type="time" className="input" value={editSessionData.startTime} onChange={e => setEditSessionData({ ...editSessionData, startTime: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="label">Duração</label>
                          <select className="input" value={editSessionData.duration} onChange={e => setEditSessionData({ ...editSessionData, duration: Number(e.target.value) })}>
                            <option value={45}>45 min</option>
                            <option value={60}>60 min</option>
                            <option value={75}>75 min</option>
                            <option value={90}>90 min</option>
                            <option value={120}>120 min</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="label">Vagas Presenciais</label>
                          <input type="number" className="input" value={editSessionData.maxCapacity} onChange={e => setEditSessionData({ ...editSessionData, maxCapacity: Number(e.target.value) })} min={1} />
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9375rem' }}>
                        <input type="checkbox" checked={editSessionData.isHybrid} onChange={e => setEditSessionData({ ...editSessionData, isHybrid: e.target.checked })} />
                        <Video size={15} color="#5b8db8" /> Aula Híbrida
                        {editSessionData.isHybrid && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                            <span style={{ fontSize: '0.875rem' }}>Vagas online:</span>
                            <input type="number" className="input" value={editSessionData.onlineCapacity} onChange={e => setEditSessionData({ ...editSessionData, onlineCapacity: Number(e.target.value) })} style={{ width: 70 }} min={1} />
                          </span>
                        )}
                      </label>
                      <input className="input" value={editSessionData.notes} onChange={e => setEditSessionData({ ...editSessionData, notes: e.target.value })} placeholder="Notas (opcional)" />
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditSessionData(null)}>Cancelar</button>
                        <button className="btn btn-primary btn-sm" onClick={() => setSaveScopeModal({ data: editSessionData })} disabled={saving}><Save size={14} /> Guardar</button>
                      </div>
                    </div>
                  )}

                  {/* Enrolled Students + Attendance */}
                  <div className="students-list">
                    <div className="students-header">
                      <span>Alunos ({session.enrolledStudents.length}/{session.maxCapacity})</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {((session as any).waitlist || []).length > 0 && (
                          <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#d97706', padding: '0.125rem 0.5rem', borderRadius: 999, fontWeight: 600 }}>
                            ⏳ {((session as any).waitlist || []).length} em espera
                          </span>
                        )}
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                          onClick={() => openAddStudentModal(session.id)}
                          title="Adicionar aluno registado"
                        >
                          <UserPlus size={13} /> Adicionar Aluno
                        </button>
                      </div>
                    </div>
                    {session.enrolledStudents.length === 0 && (
                      <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sem alunos inscritos</div>
                    )}
                    {session.enrolledStudents.map((student, si) => (
                      <div key={si} className="student-row">
                        <div className="student-avatar">{student.userName.charAt(0).toUpperCase()}</div>
                        <span className="student-name">{student.userName}</span>
                        <div className="attendance-btns">
                          <button
                            className={`att-btn ${student.status === 'attended' ? 'active-success' : ''}`}
                            onClick={() => handleAttendance(session.id, si, 'attended')}
                            title="Presente"
                          ><Check size={14} /></button>
                          <button
                            className={`att-btn ${student.status === 'absent' ? 'active-error' : ''}`}
                            onClick={() => handleAttendance(session.id, si, 'absent')}
                            title="Faltou"
                          ><XCircle size={14} /></button>
                          <button
                            className={`att-btn ${student.status === 'cancelled' ? 'active-muted' : ''}`}
                            onClick={() => handleAttendance(session.id, si, 'cancelled')}
                            title="Cancelou"
                          ><Minus size={14} /></button>
                          {student.cashPayment ? (
                            <span title={`Pago em mão: ${student.cashPayment.amount}€`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, padding: '0 0.375rem' }}>
                              <Banknote size={13} /> {student.cashPayment.amount}€
                            </span>
                          ) : (
                            <button
                              className="att-btn"
                              onClick={() => { setCashModal({ sessionId: session.id, studentIndex: si, studentName: student.userName }); setCashAmount(''); }}
                              title="Registar pagamento em mão"
                              style={{ color: 'var(--accent)' }}
                            ><Banknote size={14} /></button>
                          )}
                        </div>
                        <span className="att-label" style={{ color: statusColor(student.status) }}>
                          {student.status === 'attended' ? 'Presente' : student.status === 'absent' ? 'Faltou' : student.status === 'cancelled' ? 'Cancelou' : 'Inscrito'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Waitlist */}
                  {((session as any).waitlist || []).length > 0 && (
                    <div className="students-list" style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--sand)' }}>
                      <div className="students-header" style={{ color: '#d97706' }}>
                        <span>⏳ Lista de Espera ({((session as any).waitlist || []).length})</span>
                      </div>
                      {((session as any).waitlist || []).map((entry: any, wi: number) => (
                        <div key={wi} className="student-row">
                          <div className="student-avatar" style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.75rem', fontWeight: 700 }}>#{entry.position || wi + 1}</div>
                          <span className="student-name">{entry.userName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{entry.joinedAt?.toDate ? entry.joinedAt.toDate().toLocaleDateString('pt-PT') : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {session.notes && <div style={{ padding: '0.75rem 1rem', background: 'var(--beige)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{session.notes}</div>}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save Scope Modal */}
      {saveScopeModal && (
        <div className="modal-overlay" onClick={() => setSaveScopeModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3><Save size={18} /> Guardar Alterações</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSaveScopeModal(null)}><X size={14} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
              Esta aula faz parte de uma série recorrente. O que queres alterar?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => handleSaveSession('single')} disabled={saving}>
                <div>
                  <strong>Apenas esta aula</strong>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>As outras aulas da série não são afetadas.</div>
                </div>
              </button>
              <button className="btn btn-primary" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => handleSaveSession('future')} disabled={saving}>
                <div>
                  <strong>Esta e todas as futuras</strong>
                  <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)', marginTop: '0.125rem' }}>Atualiza esta aula e todas as seguintes no mesmo horário.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (() => {
        const session = sessions.find(s => s.id === deleteModal.sessionId);
        if (!session) return null;
        const futureCount = sessions.filter(s =>
          s.date >= session.date &&
          s.dayOfWeek === session.dayOfWeek &&
          s.startTime === session.startTime &&
          s.locationId === session.locationId &&
          s.status === 'scheduled'
        ).length;
        return (
          <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><Trash2 size={18} /> Apagar Aula</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => setDeleteModal(null)}><X size={14} /></button>
              </div>
              <div className="modal-body">
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <strong>{session.startTime}</strong> — {session.locationName} — {session.date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <div className="delete-options">
                  <button className="delete-option-btn" onClick={() => handleDeleteSingle(deleteModal.sessionId)}>
                    <Trash2 size={18} />
                    <div>
                      <strong>Apenas esta aula</strong>
                      <small>Apaga só esta sessão</small>
                    </div>
                  </button>
                  {futureCount > 1 && (
                    <button className="delete-option-btn danger" onClick={() => handleDeleteFuture(deleteModal.sessionId)}>
                      <Trash2 size={18} />
                      <div>
                        <strong>Esta e todas as futuras</strong>
                        <small>{futureCount} aulas ({DAY_NAMES_FULL[session.dayOfWeek]}s às {session.startTime} em {session.locationName})</small>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cancel/Substitute Modal */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><AlertTriangle size={18} /> Cancelar / Substituir Aula</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setCancelModal(null)}><X size={14} /></button>
            </div>

            <div className="modal-body">
              <label className="form-label">Motivo</label>
              <select className="input" value={cancelModal.reason} onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value as CancelReason })} style={{ width: '100%', marginBottom: '0.75rem' }}>
                {Object.entries(CANCEL_REASONS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>

              {cancelModal.reason === 'other' && (
                <input className="input" value={cancelModal.reasonText} onChange={e => setCancelModal({ ...cancelModal, reasonText: e.target.value })} placeholder="Descreva o motivo..." style={{ width: '100%', marginBottom: '0.75rem' }} />
              )}

              <label className="form-label">Ação</label>
              <div className="cancel-action-btns">
                <button
                  className={`cancel-action-btn ${cancelModal.action === 'cancel' ? 'active' : ''}`}
                  onClick={() => setCancelModal({ ...cancelModal, action: 'cancel' })}
                >
                  <XCircle size={16} />
                  <span>Cancelar Aula</span>
                  <small>Crédito/devolução para alunos</small>
                </button>
                <button
                  className={`cancel-action-btn ${cancelModal.action === 'substitute' ? 'active' : ''}`}
                  onClick={() => setCancelModal({ ...cancelModal, action: 'substitute' })}
                >
                  <UserCheck size={16} />
                  <span>Substituir Professor</span>
                  <small>Alunos aceitam ou recusam</small>
                </button>
              </div>

              {cancelModal.action === 'substitute' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label className="form-label">Novo Professor</label>
                  <select className="input" value={cancelModal.replacementProfessorId} onChange={e => setCancelModal({ ...cancelModal, replacementProfessorId: e.target.value })} style={{ width: '100%' }}>
                    <option value="">Selecionar professor...</option>
                    {professors.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {cancelModal.action === 'cancel' && (() => {
                const session = sessions.find(s => s.id === cancelModal.sessionId);
                const enrolled = session?.enrolledStudents.filter(s => s.status === 'enrolled' || s.status === 'attended') || [];
                return enrolled.length > 0 ? (
                  <div className="cancel-impact">
                    <AlertTriangle size={14} />
                    <span>{enrolled.length} aluno{enrolled.length > 1 ? 's' : ''} inscrito{enrolled.length > 1 ? 's' : ''} — receberão crédito/devolução</span>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCancelModal(null)}>Voltar</button>
              <button
                className={`btn ${cancelModal.action === 'cancel' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleCancelOrSubstitute}
                disabled={saving || (cancelModal.action === 'substitute' && !cancelModal.replacementProfessorId)}
              >
                {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : cancelModal.action === 'cancel' ? 'Cancelar Aula' : 'Substituir Professor'}
              </button>
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
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
              <div className="modal-header">
                <h3><UserPlus size={18} /> Adicionar Aluno</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => setAddStudentModal(null)}><X size={14} /></button>
              </div>
              <div className="modal-body">
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="input"
                    placeholder="Pesquisar por nome ou email..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    autoFocus
                    style={{ paddingLeft: '2.25rem' }}
                  />
                </div>
                {loadingUsers ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}><div className="spinner" /></div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {studentSearch ? 'Nenhum aluno encontrado' : 'Todos os alunos já estão inscritos'}
                  </div>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {filtered.slice(0, 20).map(u => (
                      <button
                        key={u.id}
                        className="btn btn-secondary"
                        style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '0.625rem 0.875rem' }}
                        onClick={async () => {
                          await handleAddStudent(addStudentModal.sessionId, u.id, u.name);
                          setAddStudentModal(null);
                        }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{u.name}</div>
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

      {/* Cash Payment Modal */}
      {cashModal && (
        <div className="modal-overlay" onClick={() => setCashModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3><Banknote size={18} /> Pagamento em Mão</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setCashModal(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Registar pagamento em numerário de <strong>{cashModal.studentName}</strong>
              </p>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Valor (€)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 12.00"
                  value={cashAmount}
                  onChange={e => setCashAmount(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCashModal(null)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleCashPayment}
                disabled={!cashAmount || parseFloat(cashAmount) <= 0}
              >
                <Banknote size={14} /> Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .week-nav { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .view-toggle { display: flex; background: white; border-radius: var(--radius-lg); padding: 0.2rem; box-shadow: var(--shadow-sm); }
        .toggle-btn { background: none; border: none; padding: 0.375rem 0.875rem; font-family: var(--font-body); font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .toggle-btn.active { background: var(--primary); color: white; }

        .month-grid-wrapper { background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); overflow: hidden; margin-bottom: 2rem; }
        .month-header-row { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 2px solid var(--beige); }
        .month-header-cell { text-align: center; padding: 0.625rem; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
        .month-row { display: grid; grid-template-columns: repeat(7, 1fr); }
        .month-cell { min-height: 95px; padding: 0.375rem; border-right: 1px solid var(--beige); border-bottom: 1px solid var(--beige); cursor: pointer; transition: background var(--transition-fast); overflow: hidden; display: flex; flex-direction: column; }
        .month-cell:nth-child(7n) { border-right: none; }
        .month-cell:hover { background: rgba(124,154,114,0.05); }
        .month-cell.empty { background: var(--bg-secondary); cursor: default; }
        .month-cell.today { background: rgba(124,154,114,0.08); }
        .month-cell.selected { background: rgba(124,154,114,0.15); box-shadow: inset 0 0 0 2px var(--primary); }
        .month-cell.has-sessions .month-day-num { font-weight: 700; color: var(--primary-dark); }
        .month-day-num { font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); display: block; margin-bottom: 0.25rem; }
        .month-timeline { flex: 1; display: flex; flex-direction: column; gap: 2px; min-height: 0; }
        .tl-bar { width: 100%; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; cursor: default; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
        .tl-bar:hover { transform: scale(1.04); z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        .tl-bar.cancelled { opacity: 0.35; }
        .tl-bar.completed { opacity: 0.6; }
        .tl-times { font-size: 0.625rem; font-weight: 700; color: white; white-space: nowrap; line-height: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.25); letter-spacing: -0.01em; }
        .month-more { font-size: 0.5625rem; color: var(--text-muted); margin-top: 1px; text-align: center; }
        .week-label { font-weight: 600; font-size: 1rem; flex: 1; text-align: center; }
        .week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; margin-bottom: 2rem; }
        .day-col { background: white; border-radius: var(--radius-lg); padding: 0.75rem; cursor: pointer; transition: all var(--transition-fast); border: 2px solid transparent; min-height: 100px; }
        .day-col:hover { box-shadow: var(--shadow-md); }
        .day-col.today { border-color: var(--primary); }
        .day-col.selected { background: rgba(124, 154, 114, 0.08); border-color: var(--primary-dark); }
        .day-header { text-align: center; margin-bottom: 0.5rem; }
        .day-name { display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600; }
        .day-num { font-size: 1.25rem; font-weight: 700; font-family: var(--font-heading); }
        .day-col.today .day-num { color: var(--primary); }
        .day-sessions { display: flex; flex-direction: column; gap: 0.25rem; }
        .session-dot { display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0.375rem; border-radius: var(--radius-sm); font-size: 0.6875rem; }
        .session-dot.scheduled { background: #dbeafe; color: #1e40af; }
        .session-dot.completed { background: #dcfce7; color: #166534; }
        .session-dot.cancelled { background: #fee2e2; color: #991b1b; opacity: 0.6; }
        .dot-time { font-weight: 600; }
        .dot-count { display: flex; align-items: center; gap: 0.125rem; }
        .no-sessions { text-align: center; color: var(--text-muted); font-size: 0.75rem; }

        .day-detail { background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); padding: 1.5rem; }
        .day-detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
        .day-detail-header h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 0.5rem; }

        .new-session-form { background: var(--bg-secondary); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.25rem; border: 2px dashed var(--primary-light); }
        .form-section-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.5rem; display: flex; align-items: center; }
        .form-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
        .form-row:last-child { margin-bottom: 0; }
        .recurrence-toggle { display: flex; background: white; border-radius: var(--radius-lg); padding: 0.2rem; box-shadow: var(--shadow-sm); margin-bottom: 0.75rem; width: fit-content; }
        .rec-btn { background: none; border: none; padding: 0.375rem 1rem; font-family: var(--font-body); font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .rec-btn.active { background: var(--primary); color: white; }

        .recurring-section { background: white; border-radius: var(--radius-lg); padding: 0.75rem; border: 1px solid var(--sand); margin-bottom: 0.5rem; }
        .slot-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; padding: 0.5rem 0.625rem; background: var(--bg-secondary); border-radius: var(--radius-md); }
        .slot-row:last-of-type { margin-bottom: 0; }
        .slot-label { font-weight: 600; font-size: 0.875rem; min-width: 80px; }
        .slot-time { font-size: 0.8125rem; color: var(--text-secondary); min-width: 100px; }
        .slot-recurrence-label { font-size: 0.75rem; color: var(--text-muted); font-weight: 500; }
        .slot-end-time { font-size: 0.8125rem; color: var(--text-muted); white-space: nowrap; }

        .sessions-detail-list { display: flex; flex-direction: column; gap: 1rem; }
        .session-detail-card { border: 1px solid var(--sand); border-radius: var(--radius-lg); overflow: hidden; border-left: 4px solid var(--primary); }
        .session-detail-card.cancelled { opacity: 0.6; }
        .session-detail-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem; background: var(--bg-secondary); flex-wrap: wrap; gap: 0.75rem; }
        .session-detail-actions { display: flex; gap: 0.375rem; }

        .students-list { padding: 0.75rem 1rem; }
        .students-header { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600; margin-bottom: 0.5rem; }
        .student-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid var(--beige); }
        .student-row:last-child { border: none; }
        .student-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
        .student-name { flex: 1; font-weight: 500; font-size: 0.9375rem; }
        .attendance-btns { display: flex; gap: 0.25rem; }
        .att-btn { width: 30px; height: 30px; border-radius: var(--radius-md); border: 1px solid var(--sand); background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); transition: all var(--transition-fast); }
        .att-btn:hover { border-color: var(--primary); }
        .att-btn.active-success { background: var(--success); color: white; border-color: var(--success); }
        .att-btn.active-error { background: var(--error); color: white; border-color: var(--error); }
        .att-btn.active-muted { background: var(--gray-400); color: white; border-color: var(--gray-400); }
        .att-label { font-size: 0.75rem; font-weight: 500; min-width: 60px; text-align: right; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-content { background: white; border-radius: var(--radius-xl); width: 100%; max-width: 480px; box-shadow: var(--shadow-lg); overflow: hidden; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--beige); }
        .modal-header h3 { margin: 0; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
        .modal-body { padding: 1.25rem; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.25rem; border-top: 1px solid var(--beige); background: var(--bg-secondary); }
        .form-label { display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.375rem; }

        .delete-options { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }
        .delete-option-btn { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.875rem 1rem; border: 2px solid var(--sand); border-radius: var(--radius-lg); background: white; cursor: pointer; text-align: left; transition: all var(--transition-fast); }
        .delete-option-btn:hover { border-color: var(--text-secondary); background: var(--bg-secondary); }
        .delete-option-btn strong { display: block; font-size: 0.875rem; }
        .delete-option-btn small { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.125rem; }
        .delete-option-btn.danger { border-color: rgba(239,68,68,0.3); }
        .delete-option-btn.danger:hover { border-color: var(--error); background: rgba(239,68,68,0.05); color: var(--error); }

        .cancel-action-btns { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
        .cancel-action-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.875rem 0.5rem; border: 2px solid var(--sand); border-radius: var(--radius-lg); background: white; cursor: pointer; transition: all var(--transition-fast); }
        .cancel-action-btn span { font-weight: 600; font-size: 0.875rem; }
        .cancel-action-btn small { font-size: 0.6875rem; color: var(--text-muted); }
        .cancel-action-btn:hover { border-color: var(--primary); }
        .cancel-action-btn.active { border-color: var(--primary); background: rgba(124,154,114,0.08); }
        .cancel-action-btn.active:first-child { border-color: var(--error); background: rgba(239,68,68,0.05); }

        .cancel-impact { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; background: #fef3c7; border-radius: var(--radius-md); font-size: 0.8125rem; color: #92400e; margin-top: 0.75rem; }

        .month-dot.replaced { background: #f59e0b; }
        .session-dot.replaced { background: #fef3c7; color: #92400e; }
        .session-detail-card.replaced { border-color: #f59e0b; }
        .badge-accent { background: rgba(193,127,89,0.15); color: #92400e; }

        .external-summary-bar { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .external-summary-item { display: flex; align-items: center; gap: 0.5rem; background: white; border-radius: var(--radius-lg); padding: 0.5rem 0.875rem; box-shadow: var(--shadow-sm); border-left: 3px solid var(--accent); font-size: 0.8125rem; }
        .ext-name { font-weight: 600; }
        .ext-stat { color: var(--text-muted); }
        .ext-earned { font-weight: 700; color: var(--success); }
        .ext-projected { color: var(--primary); font-size: 0.75rem; }
        .loc-legend { display: flex; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .loc-legend-item { display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--text-secondary); }
        .loc-legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

        .external-summary-item.active { box-shadow: var(--shadow-md); border-left-width: 4px; }
        .external-summary-total { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--text-secondary); padding: 0.5rem 0.875rem; background: white; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }

        .external-detail-panel { background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-md); padding: 1.25rem; margin-bottom: 1.5rem; border: 1px solid var(--accent); border-top: 3px solid var(--accent); }
        .ext-detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .ext-detail-header h4 { margin: 0; font-family: var(--font-body); font-size: 1rem; font-weight: 600; text-transform: capitalize; }
        .ext-detail-stats { display: flex; gap: 1.25rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .ext-detail-stat { text-align: center; }
        .ext-detail-stat-value { display: block; font-size: 1.25rem; font-weight: 700; font-family: var(--font-heading); }
        .ext-detail-stat-label { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }

        .ext-detail-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
        .ext-detail-table th { text-align: left; padding: 0.5rem 0.625rem; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 2px solid var(--beige); }
        .ext-detail-table td { padding: 0.5rem 0.625rem; border-bottom: 1px solid var(--beige); }
        .ext-detail-table .cancelled-row { opacity: 0.5; }
        .badge-sm { font-size: 0.625rem; padding: 0.125rem 0.375rem; }

        @media (max-width: 768px) {
          .week-grid { grid-template-columns: repeat(7, 1fr); gap: 0.25rem; }
          .day-col { padding: 0.5rem 0.25rem; min-height: 70px; }
          .day-name { font-size: 0.5rem; }
          .day-num { font-size: 1rem; }
          .session-dot { font-size: 0.5625rem; }
          .session-detail-header { flex-direction: column; }
          .cancel-action-btns { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
