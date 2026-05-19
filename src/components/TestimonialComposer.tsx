import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Professor, Location, Testimonial } from '../types';
import { Star, X, Loader, MapPin, User as UserIcon, ExternalLink, Check, Copy } from 'lucide-react';

interface Props {
  /** Pre-select these professor IDs (e.g. from recent attended session). */
  prefillProfessorIds?: string[];
  /** Pre-select these location IDs. */
  prefillLocationIds?: string[];
  onClose: () => void;
  onSubmitted?: () => void;
}

export function TestimonialComposer({ prefillProfessorIds = [], prefillLocationIds = [], onClose, onSubmitted }: Props) {
  const { user, appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [existingTestimonial, setExistingTestimonial] = useState<Testimonial | null>(null);

  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const [profIds, setProfIds] = useState<string[]>(prefillProfessorIds);
  const [locIds, setLocIds] = useState<string[]>(prefillLocationIds);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [profsSnap, locsSnap, existingSnap] = await Promise.all([
          getDocs(query(collection(db, 'professors'), orderBy('name'))),
          getDocs(query(collection(db, 'locations'), orderBy('order'))),
          // One testimonial per user — find theirs if it exists
          getDoc(doc(db, 'testimonials', user.uid)),
        ]);
        setProfessors(profsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Professor)).filter(p => p.isActive !== false));
        setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)).filter(l => l.isActive !== false));
        if (existingSnap.exists()) {
          const t = { id: existingSnap.id, ...existingSnap.data() } as Testimonial;
          setExistingTestimonial(t);
          setStars(t.rating || 5);
          setText(t.text || '');
          setProfIds(t.taggedProfessorIds || []);
          setLocIds(t.taggedLocationIds || []);
        }
      } finally { setLoading(false); }
    })();
  }, [user]);

  const toggleProf = (id: string) => setProfIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleLoc  = (id: string) => setLocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const submit = async () => {
    if (!user || !appUser) return;
    if (text.trim().length < 10) {
      alert('Escreve pelo menos 10 caracteres para o teu testemunho ficar útil.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        name: appUser.name || user.displayName || user.email,
        text: text.trim(),
        rating: stars,
        isActive: true,
        order: 99,
        taggedProfessorIds: profIds,
        taggedLocationIds: locIds,
        origin: 'client_submitted',
        userId: user.uid,
        userEmail: user.email || '',
        status: 'pending',  // admin must approve before publishing
        featured: false,
        updatedAt: new Date(),
      };
      // 1 testimonial per user — write to deterministic id (user uid)
      const ref = doc(db, 'testimonials', user.uid);
      if (existingTestimonial) {
        // Update keeps existing createdAt
        await setDoc(ref, { ...payload, createdAt: existingTestimonial.createdAt || new Date() }, { merge: true });
      } else {
        await setDoc(ref, { ...payload, createdAt: new Date() });
      }
      setSubmitted({ id: user.uid });
      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      alert(err?.message || 'Erro a submeter testemunho');
    } finally { setSubmitting(false); }
  };

  // Build Google Maps write-review URLs per tagged location with a Place ID
  const googleSharable = locations
    .filter(l => locIds.includes(l.id) && l.googlePlaceId)
    .map(l => ({ name: l.name, url: `https://search.google.com/local/writereview?placeid=${l.googlePlaceId}` }));

  const copyAndOpen = async (url: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!user) return null;
  if (loading) {
    return (
      <div className="tc-overlay" onClick={onClose}>
        <div className="tc-modal" onClick={e => e.stopPropagation()}><Loader className="spinner" size={28} /></div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="tc-overlay" onClick={onClose}>
      <div className="tc-modal" onClick={e => e.stopPropagation()}>
        <button className="tc-close" onClick={onClose}><X size={18} /></button>

        {!submitted ? (
          <>
            <h2>{existingTestimonial ? 'Atualizar o teu testemunho' : 'Deixa o teu testemunho'}</h2>
            <p className="tc-sub">A tua opinião ajuda a comunidade JOY a crescer. Podes editá-la a qualquer altura.</p>

            <div className="tc-section">
              <label>Como classificas a tua experiência?</label>
              <div className="tc-stars">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} estrelas`}>
                    <Star size={32} fill={n <= stars ? '#f59e0b' : 'none'} color={n <= stars ? '#f59e0b' : '#d1d5db'} />
                  </button>
                ))}
              </div>
            </div>

            <div className="tc-section">
              <label>O que queres partilhar?</label>
              <textarea
                rows={6}
                placeholder="Conta-nos a tua história — o que mais te marca no JOY?"
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={800}
              />
              <span className="tc-char">{text.length}/800</span>
            </div>

            <div className="tc-section">
              <label>Quem queres mencionar? (opcional)</label>
              <p className="tc-hint">Marca o(s) professor(es) e espaço(s) que queres destacar. O teu testemunho aparece em cada um.</p>
              <div className="tc-tags">
                {professors.map(p => {
                  const sel = profIds.includes(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => toggleProf(p.id)} className={`tc-chip ${sel ? 'sel-prof' : ''}`}>
                      <UserIcon size={12} /> {p.name}
                    </button>
                  );
                })}
              </div>
              <div className="tc-tags" style={{ marginTop: '0.5rem' }}>
                {locations.map(l => {
                  const sel = locIds.includes(l.id);
                  return (
                    <button key={l.id} type="button" onClick={() => toggleLoc(l.id)} className={`tc-chip ${sel ? 'sel-loc' : ''}`}>
                      <MapPin size={12} /> {l.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="tc-actions">
              <button className="tc-cancel" onClick={onClose} disabled={submitting}>Mais tarde</button>
              <button className="tc-submit" onClick={submit} disabled={submitting || text.trim().length < 10}>
                {submitting ? <Loader size={16} className="spinner" /> : (existingTestimonial ? 'Guardar alterações' : 'Publicar')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="tc-success">
              <div className="tc-success-icon"><Check size={28} /></div>
              <h2>Obrigado pela tua partilha 🙏</h2>
              <p>O teu testemunho está em moderação. Assim que for aprovado, fica visível para todos.</p>
            </div>

            {googleSharable.length > 0 && (
              <div className="tc-google">
                <h3>Importas-te de partilhar também no Google?</h3>
                <p className="tc-sub">Ajuda muito o JOY a aparecer em pesquisas locais. Clica → o texto é copiado para o teu clipboard → cola no Google e submete.</p>
                {googleSharable.map(g => (
                  <button key={g.url} className="tc-google-btn" onClick={() => copyAndOpen(g.url)}>
                    <Copy size={14} /> Partilhar no Google · <strong>{g.name}</strong> <ExternalLink size={14} />
                  </button>
                ))}
              </div>
            )}

            <button className="tc-submit" style={{ marginTop: '1rem' }} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .tc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
  .tc-modal { background: white; border-radius: 20px; max-width: 540px; width: 100%; max-height: 92vh; overflow-y: auto; padding: 1.75rem 1.5rem; box-shadow: 0 20px 60px rgba(0,0,0,0.25); position: relative; }
  .tc-close { position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; cursor: pointer; padding: 0.3rem; color: var(--text-muted); }
  .tc-modal h2 { margin: 0 0 0.25rem; font-family: var(--font-heading); font-size: 1.375rem; }
  .tc-sub { color: var(--text-secondary); font-size: 0.875rem; margin: 0 0 1.25rem; line-height: 1.5; }
  .tc-section { margin-bottom: 1.25rem; }
  .tc-section > label { display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 0.5rem; }
  .tc-stars { display: flex; gap: 0.25rem; }
  .tc-stars button { background: none; border: none; cursor: pointer; padding: 0.125rem; }
  .tc-section textarea { width: 100%; padding: 0.75rem 0.875rem; border: 1.5px solid var(--sand); border-radius: 12px; font-family: inherit; font-size: 0.9375rem; resize: vertical; min-height: 110px; }
  .tc-section textarea:focus { outline: none; border-color: var(--primary); }
  .tc-char { font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.25rem; display: block; text-align: right; }
  .tc-hint { font-size: 0.75rem; color: var(--text-muted); margin: -0.3rem 0 0.5rem; }
  .tc-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .tc-chip { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.3rem 0.7rem; border-radius: 999px; background: white; border: 1.5px solid var(--sand); color: var(--text-secondary); font-size: 0.8125rem; font-weight: 600; cursor: pointer; font-family: inherit; }
  .tc-chip.sel-prof { background: rgba(124,154,114,0.15); border-color: var(--primary); color: var(--primary-dark); }
  .tc-chip.sel-loc  { background: rgba(193,127,89,0.12); border-color: var(--accent); color: var(--accent); }
  .tc-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
  .tc-cancel { background: none; border: 1.5px solid var(--sand); border-radius: 10px; padding: 0.6rem 1rem; cursor: pointer; color: var(--text-secondary); font-family: inherit; font-size: 0.9rem; }
  .tc-submit { background: var(--primary); color: white; border: none; border-radius: 10px; padding: 0.6rem 1.4rem; cursor: pointer; font-weight: 600; font-family: inherit; font-size: 0.9rem; }
  .tc-submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .tc-success { text-align: center; padding: 1rem 0; }
  .tc-success-icon { width: 56px; height: 56px; border-radius: 50%; background: #d1fae5; color: #065f46; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.875rem; }
  .tc-google { background: var(--bg-secondary, #faf8f5); border-radius: 14px; padding: 1rem 1.25rem; margin-top: 1.25rem; }
  .tc-google h3 { margin: 0 0 0.375rem; font-family: var(--font-body); font-size: 1rem; }
  .tc-google-btn { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.625rem 0.875rem; margin-top: 0.5rem; border: 1.5px solid var(--sand); background: white; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 0.875rem; }
  .tc-google-btn:hover { border-color: var(--primary); background: rgba(124,154,114,0.05); }
`;
