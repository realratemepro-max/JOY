import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { YogaEvent } from '../../types';
import { Calendar, MapPin, Clock, Users, Check, ChevronRight } from 'lucide-react';

export function ClientEvents() {
  const [events, setEvents] = useState<YogaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'events'), where('isActive', '==', true), orderBy('date', 'asc')));
      const now = new Date();
      setEvents(snap.docs
        .map(d => {
          const data = d.data();
          return { id: d.id, ...data, date: data.date?.toDate(), createdAt: data.createdAt?.toDate() } as YogaEvent;
        })
        .filter(e => e.date >= now)
      );
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-xl)', color: 'var(--text-secondary)' }}>
          <Calendar size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.125rem' }}>Sem eventos disponíveis</h3>
          <p>Fica atento - novos eventos serão anunciados em breve!</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(event => {
            const spotsLeft = event.capacity - event.enrolledCount;
            return (
              <div key={event.id} className="event-card">
                {event.photoUrl ? (
                  <img src={event.photoUrl} alt={event.name} className="event-photo" />
                ) : (
                  <div className="event-photo-placeholder"><Calendar size={32} /></div>
                )}
                <div className="event-body">
                  <h3>{event.name}</h3>
                  <p className="event-desc">{event.description}</p>
                  <div className="event-meta">
                    <span><Calendar size={14} /> {event.date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    <span><Clock size={14} /> {event.startTime} - {event.endTime}</span>
                    <span><MapPin size={14} /> {event.locationName}</span>
                    <span><Users size={14} /> {spotsLeft > 0 ? `${spotsLeft} vagas` : 'Esgotado'}</span>
                  </div>
                  {event.features.length > 0 && (
                    <div className="event-features">
                      {event.features.map((f, i) => (
                        <span key={i}><Check size={12} /> {f}</span>
                      ))}
                    </div>
                  )}
                  <div className="event-footer">
                    <div className="event-price">
                      <span className="price-val">{event.price.toFixed(0)}€</span>
                    </div>
                    {spotsLeft > 0 ? (
                      <Link to={`/checkout?event=${event.id}`} className="btn btn-primary btn-sm">
                        Inscrever <ChevronRight size={16} />
                      </Link>
                    ) : (
                      <span className="btn btn-secondary btn-sm" style={{ opacity: 0.5, cursor: 'not-allowed' }}>Esgotado</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
        .event-card { background: white; border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); transition: all var(--transition-normal); }
        .event-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .event-photo { width: 100%; height: 180px; object-fit: cover; }
        .event-photo-placeholder { width: 100%; height: 180px; background: var(--primary-gradient); display: flex; align-items: center; justify-content: center; color: white; }
        .event-body { padding: 1.5rem; }
        .event-body h3 { font-family: var(--font-heading); font-size: 1.25rem; margin-bottom: 0.5rem; }
        .event-desc { font-size: 0.9375rem; color: var(--text-secondary); margin-bottom: 1rem; }
        .event-meta { display: flex; flex-direction: column; gap: 0.375rem; margin-bottom: 1rem; }
        .event-meta span { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--text-secondary); }
        .event-features { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 1rem; }
        .event-features span { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; background: var(--beige); padding: 0.25rem 0.5rem; border-radius: var(--radius-full); color: var(--text-secondary); }
        .event-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid var(--beige); }
        .price-val { font-size: 1.5rem; font-weight: 700; font-family: var(--font-heading); color: var(--primary-dark); }
      `}</style>
    </div>
  );
}
