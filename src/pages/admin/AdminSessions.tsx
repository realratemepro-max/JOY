import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Session, SessionStudent, Plan, Location, Professor } from '../../types';
import {
  Plus, Save, X, Loader, Calendar, MapPin, Clock, Check,
  XCircle, Minus, ChevronLeft, ChevronRight, Users, Edit2, Trash2
} from 'lucide-react';

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
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // New session form
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSession, setNewSession] = useState({
    locationId: '', professorId: '', startTime: '09:00', endTime: '10:00',
    classType: 'group' as 'group' | 'private',
    recurrence: 'none' as 'none' | 'weekly' | 'monthly',
    name: '', notes: '',
  });

  useEffect(() => { loadData(); }, [weekBase]);

  const loadData = async () => {
    try {
      const weekDates = getWeekDates(weekBase);
      const weekStart = weekDates[0];
      const weekEnd = new Date(weekDates[6]);
      weekEnd.setHours(23, 59, 59);

      const [sessionsSnap, plansSnap, locsSnap, profsSnap] = await Promise.all([
        getDocs(query(collection(db, 'sessions'), orderBy('date', 'asc'))),
        getDocs(query(collection(db, 'plans'), orderBy('order'))),
        getDocs(query(collection(db, 'locations'), orderBy('order'))),
        getDocs(query(collection(db, 'professors'), orderBy('name'))),
      ]);

      // For month view, load the whole month; for week view, just the week
      const monthStart = new Date(weekBase.getFullYear(), weekBase.getMonth(), 1);
      const monthEnd = new Date(weekBase.getFullYear(), weekBase.getMonth() + 1, 0, 23, 59, 59);

      const allSessions = sessionsSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Session;
      }).filter(s => s.date >= monthStart && s.date <= monthEnd);

      setSessions(allSessions);
      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan)));
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
      setProfessors(profsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Professor)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

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
    const students = [...session.enrolledStudents];
    students[studentIndex] = { ...students[studentIndex], status };
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { enrolledStudents: students, updatedAt: new Date() });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, enrolledStudents: students } : s));
    } catch (err) { console.error(err); }
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { status: 'completed', updatedAt: new Date() });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'completed' as const } : s));
    } catch (err) { console.error(err); }
  };

  const handleCancelSession = async (sessionId: string) => {
    if (!confirm('Cancelar esta sessão?')) return;
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { status: 'cancelled', updatedAt: new Date() });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'cancelled' as const } : s));
    } catch (err) { console.error(err); }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Apagar esta sessão permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) { console.error(err); }
  };

  const handleCreateSession = async () => {
    if (!selectedDate || !newSession.locationId) return;
    try {
      setSaving(true);
      const loc = locations.find(l => l.id === newSession.locationId);
      const sessionDate = new Date(selectedDate);
      sessionDate.setHours(parseInt(newSession.startTime.split(':')[0]), parseInt(newSession.startTime.split(':')[1]));

      const prof = professors.find(p => p.id === newSession.professorId);
      const data = {
        name: newSession.name || '',
        locationId: newSession.locationId,
        locationName: loc?.name || '',
        professorId: newSession.professorId || null,
        professorName: prof?.name || null,
        date: Timestamp.fromDate(sessionDate),
        startTime: newSession.startTime,
        endTime: newSession.endTime,
        dayOfWeek: sessionDate.getDay(),
        enrolledStudents: [],
        maxCapacity: loc?.capacity || 10,
        classType: newSession.classType,
        recurrence: newSession.recurrence,
        status: 'scheduled',
        notes: newSession.notes || '',
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // If weekly recurrence, create sessions for 4 weeks
      if (newSession.recurrence === 'weekly') {
        for (let w = 0; w < 4; w++) {
          const weekDate = new Date(sessionDate);
          weekDate.setDate(weekDate.getDate() + (w * 7));
          const ref = doc(collection(db, 'sessions'));
          await setDoc(ref, { ...data, date: Timestamp.fromDate(weekDate), dayOfWeek: weekDate.getDay() });
        }
      } else if (newSession.recurrence === 'monthly') {
        for (let m = 0; m < 3; m++) {
          const monthDate = new Date(sessionDate);
          monthDate.setMonth(monthDate.getMonth() + m);
          const ref = doc(collection(db, 'sessions'));
          await setDoc(ref, { ...data, date: Timestamp.fromDate(monthDate), dayOfWeek: monthDate.getDay() });
        }
      } else {
        const ref = doc(collection(db, 'sessions'));
        await setDoc(ref, data);
      }
      setShowNewForm(false);
      setNewSession({ locationId: '', professorId: '', startTime: '09:00', endTime: '10:00', classType: 'group', recurrence: 'none', name: '', notes: '' });
      await loadData();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
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
                      <div className="month-dots">
                        {daySessions.slice(0, 3).map((s, si) => (
                          <span key={si} className={`month-dot ${s.status}`} title={`${s.startTime} ${s.locationName}`} />
                        ))}
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
              <div className="form-row">
                <input className="input" value={newSession.name} onChange={e => setNewSession({ ...newSession, name: e.target.value })} placeholder="Nome da aula (opcional)" style={{ flex: 1 }} />
                <select className="input" value={newSession.classType} onChange={e => setNewSession({ ...newSession, classType: e.target.value as any })} style={{ width: 120 }}>
                  <option value="group">Grupo</option>
                  <option value="private">Privada</option>
                </select>
                <select className="input" value={newSession.recurrence} onChange={e => setNewSession({ ...newSession, recurrence: e.target.value as any })} style={{ width: 150 }}>
                  <option value="none">Única</option>
                  <option value="weekly">Semanal (4 sem)</option>
                  <option value="monthly">Mensal (3 meses)</option>
                </select>
              </div>
              <div className="form-row">
                <select className="input" value={newSession.locationId} onChange={e => setNewSession({ ...newSession, locationId: e.target.value })}>
                  <option value="">Espaço...</option>
                  {locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <select className="input" value={newSession.professorId} onChange={e => setNewSession({ ...newSession, professorId: e.target.value })}>
                  <option value="">Professor...</option>
                  {professors.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="time" className="input" value={newSession.startTime} onChange={e => setNewSession({ ...newSession, startTime: e.target.value })} style={{ width: 110 }} />
                <span style={{ color: 'var(--text-muted)' }}>-</span>
                <input type="time" className="input" value={newSession.endTime} onChange={e => setNewSession({ ...newSession, endTime: e.target.value })} style={{ width: 110 }} />
              </div>
              <div className="form-row">
                <input className="input" value={newSession.notes} onChange={e => setNewSession({ ...newSession, notes: e.target.value })} placeholder="Notas (opcional)" style={{ flex: 1 }} />
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
              {getSessionsForDay(selectedDate).map(session => (
                <div key={session.id} className={`session-detail-card ${session.status}`}>
                  <div className="session-detail-header">
                    <div className="session-detail-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={16} /> <strong>{session.startTime} - {session.endTime}</strong>
                        <span className={`badge badge-${session.status === 'scheduled' ? 'primary' : session.status === 'completed' ? 'success' : 'error'}`}>
                          {session.status === 'scheduled' ? 'Agendada' : session.status === 'completed' ? 'Concluída' : 'Cancelada'}
                        </span>
                        <span className={`badge ${session.classType === 'private' ? 'badge-primary' : 'badge-success'}`}>{session.classType === 'private' ? 'Privada' : 'Grupo'}</span>
                        {session.professorName && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{session.professorName}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                        <MapPin size={14} /> {session.locationName}
                      </div>
                    </div>
                    <div className="session-detail-actions">
                      {session.status === 'scheduled' && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => handleCompleteSession(session.id)} title="Marcar como concluída"><Check size={14} /> Concluir</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleCancelSession(session.id)} title="Cancelar"><XCircle size={14} /></button>
                        </>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSession(session.id)} title="Apagar"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {/* Enrolled Students + Attendance */}
                  {session.enrolledStudents.length > 0 ? (
                    <div className="students-list">
                      <div className="students-header">
                        <span>Alunos ({session.enrolledStudents.length}/{session.maxCapacity})</span>
                      </div>
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
                          </div>
                          <span className="att-label" style={{ color: statusColor(student.status) }}>
                            {student.status === 'attended' ? 'Presente' : student.status === 'absent' ? 'Faltou' : student.status === 'cancelled' ? 'Cancelou' : 'Inscrito'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sem alunos inscritos</div>
                  )}

                  {session.notes && <div style={{ padding: '0.75rem 1rem', background: 'var(--beige)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{session.notes}</div>}
                </div>
              ))}
            </div>
          )}
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
        .month-cell { min-height: 70px; padding: 0.375rem; border-right: 1px solid var(--beige); border-bottom: 1px solid var(--beige); cursor: pointer; transition: background var(--transition-fast); }
        .month-cell:nth-child(7n) { border-right: none; }
        .month-cell:hover { background: rgba(124,154,114,0.05); }
        .month-cell.empty { background: var(--bg-secondary); cursor: default; }
        .month-cell.today { background: rgba(124,154,114,0.08); }
        .month-cell.selected { background: rgba(124,154,114,0.15); box-shadow: inset 0 0 0 2px var(--primary); }
        .month-cell.has-sessions .month-day-num { font-weight: 700; color: var(--primary-dark); }
        .month-day-num { font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); display: block; margin-bottom: 0.25rem; }
        .month-dots { display: flex; gap: 0.2rem; flex-wrap: wrap; }
        .month-dot { width: 7px; height: 7px; border-radius: 50%; }
        .month-dot.scheduled { background: #3b82f6; }
        .month-dot.completed { background: #22c55e; }
        .month-dot.cancelled { background: #d1d5db; }
        .month-more { font-size: 0.5625rem; color: var(--text-muted); }
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

        .new-session-form { background: var(--bg-secondary); border-radius: var(--radius-lg); padding: 1rem; margin-bottom: 1.25rem; border: 2px dashed var(--primary-light); }
        .form-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
        .form-row:last-child { margin-bottom: 0; }

        .sessions-detail-list { display: flex; flex-direction: column; gap: 1rem; }
        .session-detail-card { border: 1px solid var(--sand); border-radius: var(--radius-lg); overflow: hidden; }
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

        @media (max-width: 768px) {
          .week-grid { grid-template-columns: repeat(7, 1fr); gap: 0.25rem; }
          .day-col { padding: 0.5rem 0.25rem; min-height: 70px; }
          .day-name { font-size: 0.5rem; }
          .day-num { font-size: 1rem; }
          .session-dot { font-size: 0.5625rem; }
          .session-detail-header { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
