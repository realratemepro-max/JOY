import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { ContentItem, ContentSubscription } from '../../types';
import { Play, Headphones, Lock, Video, X, Volume2, Monitor, Search, Check } from 'lucide-react';

function normalizeVideoUrl(url: string): string {
  if (!url) return url;
  const ytMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const ytShort = url.match(/youtu\.be\/([^?]+)/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;
  return url;
}

function isEmbedUrl(url: string): boolean {
  return url.includes('youtube.com/embed') || url.includes('player.vimeo.com');
}

export function ClientLibrary() {
  const { user } = useAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [subscription, setSubscription] = useState<ContentSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('Todos');
  const [search, setSearch] = useState('');
  const [player, setPlayer] = useState<ContentItem | null>(null);
  const [audioMode, setAudioMode] = useState(false);
  const [contentPlanId, setContentPlanId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    try {
      const [contentSnap, plansSnap] = await Promise.all([
        getDocs(query(collection(db, 'content'), orderBy('order'))),
        getDocs(query(collection(db, 'plans'), where('isContentPlan', '==', true), where('isActive', '==', true))),
      ]);
      setItems(contentSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as ContentItem)).filter(i => i.isActive));
      if (plansSnap.docs.length > 0) setContentPlanId(plansSnap.docs[0].id);

      if (user) {
        const subSnap = await getDocs(query(
          collection(db, 'contentSubscriptions'),
          where('userId', '==', user.uid),
          where('status', '==', 'active'),
        ));
        const now = new Date();
        const activeSub = subSnap.docs
          .map(d => ({ id: d.id, ...d.data(), startDate: d.data().startDate?.toDate(), endDate: d.data().endDate?.toDate(), createdAt: d.data().createdAt?.toDate() } as ContentSubscription))
          .find(s => s.endDate > now);
        setSubscription(activeSub || null);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openPlayer = (item: ContentItem) => {
    if (item.isPremium && !subscription) return;
    setPlayer(item);
    setAudioMode(item.type === 'audio');
  };

  const allCats = ['Todos', ...Array.from(new Set(items.map(i => i.category)))];

  const filtered = items.filter(i => {
    if (filterCat !== 'Todos' && i.category !== filterCat) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasAccess = (item: ContentItem) => !item.isPremium || !!subscription;

  const typeLabel = (type: string) => type === 'audio' ? 'Áudio' : type === 'both' ? 'Vídeo + Áudio' : 'Vídeo';
  const typeColor = (type: string) => type === 'audio' ? 'var(--accent)' : type === 'both' ? 'var(--primary-dark)' : 'var(--primary)';

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Subscription banner — no access */}
      {!subscription && (
        <div style={{ background: 'var(--primary-gradient)', borderRadius: 'var(--radius-xl)', padding: '1.5rem 2rem', marginBottom: '1.5rem', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <Lock size={18} style={{ color: 'rgba(255,255,255,0.8)' }} />
              <strong style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>Biblioteca Digital</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.85)' }}>
              Acede a aulas gravadas, meditações e muito mais. Cancela quando quiseres.
            </p>
          </div>
          {contentPlanId ? (
            <a href={`/checkout?plan=${contentPlanId}`} className="btn" style={{ background: 'white', color: 'var(--primary-dark)', border: 'none', whiteSpace: 'nowrap', fontWeight: 600 }}>
              Subscrever Biblioteca
            </a>
          ) : (
            <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>Em breve</span>
          )}
        </div>
      )}

      {/* Active subscription badge */}
      {subscription && (
        <div style={{ background: 'rgba(124,154,114,0.1)', border: '1px solid rgba(124,154,114,0.25)', borderRadius: 'var(--radius-lg)', padding: '0.875rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Check size={18} color="white" />
          </div>
          <div>
            <strong style={{ color: 'var(--primary-dark)' }}>Biblioteca Digital ativa</strong>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Acesso até {subscription.endDate.toLocaleDateString('pt-PT')} · {subscription.planName}
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." style={{ paddingLeft: '2.25rem' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {allCats.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: '0.375rem 0.875rem', borderRadius: 999, border: '1.5px solid', borderColor: filterCat === cat ? 'var(--primary)' : 'var(--sand)', background: filterCat === cat ? 'var(--primary)' : 'white', color: filterCat === cat ? 'white' : 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'white', borderRadius: 'var(--radius-xl)' }}>
          <Video size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', display: 'block', margin: '0 auto 1rem' }} />
          <p>Nenhum conteúdo disponível nesta categoria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {filtered.map(item => {
            const accessible = hasAccess(item);
            return (
              <div
                key={item.id}
                onClick={() => accessible ? openPlayer(item) : undefined}
                style={{ background: 'white', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', cursor: accessible ? 'pointer' : 'default', transition: 'all 0.2s' }}
                className="lib-card"
              >
                {/* Thumbnail */}
                <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--beige)', overflow: 'hidden' }}>
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: accessible ? 'none' : 'brightness(0.6) saturate(0.5)' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--beige)' }}>
                      {item.type === 'audio'
                        ? <Headphones size={44} style={{ color: accessible ? 'var(--accent)' : 'var(--text-muted)' }} />
                        : <Video size={44} style={{ color: accessible ? 'var(--primary)' : 'var(--text-muted)' }} />}
                    </div>
                  )}

                  {/* Play / Lock overlay */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="lib-overlay">
                    {accessible ? (
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="lib-play-btn">
                        {item.type === 'audio'
                          ? <Headphones size={20} style={{ color: 'var(--accent)' }} />
                          : <Play size={20} style={{ color: 'var(--primary)', marginLeft: 2 }} />}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'white', background: 'rgba(0,0,0,0.55)', borderRadius: 'var(--radius-lg)', padding: '0.625rem 1rem' }}>
                        <Lock size={22} style={{ marginBottom: '0.25rem', display: 'block', margin: '0 auto 0.25rem' }} />
                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Premium</div>
                      </div>
                    )}
                  </div>

                  {/* Type badge */}
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(255,255,255,0.92)', color: typeColor(item.type) }}>
                      {typeLabel(item.type).toUpperCase()}
                    </span>
                  </div>
                  {item.duration && (
                    <span style={{ position: 'absolute', bottom: 8, right: 8, padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', background: 'rgba(0,0,0,0.5)', color: 'white' }}>
                      {item.duration}min
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '0.875rem' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--primary-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '0.25rem' }}>{item.category}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{item.title}</div>
                  {item.instructor && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.instructor}</div>}
                  {!accessible && (
                    <div style={{ marginTop: '0.625rem', fontSize: '0.8125rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Lock size={12} /> Subscrição necessária
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Player Modal */}
      {player && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setPlayer(null)}>
          <div style={{ width: '100%', maxWidth: 860, position: 'relative' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
              <div>
                <div style={{ color: 'var(--primary-light)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{player.category}</div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 400 }}>{player.title}</h2>
                {player.instructor && <div style={{ color: 'var(--secondary-light)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{player.instructor}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                {/* Audio/Video toggle for 'both' type */}
                {player.type === 'both' && (
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-lg)', padding: '0.25rem', gap: '0.25rem' }}>
                    <button onClick={() => setAudioMode(false)} style={{ padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)', border: 'none', background: !audioMode ? 'white' : 'transparent', color: !audioMode ? 'var(--primary-dark)' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}>
                      <Monitor size={14} /> Vídeo
                    </button>
                    <button onClick={() => setAudioMode(true)} style={{ padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)', border: 'none', background: audioMode ? 'white' : 'transparent', color: audioMode ? 'var(--primary-dark)' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}>
                      <Volume2 size={14} /> Só Áudio
                    </button>
                  </div>
                )}
                <button onClick={() => setPlayer(null)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', borderRadius: 'var(--radius-md)', padding: '0.5rem', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Video Player */}
            {!audioMode && (player.type === 'video' || player.type === 'both') && player.videoUrl && (
              isEmbedUrl(player.videoUrl) ? (
                <iframe src={player.videoUrl} style={{ width: '100%', aspectRatio: '16/9', border: 'none', borderRadius: 'var(--radius-xl)' }} allowFullScreen allow="autoplay; fullscreen" />
              ) : (
                <video src={player.videoUrl} controls autoPlay style={{ width: '100%', borderRadius: 'var(--radius-xl)', background: 'black' }} />
              )
            )}

            {/* Audio Player */}
            {(audioMode || player.type === 'audio') && player.audioUrl && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-xl)', padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                {player.thumbnailUrl ? (
                  <img src={player.thumbnailUrl} alt="" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(163,196,154,0.4)' }} />
                ) : (
                  <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Headphones size={38} color="white" />
                  </div>
                )}
                <div style={{ textAlign: 'center', color: 'white' }}>
                  <div style={{ fontWeight: 400, fontSize: '1.125rem', fontFamily: 'var(--font-heading)' }}>{player.title}</div>
                  {player.instructor && <div style={{ color: 'var(--secondary-light)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{player.instructor}</div>}
                </div>
                <audio src={player.audioUrl} controls autoPlay style={{ width: '100%', maxWidth: 480 }} />
              </div>
            )}

            {/* Description */}
            {player.description && (
              <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '1rem', fontSize: '0.875rem', lineHeight: 1.7 }}>{player.description}</p>
            )}

            {/* Tags */}
            {(player.tags || []).length > 0 && (
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                {(player.tags || []).map((tag, i) => (
                  <span key={i} style={{ padding: '0.2rem 0.625rem', borderRadius: 999, background: 'rgba(163,196,154,0.12)', color: 'var(--primary-light)', fontSize: '0.75rem', border: '1px solid rgba(163,196,154,0.2)' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .lib-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .lib-card:hover .lib-play-btn { opacity: 1 !important; }
        .lib-card:hover .lib-overlay { background: rgba(0,0,0,0.12); }
        @media (max-width: 640px) { .lib-card { border-radius: var(--radius-lg) !important; } }
      `}</style>
    </div>
  );
}
