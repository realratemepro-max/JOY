import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getSiteConfig, defaultSiteConfig } from '../services/siteConfig';
import { SiteConfig, Plan, Testimonial, Location, Professor, PracticeSection, Session } from '../types';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import {
  Heart, Wind, Brain, Moon, Shield, Eye, Sparkles, Activity,
  Star, ChevronLeft, ChevronRight, Phone, Mail, MapPin, Instagram, ArrowDown,
  Check, Calendar, Clock, Users
} from 'lucide-react';

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function getOccurrencesInPeriod(
  dayOfWeek: number,
  slotStart: Date | undefined,
  slotEnd: Date | undefined,
  periodStart: Date,
  periodEnd: Date
): Date[] {
  // Earliest valid date for this slot's occurrences
  const earliestStart = slotStart && slotStart > periodStart ? new Date(slotStart) : new Date(periodStart);
  earliestStart.setHours(0, 0, 0, 0);
  // First occurrence = first matching dayOfWeek >= earliestStart
  const baselineDay = earliestStart.getDay();
  const daysAhead = (dayOfWeek - baselineDay + 7) % 7;
  const first = new Date(earliestStart);
  first.setDate(earliestStart.getDate() + daysAhead);

  const occurrences: Date[] = [];
  let cur = first;
  while (cur <= periodEnd) {
    if (slotEnd && cur > slotEnd) break;
    occurrences.push(new Date(cur));
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 7);
  }
  return occurrences;
}

function nextOccurrence(dayOfWeek: number, startTime: string, startDate?: Date, endDate?: Date, today: Date = new Date()): Date | null {
  // Compute the earliest valid candidate (today or recurrence start, whichever is later)
  const baseline = startDate && startDate > today ? new Date(startDate) : new Date(today);
  baseline.setHours(0, 0, 0, 0);

  const baselineDay = baseline.getDay();
  let daysAhead = (dayOfWeek - baselineDay + 7) % 7;

  // If the baseline IS the same weekday, check whether the class time has already passed (only when baseline is today)
  const isToday = baseline.toDateString() === new Date(today.toDateString()).toDateString();
  if (daysAhead === 0 && isToday) {
    const [hh, mm] = startTime.split(':').map(Number);
    if (today.getHours() > hh || (today.getHours() === hh && today.getMinutes() >= mm)) {
      daysAhead = 7;
    }
  }
  const next = new Date(baseline);
  next.setDate(baseline.getDate() + daysAhead);

  // Respect recurrence end date
  if (endDate && next > endDate) return null;
  return next;
}

