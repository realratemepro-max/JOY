import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Session } from '../../types';
import { Calendar, Clock, MapPin, Users, CheckCircle } from 'lucide-react';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function ProfessorDashboard() {
  const { professorData } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!professorData) return;
    loadSessions();
  }, [professorData]);

  const loadSessions = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'sessions'), orderBy('date', 'asc')));
      const all = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate() } as Session;
      });
      setSessions(all.filter(s => s.professorId === professorData!.id));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

  const todaySessions = sessions.filter(s => s.date >= today && s.date < new Date(today.getTime() + 86400000) && s.status === 'scheduled');
  const upcomingWeek = sessions.filter(s => s.date >= new Date(today.getTime() + 86400000) && s.date < weekEnd && s.status === 'scheduled');
  const completedThisMonth = sessions.filter(s => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return s.date >= start && s.date <= now && (s.status === 'completed' || s.status === 'scheduled');
  });

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Hoje', value: todaySessions.length, sub: 'aula' + (todaySessions.length !== 1 ? 's' : ''), color: 'var(--primary)' },
          { label: 'Esta semana', value: upcomingWeek.length, sub: 'próximas aulas', color: 'var(--accent)' },
          { label: 'Este mês', value: completedThisMonth.length, sub: 'aulas dadas', color: '#6b7280' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{stat.sub}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.125rem' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Today's sessions */}
      <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '1.0625rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} color="var(--primary)" /> Aulas de Hoje
        </h3>
        {todaySessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <CheckCircle size={28} color="var(--primary-light)" style={{ display: 'block', margin: '0 auto 0.5rem' }} />
            Sem aulas hoje. Descansa!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {todaySessions.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem', background: 'var(--beige)', borderRadius: 'var(--radius-lg)', border: '1.5px solid rgba(124,154,114,0.2)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                    <Clock size={14} color="var(--primary)" /> {s.startTime} – {s.endTime}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={12} /> {s.locationName}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Users size={12} /> {s.enrolledStudents?.length || 0}/{s.maxCapacity}</span>
                  </div>
                </div>
                <a href="/professor/sessions" style={{ fontSize: '0.8125rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>Marcar →</a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming week */}
      {upcomingWeek.length > 0 && (
        <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '1.0625rem', marginBottom: '1rem' }}>Próximos 7 dias</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {upcomingWeek.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--beige)' }}>
                <div style={{ minWidth: 44, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>{DAY_NAMES[s.dayOfWeek]}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'var(--font-heading)', lineHeight: 1 }}>{s.date.getDate()}</div>
                </div>
                <div style={{ flex: 1, fontSize: '0.875rem' }}>
                  <span style={{ fontWeight: 500 }}>{s.startTime}</span>
                  <span style={{ color: 'var(--text-muted)' }}> · {s.locationName} · {s.enrolledStudents?.length || 0} alunos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
