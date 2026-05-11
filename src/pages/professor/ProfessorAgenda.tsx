import React, { useEffect, useState, useMemo } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, setDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PersonalSession, PersonalLocation, PersonalPaymentType, PersonalSessionStatus, PersonalStudent } from '../../types';
import {
  CalendarDays, List, Plus, Edit2, Trash2, X, Save, Info,
  ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, MapPin,
  Users, Euro, FileText, UserPlus, Check, RefreshCw, Link, Copy,
} from 'lucide-react';

const DAYS_WEEK = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

type ExtraSlot = { days: number[]; startTime: string; endTime: string };

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

type View = 'agenda' | 'calendar';

const STATUS_COLORS: Record<PersonalSessionStatus, string> = {
  scheduled: '#6b7280',
  completed: '#059669',
  cancelled: '#dc2626',
  no_show: '#d97706',
};
const STATUS_LABELS: Record<PersonalSessionStatus, string> = {
  scheduled: 'Agendada',
  completed: 'Realizada',
  cancelled: 'Cancelada',
  no_show: 'Não realizada',
};

function computeAmount(s: PersonalSession): number {
  if (s.paymentType === 'fixed') return s.fixedAmount || 0;
  if (s.paymentType === 'per_student') return (s.ratePerStudent || 0) * (s.studentsPresent || 0);
  if (s.paymentType === 'per_occupancy' && s.occupancyTiers?.length && s.studentsExpected) {
    const pct = ((s.studentsPresent || 0) / s.studentsExpected) * 100;
    const tier = s.occupancyTiers.find(t => pct >= t.minPct && pct <= t.maxPct);
    return tier?.amount || 0;
  }
  return s.manualAmount || 0;
}

const EMPTY_FORM = {
  name: '', date: '', startTime: '', endTime: '',
  locationId: '', locationName: '',
  paymentType: 'fixed' as PersonalPaymentType,
  fixedAmount: '' as string | number,
  ratePerStudent: '' as string | number,
  manualAmount: '' as string | number,
  studentsExpected: '' as string | number,
  studentsPresent: '' as string | number,
  status: 'scheduled' as PersonalSessionStatus,
  isPaid: false, paidAmount: '' as string | number, receiptIssued: false, receiptNumber: '', notes: '',
  useNamedStudents: false,
};

const CAL_FUNCTION_URL = 'https://europe-west1-realrateme-731f1.cloudfunctions.net/userCalendar';

