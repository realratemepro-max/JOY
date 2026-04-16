import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Session } from '../../types';
import { Calendar, MapPin, Clock, Check, X as XIcon, Minus } from 'lucide-react';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function ClientSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (user) loadSessions();
  }, [user]);

  const loadSessions = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'sessions'), orderBy('date', 'desc')));
      const allSessions = snap.docs
        .map(d => {
          const data = d.data();
          return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate() } as Session;
        })
        .filter(s => s.enrolledStudents?.some(e => e.userId === user!.uid));
      setSessions(allSessions);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const now = new Date();
  const upcoming = sessions.filter(s => s.date >= now && s.status === 'scheduled');
  const past = sessions.filter(s => s.date < now || s.status === 'completed');
  const displayed = tab === 'upcoming' ? upcoming : past;

  const getMyAttendance = (session: Session) => {
    return session.enrolledStudents?.find(e => e.userId === user!.uid)?.status || 'enrolled';
  };

  const attendanceIcon = (status: string) => {
    if (status === 'attended') return <Check size={16} style={{ color: 'var(--success)' }} />;
    if (status === 'absent') return <XIcon size={16} style={{ color: 'var(--error)' }} />;
    if (status === 'cancelled') return <Minus size={16} style={{ color: 'var(--text-muted)' }} />;
    return <Clock size={16} style={{ color: 'var(--warning)' }} />;
  };

  const attendanceLabel = (status: string) => {
    if (status === 'attended') return 'Presente';
    if (status === 'absent') return 'Faltou';
    if (status === 'cancelled') return 'Cancelada';
    return 'Agendada';
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Tabs */}
      <div className="tabs-bar">
        <button className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Próximas ({upcoming.length})
        </button>
        <button className={`tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
          Histórico ({past.length})
        </button>
      </div>

      {displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-xl)', color: 'var(--text-secondary)' }}>
          {tab === 'upcoming' ? 'Sem sessões agendadas' : 'Sem sessões no histórico'}
        </div>
      ) : (
        <div className="sessions-list">
          {displayed.map(session => {
            const attendance = getMyAttendance(session);
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
                  </div>
                  <div className="session-location-row">
                    <MapPin size={14} /> {session.locationName}
                  </div>
                </div>
                <div className="session-status">
                  {attendanceIcon(attendance)}
                  <span>{attendanceLabel(attendance)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .tabs-bar { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); margin-bottom: 1.5rem; width: fit-content; }
        .tab { background: none; border: none; padding: 0.5rem 1.25rem; font-family: var(--font-body); font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .tab.active { background: var(--primary); color: white; }
        .sessions-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .session-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1.25rem; box-shadow: var(--shadow-sm); }
        .session-date-col { display: flex; flex-direction: column; align-items: center; min-width: 50px; }
        .session-day-name { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--primary); font-weight: 600; }
        .session-day-num { font-size: 1.5rem; font-weight: 700; font-family: var(--font-heading); line-height: 1; }
        .session-month { font-size: 0.6875rem; text-transform: uppercase; color: var(--text-muted); }
        .session-info { flex: 1; }
        .session-time-row, .session-location-row { display: flex; align-items: center; gap: 0.375rem; font-size: 0.9375rem; color: var(--text-secondary); }
        .session-time-row { margin-bottom: 0.25rem; }
        .session-status { display: flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; font-weight: 500; white-space: nowrap; }

        @media (max-width: 768px) { .session-row { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
}