export function LandingPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expandedProf, setExpandedProf] = useState<string | null>(null);
  const [activePractice, setActivePractice] = useState(0);
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [scheduleViewMode, setScheduleViewMode] = useState<'professor' | 'style'>('professor');
  const [periodOffset, setPeriodOffset] = useState(0);
  const PERIOD_DAYS = 7;
  const [loading, setLoading] = useState(true);
  const [heroOffset, setHeroOffset] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const onScroll = () => setHeroOffset(window.scrollY * 0.35);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-advance schedule period to the first non-empty week, up to ~12 weeks ahead
  useEffect(() => {
    if (sessions.length === 0) return;
    if (periodOffset !== 0) return; // user already navigated, don't override
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let off = 0; off < 12; off++) {
      const start = new Date(today);
      start.setDate(today.getDate() + off * PERIOD_DAYS);
      const end = new Date(start);
      end.setDate(start.getDate() + PERIOD_DAYS - 1);
      end.setHours(23, 59, 59, 999);
      const hasAny = sessions.some(s => s.date >= start && s.date <= end);
      if (hasAny) {
        if (off !== 0) setPeriodOffset(off);
        return;
      }
    }
  }, [sessions]);

  // After loading completes, if URL has a hash, scroll to it (sections may not exist before data is loaded)
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    // Retry until the section appears in the DOM (sections render after their data arrives)
    let tries = 0;
    const tryScroll = () => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (tries++ < 20) setTimeout(tryScroll, 150);
    };
    tryScroll();
  }, [loading, plans.length, professors.length, sessions.length]);

  const loadData = async () => {
    try {
      const [siteConfig, plansSnap, locsSnap, testimonialsSnap, profsSnap] = await Promise.all([
        getSiteConfig(),
        getDocs(query(collection(db, 'plans'), where('isActive', '==', true))),
        getDocs(query(collection(db, 'locations'), where('isActive', '==', true))),
        getDocs(query(collection(db, 'testimonials'), where('isActive', '==', true))),
        getDocs(query(collection(db, 'professors'), where('showOnLanding', '==', true), where('isActive', '==', true))),
      ]);

      setConfig(siteConfig);

      setLocations(locsSnap.docs.map(d => ({
        id: d.id, ...d.data(),
      } as Location)));

      setPlans(plansSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      } as Plan)));

      setTestimonials(testimonialsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
      } as Testimonial)));

      setProfessors(profsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      } as Professor)));

    } catch (err) {
      console.error('Error loading landing data:', err);
    } finally {
      setLoading(false);
    }

    // Load sessions separately so a failure doesn't break the rest of the page
    try {
      const sessionsSnap = await getDocs(
        query(collection(db, 'sessions'), where('status', '==', 'scheduled'))
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rawSessions = sessionsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      } as Session));
      // Keep only future sessions (one document = one occurrence)
      const future = rawSessions.filter(s => s.date && s.date >= today);
      future.sort((a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime));
      setSessions(future);
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  };

  // Group plans by location
  const plansByLocation = plans.reduce((acc, plan) => {
    const key = plan.locationName || 'Sem espaço';
    if (!acc[key]) acc[key] = [];
    acc[key].push(plan);
    return acc;
  }, {} as Record<string, Plan[]>);

  const benefitIcons = [Heart, Wind, Brain, Moon, Shield, Eye, Sparkles, Activity];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="landing-page">
      <Navbar logoUrl={config.logo} siteName={config.siteName} tagline={config.tagline} />

      {/* HERO SECTION */}
      <section className="hero" style={{ backgroundImage: `url('${config.heroImage || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1920&q=80'}')`, backgroundPosition: `center ${heroOffset}px` }}>
        <div className="hero-overlay" />
        <div className="hero-content animate-slideUp">
          <span className="hero-badge">{config.heroBadge}</span>
          <h1>{config.heroTitle}</h1>
          <p className="hero-subtitle">{config.heroSubtitle}</p>
          <div className="hero-buttons">
            <a href={config.heroCtaLink} className="btn btn-primary btn-lg">
              {config.heroCtaText}
              <ChevronRight size={20} />
            </a>
            <a href="#sobre" className="btn btn-hero-secondary btn-lg">
              {config.heroSecondaryText}
            </a>
          </div>
          <a href="#sobre" className="scroll-indicator">
            <ArrowDown size={20} />
          </a>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="sobre" className="section about-section">
        <div className="container">
          <div className="about-grid">
            <div className="about-image-col">
              <div className="about-image-wrapper">
                {config.aboutImage ? (
                  <img src={config.aboutImage} alt={config.aboutTitle || config.siteName} />
                ) : (
                  <div className="about-image-placeholder">
                    <span>JO</span>
                  </div>
                )}
              </div>
              <div className="about-highlights">
                {config.aboutHighlights.map((h, i) => (
                  <div key={i} className="highlight-item">
                    <Check size={16} />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="about-text-col">
              <span className="section-label">{config.aboutLabel}</span>
              <h2>{config.aboutTitle}</h2>
              <div className="divider divider-left" />
              {config.aboutText.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TEAM SECTION */}
      {professors.length > 0 && (
        <section id="equipa" className="section team-section">
          <div className="container">
            <span className="section-label text-center">A Nossa Equipa</span>
            <h2 className="section-title">Uma prática. Vários caminhos. Um propósito.</h2>
            <div className="divider" />
            <p className="section-subtitle">Conhece os professores que te guiam nesta jornada. Cada um com a sua história, todos unidos pela paixão pelo yoga.</p>

            {/* Compact card row */}
            <div className="team-grid">
              {professors.map(prof => {
                const isOpen = expandedProf === prof.id;
                return (
                  <button
                    key={prof.id}
                    className={`team-card ${isOpen ? 'team-card-open' : ''}`}
                    onClick={() => setExpandedProf(isOpen ? null : prof.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="team-photo-wrapper">
                      {prof.photoUrl ? (
                        <img src={prof.photoUrl} alt={prof.name} className="team-photo" />
                      ) : (
                        <div className="team-photo-placeholder"><Users size={36} /></div>
                      )}
                      <div className="team-photo-overlay">
                        <span>{isOpen ? 'Fechar ×' : 'Saber mais'}</span>
                      </div>
                    </div>
                    <div className="team-card-footer">
                      {(prof.landingSpecialty || prof.style) && (
                        <span className="team-specialty">{prof.landingSpecialty || prof.style}</span>
                      )}
                      <p className="team-card-name">{prof.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Expanded detail panel */}
            {expandedProf && (() => {
              const prof = professors.find(p => p.id === expandedProf);
              if (!prof) return null;
              return (
                <div className="team-detail-panel animate-slideUp">
                  {/* Photo + bio row */}
                  <div className="team-detail-grid">
                    <div className="team-detail-photo-col">
                      <div className="team-detail-photo-wrapper">
                        {prof.photoUrl ? (
                          <img src={prof.photoUrl} alt={prof.name} />
                        ) : (
                          <div className="team-detail-photo-placeholder"><Users size={60} /></div>
                        )}
                      </div>
                    </div>
                    <div className="team-detail-info-col">
                      {(prof.landingSpecialty || prof.style) && (
                        <span className="team-specialty">{prof.landingSpecialty || prof.style}</span>
                      )}
                      <h3 className="team-detail-name">{prof.name}</h3>
                      <div className="divider divider-left" />
                      {(prof.landingBio || prof.bio).split('\n\n').map((para, i) => (
                        <p key={i} className="team-detail-bio">{para}</p>
                      ))}
                    </div>
                  </div>
                  {/* Highlights — full width below both columns */}
                  {(prof.landingHighlights || []).length > 0 && (
                    <div className="team-detail-highlights">
                      {(prof.landingHighlights || []).map((h, i) => (
                        <div key={i} className="highlight-item">
                          <Check size={14} />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* PRÁTICAS SECTION — tabbed, single section */}
      {(() => {
        const sections: PracticeSection[] = (config.practices && config.practices.length > 0)
          ? config.practices
          : [{ label: config.vinyasaLabel, title: config.vinyasaTitle, text: config.vinyasaText, benefits: config.vinyasaBenefits }];

        const current = sections[Math.min(activePractice, sections.length - 1)];

        return (
          <section id="vinyasa" className="section vinyasa-section">
            <div className="container">
              {/* Tab buttons */}
              {sections.length > 1 && (
                <div className="practice-tabs">
                  {sections.map((s, i) => (
                    <button
                      key={i}
                      className={`practice-tab ${activePractice === i ? 'practice-tab-active' : ''}`}
                      onClick={() => setActivePractice(i)}
                    >
                      {s.title.replace(/^Porquê\s+/i, '').replace(/\?$/, '')}
                    </button>
                  ))}
                </div>
              )}

              {/* Active practice content */}
              <span className="section-label text-center">{current.label}</span>
              <h2 className="section-title">{current.title}</h2>
              <div className="divider" />
              <p className="section-subtitle">{current.text}</p>

              <div className="benefits-grid">
                {current.benefits.map((benefit, i) => {
                  const Icon = benefitIcons[i % benefitIcons.length];
                  return (
                    <div key={i} className="benefit-card">
                      <div className="benefit-icon"><Icon size={24} /></div>
                      <p>{benefit}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}

      {/* HORÁRIOS SECTION */}
      {sessions.length > 0 && (() => {
        // Build filter options
        const profMap = professors.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, Professor>);

        const filteredSessions = scheduleFilter === 'all'
          ? sessions
          : scheduleViewMode === 'professor'
            ? sessions.filter(s => s.professorId === scheduleFilter)
            : sessions.filter(s => profMap[s.professorId || '']?.style === scheduleFilter);

        const professorFilters = Array.from(new Map(
          sessions.filter(s => s.professorId && s.professorName)
            .map(s => [s.professorId, { id: s.professorId!, name: s.professorName! }])
        ).values());

        const styleFilters = Array.from(new Set(
          sessions.map(s => profMap[s.professorId || '']?.style).filter(Boolean)
        )) as string[];

        const filterOptions = scheduleViewMode === 'professor' ? professorFilters : styleFilters.map(s => ({ id: s, name: s }));

        // Compute period bounds (default: next 7 days starting today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const periodStart = new Date(today);
        periodStart.setDate(today.getDate() + periodOffset * PERIOD_DAYS);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + PERIOD_DAYS - 1);
        periodEnd.setHours(23, 59, 59, 999);

        // Each session document IS one occurrence — just filter by period bounds
        const inPeriod = filteredSessions.filter(s => s.date >= periodStart && s.date <= periodEnd);

        // Group by date string
        const byDate: { dateKey: string; date: Date; items: typeof inPeriod }[] = [];
        for (const s of inPeriod) {
          const key = s.date.toDateString();
          let group = byDate.find(g => g.dateKey === key);
          if (!group) { group = { dateKey: key, date: s.date, items: [] }; byDate.push(group); }
          group.items.push(s);
        }

        // Period label
        const periodLabel = `${periodStart.getDate()} ${MONTH_NAMES_SHORT[periodStart.getMonth()]} – ${periodEnd.getDate()} ${MONTH_NAMES_SHORT[periodEnd.getMonth()]}`;

        return (
          <section id="horarios" className="section schedule-section">
            <div className="container">
              <span className="section-label text-center">Horários</span>
              <h2 className="section-title">Próximas aulas disponíveis</h2>
              <div className="divider" />

              {/* View mode toggle + filters */}
              <div className="schedule-controls">
                <div className="schedule-view-toggle">
                  <button
                    className={scheduleViewMode === 'professor' ? 'active' : ''}
                    onClick={() => { setScheduleViewMode('professor'); setScheduleFilter('all'); }}
                  >Por Professor</button>
                  <button
                    className={scheduleViewMode === 'style' ? 'active' : ''}
                    onClick={() => { setScheduleViewMode('style'); setScheduleFilter('all'); }}
                  >Por Estilo</button>
                </div>
                {filterOptions.length > 0 && (
                  <div className="schedule-filter-tabs">
                    <button className={scheduleFilter === 'all' ? 'filter-active' : ''} onClick={() => setScheduleFilter('all')}>Todos</button>
                    {filterOptions.map(opt => (
                      <button key={opt.id} className={scheduleFilter === opt.id ? 'filter-active' : ''} onClick={() => setScheduleFilter(opt.id)}>
                        {opt.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Period navigator */}
              <div className="schedule-period-bar">
                <button className="schedule-period-btn" onClick={() => setPeriodOffset(o => o - 1)} aria-label="Período anterior"><ChevronLeft size={16} /></button>
                <span className="schedule-period-label">{periodLabel}</span>
                <button className="schedule-period-btn" onClick={() => setPeriodOffset(o => o + 1)} aria-label="Próximo período"><ChevronRight size={16} /></button>
                {periodOffset !== 0 && (
                  <button className="schedule-period-today" onClick={() => setPeriodOffset(0)}>Hoje</button>
                )}
              </div>

              {/* Schedule rows grouped by actual date */}
              <div className="schedule-table">
                {byDate.length === 0 && (
                  <div className="schedule-empty-card">
                    <p><strong>Sem aulas neste período.</strong></p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Tenta avançar para o próximo período.</p>
                  </div>
                )}
                {byDate.map(group => (
                  <div key={group.dateKey} className="schedule-day-group">
                    <div className="schedule-day-header">
                      {DAY_NAMES_FULL[group.date.getDay()]}, {group.date.getDate()} {MONTH_NAMES_SHORT[group.date.getMonth()]}
                    </div>
                    {group.items.map(session => {
                      const spotsLeft = session.maxCapacity - (session.enrolledStudents?.length || 0);
                      return (
                        <div key={session.id} className="schedule-row">
                          <div className="schedule-time">
                            <span className="schedule-hour">
                              <Clock size={12} />
                              {session.startTime}
                            </span>
                          </div>
                          <div className="schedule-info">
                            <span className="schedule-name">{session.name || (profMap[session.professorId || '']?.style) || 'Yoga'}</span>
                            {session.professorName && <span className="schedule-prof">{session.professorName}</span>}
                          </div>
                          <div className="schedule-meta">
                            <span className="schedule-duration">{session.duration}min</span>
                            <span className="schedule-location">{session.locationName}</span>
                          </div>
                          <div className="schedule-spots">
                            <span className={spotsLeft <= 2 ? 'spots-low' : 'spots-ok'}>
                              {spotsLeft <= 0 ? 'Esgotado' : `${spotsLeft} lugar${spotsLeft !== 1 ? 'es' : ''}`}
                            </span>
                          </div>
                          <div className="schedule-cta">
                            <Link
                              to={user ? '/app/sessions' : `/login?next=${encodeURIComponent('/app/sessions')}`}
                              className="btn btn-primary btn-sm"
                            >
                              Reservar
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* CTA for non-registered */}
              {!user && (
                <div className="schedule-footer-cta">
                  <p>Cria a tua conta gratuita e reserva a tua primeira aula em segundos.</p>
                  <Link to="/register" className="btn btn-primary">Criar Conta</Link>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* SERVICES SECTION */}
      <section id="servicos" className="section services-section">
        <div className="container">
          <span className="section-label text-center">{config.servicesLabel}</span>
          <h2 className="section-title">{config.servicesTitle}</h2>
          <div className="divider" />
          <p className="section-subtitle">{config.servicesSubtitle}</p>

          {/* Drop-in plans */}
          {plans.filter(p => p.billingType === 'dropin').length > 0 && (
            <div className="dropin-section">
              <h3 className="subsection-title">{config.servicesDropinTitle || 'Aulas Avulsas'}</h3>
              <p className="subsection-desc">{config.servicesDropinSubtitle || 'Paga apenas o que usas, sem compromisso.'}</p>
              <div className="services-grid">
                {plans.filter(p => p.billingType === 'dropin').map(plan => (
                  <div key={plan.id} className="service-card dropin-card">
                    <span className="plan-type-badge dropin">Aula Avulsa</span>
                    <h3>{plan.name}</h3>
                    <p className="service-desc">{plan.description}</p>
                    <div className="service-price">
                      <span className="price-amount">{(plan.pricePerSession || 0).toFixed(0)}€</span>
                      <span className="price-detail">por aula · {plan.locationName}</span>
                    </div>
                    {(plan.features || []).length > 0 && (
                      <ul className="service-features">
                        {plan.features.map((f, i) => (
                          <li key={i}><Check size={16} /> {f}</li>
                        ))}
                      </ul>
                    )}
                    {user ? (
                      <Link to={`/checkout?plan=${plan.id}&type=dropin`} className="btn btn-outline w-full">
                        Reservar Aula
                      </Link>
                    ) : (
                      <Link to={`/login?next=${encodeURIComponent(`/checkout?plan=${plan.id}&type=dropin`)}`} className="btn btn-outline w-full">
                        Entrar para reservar
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subscription plans by location */}
          {plans.filter(p => p.billingType === 'subscription' || !p.billingType).length > 0 ? (
            <>
              <h3 className="subsection-title" style={{ marginTop: '2.5rem' }}>{config.servicesPlansTitle || 'Pacotes de Aulas'}</h3>
              <p className="subsection-desc">{config.servicesPlansSubtitle || 'Poupa ao comprar um conjunto de aulas. Sem mensalidade, sem fidelização.'}</p>
              {Object.entries(plansByLocation).filter(([_, lp]) => lp.some(p => p.billingType === 'subscription' || !p.billingType)).map(([locationName, locationPlans]) => (
                <div key={locationName} className="location-group">
                  <div className="location-header">
                    <MapPin size={18} />
                    <h3>{locationName}</h3>
                  </div>
                  <div className="services-grid">
                    {locationPlans.filter(p => p.billingType === 'subscription' || !p.billingType).map(plan => (
                      <div key={plan.id} className={`service-card ${plan.isPopular ? 'popular' : ''}`}>
                        {plan.isPopular && <span className="popular-badge">Mais Popular</span>}
                        <span className="plan-type-badge subscription">Plano Mensal</span>
                        <h3>{plan.name}</h3>
                        <p className="service-desc">{plan.description}</p>
                        <div className="service-price">
                          <span className="price-amount">{(plan.priceMonthly || 0).toFixed(0)}€</span>
                          <span className="price-detail">{(plan as any).validityDays || 30} dias · {plan.sessionsTotal} aulas</span>
                        </div>
                        <ul className="service-features">
                          {(plan.features || []).map((f, i) => (
                            <li key={i}><Check size={16} /> {f}</li>
                          ))}
                        </ul>
                        {user ? (
                          <Link
                            to={`/checkout?plan=${plan.id}&type=subscription`}
                            className={`btn ${plan.isPopular ? 'btn-primary' : 'btn-outline'} w-full`}
                          >
                            Comprar Plano
                          </Link>
                        ) : (
                          <Link
                            to={`/login?next=${encodeURIComponent(`/checkout?plan=${plan.id}&type=subscription`)}`}
                            className={`btn ${plan.isPopular ? 'btn-primary' : 'btn-outline'} w-full`}
                          >
                            Entrar para comprar
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : plans.filter(p => p.billingType === 'dropin').length === 0 ? (
            <div className="no-services">
              <p>Os planos estarão disponíveis em breve.</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      {testimonials.length > 0 && (
        <section id="testemunhos" className="section testimonials-section">
          <div className="container">
            <span className="section-label text-center">{config.testimonialsLabel}</span>
            <h2 className="section-title">{config.testimonialsTitle}</h2>
            <div className="divider" />

            <div className="testimonials-grid">
              {testimonials.map(t => (
                <div key={t.id} className="testimonial-card">
                  <div className="testimonial-stars">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} fill={i < t.rating ? '#f59e0b' : 'none'} color={i < t.rating ? '#f59e0b' : '#d1d5db'} />
                    ))}
                  </div>
                  <p className="testimonial-text">"{t.text}"</p>
                  <div className="testimonial-author">
                    {t.photo ? (
                      <img src={t.photo} alt={t.name} className="testimonial-avatar" />
                    ) : (
                      <div className="testimonial-avatar-placeholder">
                        {t.name.charAt(0)}
                      </div>
                    )}
                    <span className="testimonial-name">{t.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT / CTA SECTION */}
      <section id="contacto" className="section contact-section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-info">
              <span className="section-label">{config.contactLabel}</span>
              <h2>{config.contactTitle}</h2>
              <div className="divider divider-left" />
              <p>{config.contactSubtitle}</p>
              <div className="contact-details">
                {config.phone && (
                  <a href={`tel:${config.phone}`} className="contact-item">
                    <Phone size={20} />
                    <span>{config.phone}</span>
                  </a>
                )}
                {config.email && (
                  <a href={`mailto:${config.email}`} className="contact-item">
                    <Mail size={20} />
                    <span>{config.email}</span>
                  </a>
                )}
                {config.location && (
                  <div className="contact-item">
                    <MapPin size={20} />
                    <span>{config.location}</span>
                  </div>
                )}
                {config.instagram && (
                  <a href={`https://instagram.com/${config.instagram}`} target="_blank" rel="noopener noreferrer" className="contact-item">
                    <Instagram size={20} />
                    <span>@{config.instagram}</span>
                  </a>
                )}
              </div>
            </div>
            <div className="contact-cta-card">
              <h3>{config.contactCtaTitle}</h3>
              <p>{config.contactCtaText}</p>
              <a href={`mailto:${config.email}?subject=${config.contactCtaTitle}`} className="btn btn-primary btn-lg w-full">
                {config.contactEmailButton}
              </a>
              {config.phone && (
                <a href={`tel:${config.phone}`} className="btn btn-outline btn-lg w-full">
                  {config.contactPhoneButton}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer config={config} />

      <style>{`
        .landing-page {
          background: var(--bg-primary);
        }

        /* HERO */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          color: white;
          text-align: center;
          overflow: hidden;
        }

        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(26, 26, 46, 0.4) 0%, rgba(45, 52, 54, 0.55) 100%);
        }

        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 750px;
          padding: 2rem var(--spacing-page);
        }

        .hero-badge {
          display: inline-block;
          padding: 0.375rem 1.25rem;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: var(--radius-full);
          font-size: 0.8125rem;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
        }

        .hero h1 {
          font-size: 3.75rem;
          font-weight: 300;
          line-height: 1.15;
          color: white;
          margin-bottom: 1.5rem;
        }

        .hero-subtitle {
          font-size: 1.125rem;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.85);
          margin-bottom: 2.5rem;
        }

        .hero-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-hero-secondary {
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
        }

        .btn-hero-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .scroll-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          margin: 3rem auto 0;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.6);
          animation: breathe 3s ease infinite;
        }

        /* SECTION LABEL */
        .section-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--primary);
          margin-bottom: 0.75rem;
        }

        .section-label.text-center {
          text-align: center;
        }

        .divider-left {
          margin-left: 0;
          margin-right: auto;
        }

        /* ABOUT */
        .about-section {
          background: var(--bg-secondary);
        }

        .about-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 4rem;
          align-items: center;
        }

        .about-image-wrapper {
          border-radius: var(--radius-2xl);
          overflow: hidden;
          box-shadow: var(--shadow-xl);
          aspect-ratio: 4/5;
        }

        .about-image-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .about-image-placeholder {
          width: 100%;
          height: 100%;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-heading);
          font-size: 5rem;
          font-weight: 300;
          color: white;
        }

        .about-highlights {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .highlight-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--primary-dark);
          background: white;
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .highlight-item svg {
          color: var(--primary);
          flex-shrink: 0;
        }

        .about-text-col h2 {
          margin-bottom: 0;
        }

        .about-text-col p {
          color: var(--text-secondary);
          font-size: 1.0625rem;
          line-height: 1.8;
        }

        /* TEAM */
        .team-section {
          background: var(--bg-primary);
        }

        .team-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
          justify-content: center;
          margin-top: 1rem;
          margin-bottom: 2rem;
        }

        .team-card {
          background: none;
          border: 2px solid transparent;
          border-radius: var(--radius-2xl);
          overflow: hidden;
          cursor: pointer;
          padding: 0;
          width: 180px;
          flex-shrink: 0;
          transition: transform var(--transition-normal), box-shadow var(--transition-normal), border-color var(--transition-normal);
          box-shadow: var(--shadow-sm);
        }

        .team-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .team-card-open {
          border-color: var(--primary);
          box-shadow: var(--shadow-xl);
        }

        .team-photo-wrapper {
          position: relative;
          aspect-ratio: 3/4;
          overflow: hidden;
          background: var(--primary-gradient);
        }

        .team-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .team-card:hover .team-photo {
          transform: scale(1.05);
        }

        .team-photo-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(20,40,20,0.72) 0%, transparent 55%);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 0.875rem;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .team-card:hover .team-photo-overlay,
        .team-card-open .team-photo-overlay {
          opacity: 1;
        }

        .team-photo-overlay span {
          color: white;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.35);
          padding: 0.3rem 0.875rem;
          border-radius: var(--radius-full);
        }

        .team-photo-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.7);
        }

        .team-card-footer {
          background: white;
          padding: 0.875rem 0.875rem 1rem;
          text-align: left;
        }

        .team-specialty {
          display: inline-block;
          font-size: 0.5625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--primary);
          background: rgba(124,154,114,0.12);
          padding: 0.175rem 0.5rem;
          border-radius: var(--radius-full);
          margin-bottom: 0.375rem;
        }

        .team-card-name {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--text-heading);
          margin: 0;
          font-family: var(--font-heading);
        }

        /* Expanded detail panel */
        .team-detail-panel {
          background: var(--bg-secondary);
          border-radius: var(--radius-2xl);
          padding: 3rem;
          box-shadow: var(--shadow-xl);
          border: 1.5px solid rgba(124,154,114,0.2);
        }

        .team-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 3.5rem;
          align-items: start;
        }

        .team-detail-photo-wrapper {
          border-radius: var(--radius-2xl);
          overflow: hidden;
          box-shadow: var(--shadow-xl);
          aspect-ratio: 4/5;
        }

        .team-detail-photo-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .team-detail-photo-placeholder {
          width: 100%;
          height: 100%;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.6);
        }

        .team-detail-name {
          font-size: 2rem;
          font-weight: 300;
          color: var(--text-heading);
          margin: 0.5rem 0 0;
          font-family: var(--font-heading);
        }

        .team-detail-bio {
          color: var(--text-secondary);
          font-size: 1.0625rem;
          line-height: 1.8;
          margin-bottom: 1rem;
        }

        .team-detail-highlights {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.625rem;
          margin-top: 1.75rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--sand);
        }

        /* PRÁTICAS / VINYASA */
        .vinyasa-section {
          background: var(--bg-primary);
        }

        .practice-tabs {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 2.5rem;
        }

        .practice-tab {
          background: var(--bg-secondary);
          border: 2px solid transparent;
          border-radius: var(--radius-full);
          padding: 0.5rem 1.5rem;
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .practice-tab:hover {
          border-color: var(--primary-light);
          color: var(--primary-dark);
        }

        .practice-tab-active {
          background: var(--primary-gradient);
          border-color: transparent;
          color: white;
          font-weight: 600;
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .benefit-card {
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
          padding: 1.75rem;
          text-align: center;
          transition: all var(--transition-normal);
        }

        .benefit-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .benefit-icon {
          width: 52px;
          height: 52px;
          background: var(--primary-gradient);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin: 0 auto 1rem;
        }

        .benefit-card p {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        /* SERVICES */
        .services-section {
          background: var(--bg-secondary);
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .service-card {
          background: white;
          border-radius: var(--radius-xl);
          padding: 2rem;
          text-align: center;
          position: relative;
          border: 2px solid transparent;
          transition: all var(--transition-normal);
          display: flex;
          flex-direction: column;
        }

        .service-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-xl);
        }

        .service-card.popular {
          border-color: var(--primary);
          box-shadow: var(--shadow-lg);
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--primary-gradient);
          color: white;
          padding: 0.25rem 1rem;
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .service-card h3 {
          font-size: 1.375rem;
          margin-bottom: 0.5rem;
        }

        .service-desc {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .service-price {
          margin-bottom: 1.5rem;
        }

        .price-amount {
          font-family: var(--font-heading);
          font-size: 2.75rem;
          font-weight: 600;
          color: var(--text-heading);
        }

        .price-detail {
          display: block;
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }

        .service-features {
          list-style: none;
          padding: 0;
          margin: 0 0 2rem 0;
          text-align: left;
          flex: 1;
        }

        .service-features li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.5rem 0;
          font-size: 0.9375rem;
          color: var(--text-secondary);
        }

        .service-features li svg {
          color: var(--primary);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .location-group {
          margin-bottom: 3rem;
        }

        .location-group:last-child {
          margin-bottom: 0;
        }

        .location-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          color: var(--primary-dark);
        }

        .location-header h3 {
          font-family: var(--font-body);
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
        }

        .plan-type-badge {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.25rem 0.625rem;
          border-radius: var(--radius-full);
          margin-bottom: 0.75rem;
        }

        .plan-type-badge.private {
          background: #dbeafe;
          color: #1e40af;
        }

        .plan-type-badge.group {
          background: #dcfce7;
          color: #166534;
        }

        .plan-schedule {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          margin-bottom: 1.25rem;
          justify-content: center;
        }

        .schedule-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          font-weight: 500;
          background: var(--beige);
          color: var(--text-secondary);
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-full);
        }

        .subsection-title {
          font-family: var(--font-body);
          font-size: 1.125rem;
          font-weight: 600;
          text-align: center;
          color: var(--primary-dark);
          margin-bottom: 0.25rem;
        }

        .subsection-desc {
          text-align: center;
          font-size: 0.9375rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .dropin-section {
          margin-bottom: 1rem;
        }

        .dropin-card {
          border: 2px dashed var(--sand);
          background: var(--cream);
        }

        .plan-type-badge.dropin {
          background: #fef3c7;
          color: #92400e;
        }

        .plan-type-badge.subscription {
          background: #dbeafe;
          color: #1e40af;
        }

        .no-services {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        /* TESTIMONIALS */
        .testimonials-section {
          background: var(--bg-primary);
        }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .testimonial-card {
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
          padding: 2rem;
        }

        .testimonial-stars {
          display: flex;
          gap: 0.125rem;
          margin-bottom: 1rem;
        }

        .testimonial-text {
          font-size: 1rem;
          font-style: italic;
          color: var(--text-secondary);
          line-height: 1.7;
          margin-bottom: 1.5rem;
        }

        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .testimonial-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }

        .testimonial-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--primary-gradient);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .testimonial-name {
          font-weight: 600;
          font-size: 0.9375rem;
        }

        /* CONTACT */
        .contact-section {
          background: var(--bg-secondary);
        }

        .contact-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 4rem;
          align-items: start;
        }

        .contact-info h2 {
          margin-bottom: 0;
        }

        .contact-info p {
          color: var(--text-secondary);
          font-size: 1.0625rem;
          line-height: 1.8;
        }

        .contact-details {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1rem;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1rem;
          color: var(--text-primary);
          text-decoration: none;
          transition: color var(--transition-fast);
        }

        .contact-item:hover {
          color: var(--primary);
        }

        .contact-item svg {
          color: var(--primary);
          flex-shrink: 0;
        }

        .contact-cta-card {
          background: white;
          border-radius: var(--radius-xl);
          padding: 2.5rem;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .contact-cta-card h3 {
          font-size: 1.5rem;
          text-align: center;
        }

        .contact-cta-card p {
          text-align: center;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        /* RESPONSIVE */
        @media (max-width: 1024px) {
          .benefits-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .team-card { width: 140px; }

          .team-detail-panel { padding: 1.5rem; }

          .team-detail-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }

          .team-detail-photo-wrapper {
            max-width: 260px;
            margin: 0 auto;
          }

          .team-detail-name { font-size: 1.5rem; }

          .team-detail-highlights { grid-template-columns: 1fr 1fr; }

          .hero h1 {
            font-size: 2.25rem;
          }

          .hero-subtitle {
            font-size: 1rem;
          }

          .hero-buttons {
            flex-direction: column;
            align-items: center;
          }

          .about-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          .about-image-wrapper {
            max-width: 400px;
            margin: 0 auto;
          }

          .about-highlights {
            grid-template-columns: 1fr;
          }

          .benefits-grid {
            grid-template-columns: 1fr;
          }

          .services-grid {
            grid-template-columns: 1fr;
          }

          .testimonials-grid {
            grid-template-columns: 1fr;
          }

          .contact-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
        }

        @media (max-width: 480px) {
          .team-card { width: 130px; }
        }

        /* HORÁRIOS */
        .schedule-section {
          background: var(--bg-secondary);
        }

        .schedule-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .schedule-view-toggle {
          display: flex;
          background: var(--bg-primary);
          border-radius: var(--radius-full);
          padding: 4px;
          gap: 2px;
        }

        .schedule-view-toggle button {
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          padding: 0.4rem 1.25rem;
          border-radius: var(--radius-full);
          transition: all var(--transition-fast);
        }

        .schedule-view-toggle button.active {
          background: var(--primary-gradient);
          color: white;
          font-weight: 600;
        }

        .schedule-filter-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
        }

        .schedule-filter-tabs button {
          background: none;
          border: 1.5px solid var(--sand);
          border-radius: var(--radius-full);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--text-secondary);
          padding: 0.35rem 1rem;
          transition: all var(--transition-fast);
        }

        .schedule-filter-tabs button:hover {
          border-color: var(--primary-light);
          color: var(--primary-dark);
        }

        .schedule-filter-tabs button.filter-active {
          background: var(--primary-gradient);
          border-color: transparent;
          color: white;
          font-weight: 600;
        }

        .schedule-table {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          max-width: 900px;
          margin: 0 auto;
        }

        .schedule-day-group {
          margin-bottom: 0.5rem;
        }

        .schedule-day-header {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--primary);
          padding: 0.75rem 1rem 0.375rem;
        }

        .schedule-row {
          display: grid;
          grid-template-columns: 90px 1fr auto 100px 110px;
          align-items: center;
          gap: 1rem;
          background: white;
          border-radius: var(--radius-lg);
          padding: 0.875rem 1.25rem;
          margin-bottom: 0.375rem;
          box-shadow: var(--shadow-sm);
          transition: box-shadow var(--transition-fast);
        }

        .schedule-row:hover {
          box-shadow: var(--shadow-md);
        }

        .schedule-time {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .schedule-date {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }

        .schedule-hour {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-heading);
          font-family: var(--font-heading);
        }

        .schedule-hour svg {
          color: var(--primary);
          flex-shrink: 0;
        }

        .schedule-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .schedule-name {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--text-heading);
        }

        .schedule-prof {
          font-size: 0.8125rem;
          color: var(--text-secondary);
        }

        .schedule-meta {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          text-align: right;
        }

        .schedule-duration {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .schedule-location {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .schedule-spots {
          text-align: center;
        }

        .spots-ok {
          font-size: 0.8125rem;
          color: var(--text-secondary);
          background: #f0fdf4;
          color: #166534;
          padding: 0.25rem 0.625rem;
          border-radius: var(--radius-full);
          font-weight: 500;
        }

        .spots-low {
          font-size: 0.8125rem;
          background: #fef2f2;
          color: #991b1b;
          padding: 0.25rem 0.625rem;
          border-radius: var(--radius-full);
          font-weight: 600;
        }

        .schedule-cta {
          display: flex;
          justify-content: flex-end;
        }

        .btn-sm {
          padding: 0.4rem 1rem !important;
          font-size: 0.8125rem !important;
        }

        .schedule-empty {
          text-align: center;
          color: var(--text-secondary);
          padding: 2rem;
        }

        .schedule-empty-card {
          background: white;
          border-radius: var(--radius-lg);
          padding: 2rem 1.5rem;
          text-align: center;
          color: var(--text-secondary);
          box-shadow: var(--shadow-sm);
        }
        .schedule-empty-card p { margin: 0; }

        .schedule-period-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          margin: 1.25rem 0 1.5rem;
          flex-wrap: wrap;
        }

        .schedule-period-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: var(--bg-primary);
          border: 1px solid var(--sand);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          transition: all var(--transition-fast);
        }

        .schedule-period-btn:hover {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .schedule-period-label {
          font-weight: 600;
          font-size: 1rem;
          color: var(--text-primary);
          min-width: 180px;
          text-align: center;
        }

        .schedule-period-today {
          background: none;
          border: 1.5px solid var(--sand);
          border-radius: var(--radius-full);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--primary);
          padding: 0.35rem 0.875rem;
          transition: all var(--transition-fast);
        }

        .schedule-period-today:hover {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .schedule-footer-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          margin-top: 2.5rem;
          padding: 2rem;
          background: white;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-sm);
          flex-wrap: wrap;
        }

        .schedule-footer-cta p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 1rem;
        }

        @media (max-width: 768px) {
          .schedule-row {
            grid-template-columns: 70px 1fr;
            grid-template-rows: auto auto auto;
          }

          .schedule-meta { display: none; }

          .schedule-spots {
            grid-column: 1;
            text-align: left;
          }

          .schedule-cta {
            grid-column: 2;
            grid-row: 2;
          }
        }
      `}</style>
    </div>
  );
}