export function ProfessorAgenda() {
  const { professorData, user } = useAuth();
  const [view, setView] = useState<View>('agenda');
  const [sessions, setSessions] = useState<PersonalSession[]>([]);
  const [locations, setLocations] = useState<PersonalLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  // Modal state
  const [modal, setModal] = useState<{ open: boolean; editing: PersonalSession | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [namedStudents, setNamedStudents] = useState<PersonalStudent[]>([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Occupancy tiers (for per_occupancy payment type)
  const [sessionTiers, setSessionTiers] = useState<import('../../types').OccupancyTier[]>([]);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [extraSlots, setExtraSlots] = useState<ExtraSlot[]>([]);

  // Calendar sync
  const [calSyncModal, setCalSyncModal] = useState(false);
  const [calToken, setCalToken] = useState<string | null>(null);
  const [calCopied, setCalCopied] = useState(false);
  const [calGenerating, setCalGenerating] = useState(false);

  // Agenda filter: show upcoming by default, toggle to show past
  const [showPast, setShowPast] = useState(false);

  const sessRef = () => collection(db, 'professors', professorData!.id, 'personalSessions');
  const locRef = () => collection(db, 'professors', professorData!.id, 'personalLocations');

  const openCalSync = async () => {
    setCalSyncModal(true);
    if (!user) return;
    setCalGenerating(true);
    try {
      const userDoc = await import('firebase/firestore').then(m => m.getDoc(m.doc(db, 'users', user.uid)));
      const existing = userDoc.data()?.calendarToken;
      if (existing) { setCalToken(existing); return; }
      const token = crypto.randomUUID();
      await setDoc(doc(db, 'users', user.uid), { calendarToken: token }, { merge: true });
      setCalToken(token);
    } finally { setCalGenerating(false); }
  };

  const calUrl = user && calToken ? `${CAL_FUNCTION_URL}?uid=${user.uid}&token=${calToken}` : '';

  const copyCalUrl = () => {
    if (!calUrl) return;
    navigator.clipboard.writeText(calUrl);
    setCalCopied(true);
    setTimeout(() => setCalCopied(false), 2000);
  };

  useEffect(() => { if (!professorData) return; loadAll(); }, [professorData]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sessSnap, locSnap] = await Promise.all([
        getDocs(query(sessRef(), orderBy('date', 'asc'))),
        getDocs(query(locRef(), orderBy('createdAt', 'asc'))),
      ]);
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate(), paidAt: d.data().paidAt?.toDate(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as PersonalSession)));
      setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() } as PersonalLocation)));
    } finally { setLoading(false); }
  };

  const openCreate = () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    setForm({ ...EMPTY_FORM, date: dateStr });
    setNamedStudents([]);
    setIsRecurring(false);
    setRecurringDays([today.getDay()]);
    setRecurringEndDate('');
    setExtraSlots([]);
    setModal({ open: true, editing: null });
  };

  const openEdit = (s: PersonalSession) => {
    setForm({
      name: s.name, date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime, endTime: s.endTime,
      locationId: s.locationId || '', locationName: s.locationName || '',
      paymentType: s.paymentType,
      fixedAmount: s.fixedAmount ?? '',
      ratePerStudent: s.ratePerStudent ?? '',
      manualAmount: s.manualAmount ?? '',
      studentsExpected: s.studentsExpected ?? '',
      studentsPresent: s.studentsPresent ?? '',
      status: s.status,
      isPaid: s.isPaid, paidAmount: s.paidAmount ?? '',
      receiptIssued: s.receiptIssued, receiptNumber: s.receiptNumber || '',
      notes: s.notes || '',
      useNamedStudents: !!(s.students && s.students.length > 0),
    });
    setNamedStudents(s.students ? [...s.students] : []);
    setIsRecurring(false);
    setRecurringDays([]);
    setRecurringEndDate('');
    setExtraSlots([]);
    setModal({ open: true, editing: s });
  };

  const onLocationChange = (locId: string) => {
    const loc = locations.find(l => l.id === locId);
    setForm(f => ({
      ...f,
      locationId: locId,
      locationName: loc?.name || '',
      paymentType: loc?.defaultPaymentType || f.paymentType,
      fixedAmount: loc?.defaultFixedAmount ?? f.fixedAmount,
      ratePerStudent: loc?.defaultRatePerStudent ?? f.ratePerStudent,
    }));
    if (loc?.defaultOccupancyTiers?.length) setSessionTiers(loc.defaultOccupancyTiers.map(t => ({ ...t })));
  };

  const addNamedStudent = () => {
    if (!newStudentName.trim()) return;
    setNamedStudents(prev => [...prev, { name: newStudentName.trim(), present: true }]);
    setNewStudentName('');
  };

  const save = async () => {
    if (!form.name.trim() || !form.date) return;
    setSaving(true);
    try {
      const students = form.useNamedStudents ? namedStudents : undefined;
      const studentsPresent = form.useNamedStudents
        ? namedStudents.filter(s => s.present).length
        : (form.studentsPresent !== '' ? Number(form.studentsPresent) : undefined);

      const data: any = {
        name: form.name.trim(),
        date: new Date(form.date + 'T12:00:00'),
        startTime: form.startTime,
        endTime: form.endTime,
        locationId: form.locationId || null,
        locationName: form.locationName || '',
        paymentType: form.paymentType,
        fixedAmount: form.fixedAmount !== '' ? Number(form.fixedAmount) : null,
        ratePerStudent: form.ratePerStudent !== '' ? Number(form.ratePerStudent) : null,
        manualAmount: form.manualAmount !== '' ? Number(form.manualAmount) : null,
        occupancyTiers: form.paymentType === 'per_occupancy' ? sessionTiers : null,
        studentsExpected: form.studentsExpected !== '' ? Number(form.studentsExpected) : null,
        studentsPresent: studentsPresent ?? null,
        students: students || null,
        status: form.status,
        isPaid: form.isPaid,
        paidAmount: form.paidAmount !== '' ? Number(form.paidAmount) : null,
        paidAt: form.isPaid && !modal.editing?.isPaid ? new Date() : (modal.editing?.paidAt || null),
        receiptIssued: form.receiptIssued,
        receiptNumber: form.receiptNumber || null,
        notes: form.notes || null,
        updatedAt: serverTimestamp(),
      };
      if (modal.editing) {
        await updateDoc(doc(db, 'professors', professorData!.id, 'personalSessions', modal.editing.id), data);
      } else if (isRecurring && recurringEndDate) {
        const startDate = new Date(form.date + 'T12:00:00');
        const endDate = new Date(recurringEndDate + 'T12:00:00');
        const allSlots: ExtraSlot[] = [
          { days: recurringDays, startTime: form.startTime, endTime: form.endTime },
          ...extraSlots.filter(s => s.days.length > 0),
        ];
        const toCreate: any[] = [];
        for (const slot of allSlots) {
          const cur = new Date(startDate);
          while (cur <= endDate) {
            if (slot.days.includes(cur.getDay())) {
              toCreate.push({ ...data, date: new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 12, 0, 0), startTime: slot.startTime, endTime: slot.endTime });
            }
            cur.setDate(cur.getDate() + 1);
          }
        }
        await Promise.all(toCreate.map(s => addDoc(sessRef(), { ...s, createdAt: serverTimestamp() })));
      } else {
        await addDoc(sessRef(), { ...data, createdAt: serverTimestamp() });
      }
      setModal({ open: false, editing: null });
      loadAll();
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await deleteDoc(doc(db, 'professors', professorData!.id, 'personalSessions', deleteId));
    setDeleteId(null);
    loadAll();
  };

  // Quick status change without opening modal
  const quickStatus = async (s: PersonalSession, status: PersonalSessionStatus) => {
    await updateDoc(doc(db, 'professors', professorData!.id, 'personalSessions', s.id), { status, updatedAt: serverTimestamp() });
    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status } : x));
  };

  // ── Agenda view grouping ──
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const agendaSessions = useMemo(() => {
    const filtered = sessions.filter(s => showPast ? s.date < today : s.date >= today);
    const groups: { dateKey: string; date: Date; sessions: PersonalSession[] }[] = [];
    for (const s of filtered) {
      const key = s.date.toDateString();
      const g = groups.find(g => g.dateKey === key);
      if (g) g.sessions.push(s);
      else groups.push({ dateKey: key, date: s.date, sessions: [s] });
    }
    return groups;
  }, [sessions, showPast, today]);

  // ── Calendar view ──
  const calDays = useMemo(() => {
    const first = new Date(calMonth.y, calMonth.m, 1);
    const last = new Date(calMonth.y, calMonth.m + 1, 0);
    const days: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(calMonth.y, calMonth.m, d));
    return days;
  }, [calMonth]);

  const sessionsOnDay = (d: Date) => sessions.filter(s => s.date.toDateString() === d.toDateString());

  const formatDate = (d: Date) => d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  const isToday = (d: Date) => d.toDateString() === today.toDateString();

  if (!professorData) return null;

  return (
    <div>
      {/* Privacy banner */}
      <div className="ag-privacy">
        <Info size={15} />
        <span>Agenda <strong>pessoal e privada</strong> — os dados não são partilhados com o estúdio.</span>
      </div>

      {/* Top bar */}
      <div className="ag-topbar">
        <div>
          <h2 className="ag-title"><CalendarDays size={20} color="var(--accent)" /> Agenda Pessoal</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          <div className="ag-view-toggle">
            <button className={view === 'agenda' ? 'active' : ''} onClick={() => setView('agenda')}><List size={16} /> Lista</button>
            <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16} /> Calendário</button>
          </div>
          <button className="btn btn-outline" onClick={openCalSync}><Link size={16} /> Sincronizar Calendário</button>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Nova Aula</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : view === 'agenda' ? (
        // ── AGENDA VIEW ──
        <div>
          <div className="ag-filter-row">
            <button className={`ag-filter-btn${!showPast ? ' active' : ''}`} onClick={() => setShowPast(false)}>Próximas ({sessions.filter(s => s.date >= today).length})</button>
            <button className={`ag-filter-btn${showPast ? ' active' : ''}`} onClick={() => setShowPast(true)}>Passadas ({sessions.filter(s => s.date < today).length})</button>
          </div>

          {agendaSessions.length === 0 ? (
            <div className="ag-empty">
              <CalendarDays size={36} color="var(--text-muted)" />
              <p>{showPast ? 'Sem aulas passadas.' : 'Sem aulas agendadas.'}</p>
              <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Adicionar Aula</button>
            </div>
          ) : (
            agendaSessions.map(group => (
              <div key={group.dateKey} className="ag-group">
                <div className={`ag-day-header${isToday(group.date) ? ' ag-today' : ''}`}>
                  {isToday(group.date) ? `Hoje — ${formatDate(group.date)}` : formatDate(group.date).charAt(0).toUpperCase() + formatDate(group.date).slice(1)}
                </div>
                {group.sessions.map(s => {
                  const amount = computeAmount(s);
                  return (
                    <div key={s.id} className="ag-session-card">
                      <div className="ag-session-left">
                        <div className="ag-session-time"><Clock size={13} /> {s.startTime}{s.endTime ? ` – ${s.endTime}` : ''}</div>
                        <div className="ag-session-name">{s.name}</div>
                        <div className="ag-session-meta">
                          {s.locationName && <span><MapPin size={12} /> {s.locationName}</span>}
                          {(s.studentsPresent != null || (s.students && s.students.length > 0)) && (
                            <span><Users size={12} /> {s.students ? s.students.filter(st => st.present).length : s.studentsPresent} alunos</span>
                          )}
                          {amount > 0 && <span><Euro size={12} /> {amount.toFixed(2)}€{s.isPaid ? ' ✓' : ' pendente'}</span>}
                        </div>
                      </div>
                      <div className="ag-session-right">
                        <span className="ag-status-badge" style={{ background: STATUS_COLORS[s.status] + '20', color: STATUS_COLORS[s.status] }}>
                          {STATUS_LABELS[s.status]}
                        </span>
                        {s.status === 'scheduled' && (
                          <div className="ag-quick-actions">
                            <button className="ag-qa-btn ag-qa-done" onClick={() => quickStatus(s, 'completed')} title="Marcar realizada"><CheckCircle size={15} /></button>
                            <button className="ag-qa-btn ag-qa-cancel" onClick={() => quickStatus(s, 'cancelled')} title="Cancelar"><XCircle size={15} /></button>
                          </div>
                        )}
                        <div className="ag-card-actions">
                          <button className="pl-icon-btn" onClick={() => openEdit(s)}><Edit2 size={14} /></button>
                          <button className="pl-icon-btn pl-icon-btn-danger" onClick={() => setDeleteId(s.id)}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : (
        // ── CALENDAR VIEW ──
        <div className="ag-cal-wrap">
          <div className="ag-cal-nav">
            <button className="ag-cal-nav-btn" onClick={() => setCalMonth(m => { const d = new Date(m.y, m.m - 1); return { y: d.getFullYear(), m: d.getMonth() }; })}><ChevronLeft size={18} /></button>
            <span className="ag-cal-month">{MONTHS_PT[calMonth.m]} {calMonth.y}</span>
            <button className="ag-cal-nav-btn" onClick={() => setCalMonth(m => { const d = new Date(m.y, m.m + 1); return { y: d.getFullYear(), m: d.getMonth() }; })}><ChevronRight size={18} /></button>
          </div>
          <div className="ag-cal-grid">
            {DAYS_PT.map(d => <div key={d} className="ag-cal-weekday">{d}</div>)}
            {calDays.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} className="ag-cal-day ag-cal-empty" />;
              const daySess = sessionsOnDay(d);
              const isT = isToday(d);
              return (
                <div key={d.toISOString()} className={`ag-cal-day${isT ? ' ag-cal-today' : ''}`}>
                  <span className="ag-cal-num">{d.getDate()}</span>
                  {daySess.slice(0, 3).map(s => (
                    <div key={s.id} className="ag-cal-dot" style={{ background: STATUS_COLORS[s.status] }} title={`${s.startTime} ${s.name}${s.locationName ? ` · ${s.locationName}` : ''}`} onClick={() => openEdit(s)}>
                      <span>{s.startTime} {s.name}{s.locationName ? ` · ${s.locationName}` : ''}</span>
                    </div>
                  ))}
                  {daySess.length > 3 && <div className="ag-cal-more">+{daySess.length - 3}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Calendar Sync Modal ── */}
      {calSyncModal && (
        <div className="modal-overlay" onClick={() => setCalSyncModal(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Link size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Sincronizar Calendário</h3>
              <button className="modal-close" onClick={() => setCalSyncModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Subscreve o teu calendário de aulas em qualquer aplicação — <strong>Google Calendar, Apple Calendar, Outlook</strong> — e fica sempre atualizado automaticamente.
              </p>
              {calGenerating ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><div className="spinner" /></div>
              ) : calUrl ? (
                <>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1.5px solid var(--sand)' }}>
                    <span style={{ flex: 1, fontSize: '0.8125rem', wordBreak: 'break-all', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{calUrl}</span>
                    <button className="btn btn-sm btn-primary" onClick={copyCalUrl} style={{ flexShrink: 0 }}>
                      {calCopied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
                    </button>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#166534', marginBottom: '0.5rem' }}>Como adicionar:</p>
                    <ol style={{ paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#166534', lineHeight: 1.8 }}>
                      <li><strong>Google Calendar:</strong> Outras agendas → Adicionar por URL → colar o link acima</li>
                      <li><strong>Apple Calendar:</strong> Ficheiro → Nova subscrição de calendário → colar o link</li>
                      <li><strong>Outlook:</strong> Adicionar calendário → A partir da Internet → colar o link</li>
                    </ol>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    O link é privado — não partilhes. Inclui as tuas aulas do estúdio e da agenda pessoal.
                  </p>
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setCalSyncModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {modal.open && (
        <div className="modal-overlay" onClick={() => setModal({ open: false, editing: null })}>
          <div className="modal-box ag-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.editing ? 'Editar Aula' : 'Nova Aula'}</h3>
              <button className="modal-close" onClick={() => setModal({ open: false, editing: null })}><X size={20} /></button>
            </div>
            <div className="modal-body ag-form">
              {/* Basic info */}
              <div className="ag-form-row">
                <div className="ag-form-col ag-form-col-2">
                  <label className="form-label">Nome da aula *</label>
                  <input className="form-input" placeholder="Ex: Vinyasa Yoga, Pilates..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="ag-form-col">
                  <label className="form-label">Data *</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div className="ag-form-row">
                <div className="ag-form-col">
                  <label className="form-label">Início</label>
                  <input className="form-input" type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div className="ag-form-col">
                  <label className="form-label">Fim</label>
                  <input className="form-input" type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                </div>
                <div className="ag-form-col">
                  <label className="form-label">Estado</label>
                  <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as PersonalSessionStatus })}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Recurrence — only on create */}
              {!modal.editing && (
                <>
                  <div className="ag-section-title"><RefreshCw size={14} /> Recorrência</div>
                  <label className="ag-checkbox-label" style={{ marginBottom: '0.75rem' }}>
                    <input type="checkbox" checked={isRecurring} onChange={e => {
                      setIsRecurring(e.target.checked);
                      if (e.target.checked && form.date) setRecurringDays([new Date(form.date + 'T12:00:00').getDay()]);
                    }} />
                    <span>Aula recorrente (cria múltiplas sessões automaticamente)</span>
                  </label>
                  {isRecurring && (
                    <div className="ag-recur-box">
                      {/* Main slot days */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label className="form-label" style={{ marginBottom: '0.5rem' }}>Dias da semana — horário {form.startTime || '–'} {form.endTime ? `às ${form.endTime}` : ''}</label>
                        <div className="ag-days-row">
                          {DAYS_WEEK.map((d, i) => (
                            <button key={i} type="button" className={`ag-day-btn${recurringDays.includes(i) ? ' active' : ''}`}
                              onClick={() => setRecurringDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}>
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* End date */}
                      <div className="ag-form-row" style={{ marginBottom: '0.75rem' }}>
                        <div className="ag-form-col">
                          <label className="form-label">Data de término *</label>
                          <input className="form-input" type="date" value={recurringEndDate} min={form.date} onChange={e => setRecurringEndDate(e.target.value)} />
                        </div>
                        {recurringEndDate && form.date && (
                          <div className="ag-form-col" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                              ~{(() => {
                                const slots = [{ days: recurringDays }, ...extraSlots.filter(s => s.days.length > 0)];
                                let count = 0;
                                const start = new Date(form.date + 'T12:00:00');
                                const end = new Date(recurringEndDate + 'T12:00:00');
                                for (const slot of slots) {
                                  const cur = new Date(start);
                                  while (cur <= end) { if (slot.days.includes(cur.getDay())) count++; cur.setDate(cur.getDate() + 1); }
                                }
                                return count;
                              })()} aulas a criar
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Extra slots */}
                      {extraSlots.map((slot, idx) => (
                        <div key={idx} className="ag-extra-slot">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Horário adicional {idx + 1}</span>
                            <button type="button" className="pl-icon-btn pl-icon-btn-danger" style={{ padding: '0.2rem' }}
                              onClick={() => setExtraSlots(prev => prev.filter((_, i) => i !== idx))}><X size={13} /></button>
                          </div>
                          <div className="ag-days-row" style={{ marginBottom: '0.5rem' }}>
                            {DAYS_WEEK.map((d, i) => (
                              <button key={i} type="button" className={`ag-day-btn${slot.days.includes(i) ? ' active' : ''}`}
                                onClick={() => setExtraSlots(prev => prev.map((s, j) => j === idx ? { ...s, days: s.days.includes(i) ? s.days.filter(x => x !== i) : [...s.days, i] } : s))}>
                                {d}
                              </button>
                            ))}
                          </div>
                          <div className="ag-form-row" style={{ marginBottom: 0 }}>
                            <div className="ag-form-col">
                              <label className="form-label">Início</label>
                              <input className="form-input" type="time" value={slot.startTime} onChange={e => setExtraSlots(prev => prev.map((s, j) => j === idx ? { ...s, startTime: e.target.value } : s))} />
                            </div>
                            <div className="ag-form-col">
                              <label className="form-label">Fim</label>
                              <input className="form-input" type="time" value={slot.endTime} onChange={e => setExtraSlots(prev => prev.map((s, j) => j === idx ? { ...s, endTime: e.target.value } : s))} />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem', width: '100%' }}
                        onClick={() => setExtraSlots(prev => [...prev, { days: [], startTime: '', endTime: '' }])}>
                        <Plus size={14} /> Adicionar horário adicional
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Location */}
              <div className="ag-form-row">
                <div className="ag-form-col ag-form-col-2">
                  <label className="form-label">Espaço</label>
                  {locations.length > 0 ? (
                    <select className="form-input" value={form.locationId} onChange={e => onLocationChange(e.target.value)}>
                      <option value="">— Texto livre —</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  ) : (
                    <input className="form-input" placeholder="Nome do espaço..." value={form.locationName} onChange={e => setForm({ ...form, locationName: e.target.value })} />
                  )}
                </div>
                {locations.length > 0 && !form.locationId && (
                  <div className="ag-form-col ag-form-col-2">
                    <label className="form-label">Nome (livre)</label>
                    <input className="form-input" placeholder="Ou escreve o nome..." value={form.locationName} onChange={e => setForm({ ...form, locationName: e.target.value })} />
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className="ag-section-title"><Euro size={14} /> Pagamento</div>
              <div className="ag-form-row">
                <div className="ag-form-col">
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value as PersonalPaymentType })}>
                    <option value="fixed">Fixo por aula</option>
                    <option value="per_student">Por aluno</option>
                    <option value="per_occupancy">Por % ocupação</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                {form.paymentType === 'fixed' && (
                  <div className="ag-form-col">
                    <label className="form-label">Valor (€)</label>
                    <input className="form-input" type="number" min="0" step="0.5" value={form.fixedAmount} onChange={e => setForm({ ...form, fixedAmount: e.target.value })} />
                  </div>
                )}
                {form.paymentType === 'per_student' && (
                  <div className="ag-form-col">
                    <label className="form-label">€ por aluno</label>
                    <input className="form-input" type="number" min="0" step="0.5" value={form.ratePerStudent} onChange={e => setForm({ ...form, ratePerStudent: e.target.value })} />
                  </div>
                )}
                {form.paymentType === 'manual' && (
                  <div className="ag-form-col">
                    <label className="form-label">Valor manual (€)</label>
                    <input className="form-input" type="number" min="0" step="0.5" value={form.manualAmount} onChange={e => setForm({ ...form, manualAmount: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="ag-form-row ag-paid-row">
                <label className="ag-checkbox-label">
                  <input type="checkbox" checked={form.isPaid} onChange={e => setForm({ ...form, isPaid: e.target.checked })} />
                  <span>Pago</span>
                </label>
                {form.isPaid && (
                  <div className="ag-form-col">
                    <label className="form-label">Valor pago (€)</label>
                    <input className="form-input" type="number" min="0" step="0.5" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} />
                  </div>
                )}
                <label className="ag-checkbox-label">
                  <input type="checkbox" checked={form.receiptIssued} onChange={e => setForm({ ...form, receiptIssued: e.target.checked })} />
                  <span>Recibo emitido</span>
                </label>
                {form.receiptIssued && (
                  <div className="ag-form-col">
                    <label className="form-label">Nº Recibo</label>
                    <input className="form-input" placeholder="2024/001" value={form.receiptNumber} onChange={e => setForm({ ...form, receiptNumber: e.target.value })} />
                  </div>
                )}
              </div>

              {/* Students */}
              <div className="ag-section-title"><Users size={14} /> Alunos</div>
              <div className="ag-form-row">
                <div className="ag-form-col">
                  <label className="form-label">Previstos</label>
                  <input className="form-input" type="number" min="0" value={form.studentsExpected} onChange={e => setForm({ ...form, studentsExpected: e.target.value })} />
                </div>
                {!form.useNamedStudents && (
                  <div className="ag-form-col">
                    <label className="form-label">Presentes</label>
                    <input className="form-input" type="number" min="0" value={form.studentsPresent} onChange={e => setForm({ ...form, studentsPresent: e.target.value })} />
                  </div>
                )}
              </div>
              <label className="ag-checkbox-label" style={{ marginBottom: '0.75rem' }}>
                <input type="checkbox" checked={form.useNamedStudents} onChange={e => setForm({ ...form, useNamedStudents: e.target.checked })} />
                <span>Registar nomes de alunos (opcional — para controlo de assiduidade)</span>
              </label>
              {form.useNamedStudents && (
                <div className="ag-students-list">
                  {namedStudents.map((st, i) => (
                    <div key={i} className="ag-student-row">
                      <label className="ag-checkbox-label">
                        <input type="checkbox" checked={st.present} onChange={e => setNamedStudents(prev => prev.map((s, j) => j === i ? { ...s, present: e.target.checked } : s))} />
                        <span style={{ textDecoration: st.present ? 'none' : 'line-through', color: st.present ? 'inherit' : 'var(--text-muted)' }}>{st.name}</span>
                      </label>
                      <button className="pl-icon-btn pl-icon-btn-danger" style={{ padding: '0.2rem' }} onClick={() => setNamedStudents(prev => prev.filter((_, j) => j !== i))}><X size={13} /></button>
                    </div>
                  ))}
                  <div className="ag-add-student">
                    <input className="form-input" placeholder="Nome do aluno..." value={newStudentName} onChange={e => setNewStudentName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNamedStudent()} />
                    <button className="btn btn-outline" onClick={addNamedStudent}><UserPlus size={15} /></button>
                  </div>
                </div>
              )}

              {/* Notes */}
              <label className="form-label" style={{ marginTop: '0.75rem' }}>Notas</label>
              <textarea className="form-input" rows={2} placeholder="Observações..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal({ open: false, editing: null })}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim() || !form.date || (isRecurring && !recurringEndDate)}>
                <Save size={16} /> {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Eliminar Aula</h3><button className="modal-close" onClick={() => setDeleteId(null)}><X size={20} /></button></div>
            <div className="modal-body"><p>Tens a certeza que queres eliminar esta aula da tua agenda pessoal?</p></div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ag-privacy { display: flex; align-items: center; gap: 0.625rem; background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: var(--radius-lg); padding: 0.625rem 1rem; margin-bottom: 1.25rem; font-size: 0.8125rem; color: #1e40af; }
        .ag-topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .ag-title { font-family: var(--font-body); font-size: 1.25rem; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 0.5rem; }
        .ag-view-toggle { display: flex; border: 1.5px solid var(--sand); border-radius: var(--radius-md); overflow: hidden; }
        .ag-view-toggle button { display: flex; align-items: center; gap: 0.375rem; padding: 0.45rem 0.875rem; font-size: 0.875rem; font-family: var(--font-body); background: none; border: none; cursor: pointer; color: var(--text-secondary); transition: background 0.15s; }
        .ag-view-toggle button.active { background: var(--accent); color: white; }
        .ag-filter-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
        .ag-filter-btn { padding: 0.45rem 1rem; border-radius: var(--radius-md); border: 1.5px solid var(--sand); background: none; font-family: var(--font-body); font-size: 0.875rem; cursor: pointer; color: var(--text-secondary); transition: all 0.15s; }
        .ag-filter-btn.active { background: var(--accent); border-color: var(--accent); color: white; font-weight: 500; }
        .ag-empty { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 4rem 2rem; background: white; border-radius: var(--radius-xl); text-align: center; color: var(--text-muted); }
        .ag-group { margin-bottom: 1.25rem; }
        .ag-day-header { padding: 0.625rem 1rem; border-radius: var(--radius-lg); font-size: 0.9rem; font-weight: 600; background: var(--sand); color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: capitalize; }
        .ag-today { background: #1e293b; color: white; }
        .ag-session-card { background: white; border-radius: var(--radius-xl); padding: 1rem 1.25rem; box-shadow: var(--shadow-sm); margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1.5px solid var(--beige); }
        .ag-session-left { flex: 1; min-width: 0; }
        .ag-session-time { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.25rem; }
        .ag-session-name { font-weight: 600; font-size: 1rem; margin-bottom: 0.375rem; color: var(--accent-dark); }
        .ag-session-meta { display: flex; gap: 0.75rem; flex-wrap: wrap; font-size: 0.8125rem; color: var(--text-secondary); }
        .ag-session-meta span { display: flex; align-items: center; gap: 0.25rem; }
        .ag-session-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; flex-shrink: 0; }
        .ag-status-badge { padding: 0.2rem 0.625rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
        .ag-quick-actions { display: flex; gap: 0.375rem; }
        .ag-qa-btn { background: none; border: 1.5px solid; border-radius: var(--radius-md); padding: 0.35rem; cursor: pointer; display: flex; align-items: center; transition: background 0.15s; }
        .ag-qa-done { color: #059669; border-color: #059669; } .ag-qa-done:hover { background: #d1fae5; }
        .ag-qa-cancel { color: #dc2626; border-color: #dc2626; } .ag-qa-cancel:hover { background: #fee2e2; }
        .ag-card-actions { display: flex; gap: 0.375rem; }

        /* Calendar */
        .ag-cal-wrap { background: white; border-radius: var(--radius-xl); padding: 1.25rem; box-shadow: var(--shadow-sm); }
        .ag-cal-nav { display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-bottom: 1.25rem; }
        .ag-cal-nav-btn { background: none; border: 1.5px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; display: flex; align-items: center; }
        .ag-cal-month { font-size: 1.0625rem; font-weight: 600; min-width: 180px; text-align: center; }
        .ag-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .ag-cal-weekday { text-align: center; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); padding: 0.375rem 0; text-transform: uppercase; }
        .ag-cal-day { min-height: 80px; padding: 0.375rem; border-radius: var(--radius-md); background: var(--bg-secondary); position: relative; }
        .ag-cal-empty { background: transparent; }
        .ag-cal-today { background: #eff6ff; border: 1.5px solid #93c5fd; }
        .ag-cal-num { font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 0.25rem; }
        .ag-cal-today .ag-cal-num { color: #1d4ed8; }
        .ag-cal-dot { font-size: 0.65rem; padding: 0.125rem 0.375rem; border-radius: 4px; color: white; cursor: pointer; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ag-cal-more { font-size: 0.7rem; color: var(--text-muted); text-align: right; }

        /* Form modal */
        .ag-modal { max-width: 680px; max-height: 90vh; overflow-y: auto; }
        .ag-form { display: flex; flex-direction: column; gap: 0; }
        .ag-form-row { display: flex; gap: 0.75rem; margin-bottom: 0.875rem; flex-wrap: wrap; }
        .ag-form-col { flex: 1; min-width: 120px; }
        .ag-form-col-2 { flex: 2; }
        .ag-section-title { display: flex; align-items: center; gap: 0.375rem; font-weight: 600; font-size: 0.875rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin: 0.75rem 0 0.625rem; border-top: 1px solid var(--beige); padding-top: 0.75rem; }
        .ag-paid-row { flex-wrap: wrap; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
        .ag-checkbox-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; }
        .ag-checkbox-label input { width: 16px; height: 16px; cursor: pointer; }
        .ag-students-list { background: var(--bg-secondary); border-radius: var(--radius-lg); padding: 0.875rem; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }
        .ag-student-row { display: flex; align-items: center; justify-content: space-between; }
        .ag-add-student { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
        .ag-add-student .form-input { flex: 1; }
        .ag-recur-box { background: var(--bg-secondary); border-radius: var(--radius-lg); padding: 1rem; margin-bottom: 0.75rem; border: 1.5px solid var(--sand); }
        .ag-days-row { display: flex; gap: 0.375rem; flex-wrap: wrap; }
        .ag-day-btn { padding: 0.35rem 0.6rem; border-radius: var(--radius-md); border: 1.5px solid var(--sand); background: white; font-family: var(--font-body); font-size: 0.8125rem; cursor: pointer; color: var(--text-secondary); transition: all 0.15s; }
        .ag-day-btn.active { background: var(--primary); border-color: var(--primary); color: white; font-weight: 600; }
        .ag-extra-slot { background: white; border-radius: var(--radius-md); padding: 0.875rem; margin-bottom: 0.625rem; border: 1.5px solid var(--beige); }

        @media (max-width: 768px) {
          .ag-form-row { flex-direction: column; }
          .ag-cal-grid { font-size: 0.75rem; }
          .ag-cal-day { min-height: 60px; padding: 0.25rem; }
          .ag-cal-dot span { display: none; }
          .ag-cal-dot { width: 8px; height: 8px; border-radius: 50%; padding: 0; display: inline-block; }
        }
      `}</style>
    </div>
  );
}
