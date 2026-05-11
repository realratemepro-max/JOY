import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ContentItem } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, Video, Headphones, Play, Lock, Globe } from 'lucide-react';

const CATEGORIES = ['Aulas Gravadas', 'Meditações', 'Pranayama', 'Yoga Nidra', 'Workshops', 'Outro'];

const emptyItem = {
  title: '', description: '', category: 'Aulas Gravadas',
  type: 'video' as 'video' | 'audio' | 'both',
  videoUrl: '', audioUrl: '', thumbnailUrl: '',
  duration: 30, isPremium: true, isActive: true, order: 0,
  tags: [] as string[], instructor: '',
};

function normalizeVideoUrl(url: string): string {
  if (!url) return url;
  // YouTube watch → embed
  const ytMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // youtu.be shortlink
  const ytShort = url.match(/youtu\.be\/([^?]+)/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;
  // Vimeo (non-embed)
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch && !url.includes('player.vimeo.com')) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}

function isEmbedUrl(url: string): boolean {
  return url.includes('youtube.com/embed') || url.includes('player.vimeo.com');
}

export function AdminContent() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('Todos');
  const [newTag, setNewTag] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'content'), orderBy('order')));
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as ContentItem)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startNew = () => {
    setEditing('new');
    setEditData({ ...emptyItem, order: items.length });
  };

  const startEdit = (item: ContentItem) => { setEditing(item.id); setEditData({ ...item }); };
  const cancelEdit = () => { setEditing(null); setEditData(null); setNewTag(''); };

  const addTag = () => {
    if (!newTag.trim() || !editData) return;
    setEditData({ ...editData, tags: [...(editData.tags || []), newTag.trim()] });
    setNewTag('');
  };

  const handleSave = async () => {
    if (!editData || !editData.title) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'content')).id : editing!;
      await setDoc(doc(db, 'content', id), {
        title: editData.title,
        description: editData.description || '',
        category: editData.category,
        type: editData.type,
        videoUrl: normalizeVideoUrl(editData.videoUrl || ''),
        audioUrl: editData.audioUrl || '',
        thumbnailUrl: editData.thumbnailUrl || '',
        duration: Number(editData.duration) || 0,
        isPremium: editData.isPremium,
        isActive: editData.isActive,
        order: Number(editData.order) || 0,
        tags: editData.tags || [],
        instructor: editData.instructor || '',
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
      });
      await loadItems();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este conteúdo?')) return;
    await deleteDoc(doc(db, 'content', id));
    await loadItems();
  };

  const allCats = ['Todos', ...Array.from(new Set(items.map(i => i.category)))];
  const filtered = filterCat === 'Todos' ? items : items.filter(i => i.category === filterCat);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Aulas gravadas, meditações e outros conteúdos digitais. Conteúdo premium requer subscrição da Biblioteca.
        </p>
        <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Conteúdo</button>
      </div>

      {/* Edit Form */}
      {editing && editData && (
        <div className="edit-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
              {editing === 'new' ? 'Novo Conteúdo' : 'Editar Conteúdo'}
            </h3>
            <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="label">Título</label>
              <input className="input" value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} placeholder="Nome da aula ou meditação" />
            </div>
            <div className="form-group">
              <label className="label">Professor / Autor</label>
              <input className="input" value={editData.instructor || ''} onChange={e => setEditData({ ...editData, instructor: e.target.value })} placeholder="Joaquim Oliveira" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Descrição</label>
            <textarea className="input textarea" rows={2} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="Breve descrição do conteúdo..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="label">Categoria</label>
              <select className="input" value={editData.category} onChange={e => setEditData({ ...editData, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Duração (minutos)</label>
              <input className="input" type="number" min="1" value={editData.duration} onChange={e => setEditData({ ...editData, duration: e.target.value })} style={{ width: 120 }} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Tipo de Conteúdo</label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { value: 'video', label: 'Vídeo', icon: Video, color: '#2563eb' },
                { value: 'audio', label: 'Áudio', icon: Headphones, color: '#7c3aed' },
                { value: 'both', label: 'Vídeo + Áudio', icon: Play, color: '#059669' },
              ].map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', padding: '0.5rem 1rem', border: `2px solid ${editData.type === opt.value ? opt.color : 'var(--sand)'}`, borderRadius: 'var(--radius-lg)', background: editData.type === opt.value ? `${opt.color}15` : 'white' }}>
                  <input type="radio" name="contentType" value={opt.value} checked={editData.type === opt.value} onChange={() => setEditData({ ...editData, type: opt.value })} style={{ display: 'none' }} />
                  <opt.icon size={16} style={{ color: editData.type === opt.value ? opt.color : 'var(--text-muted)' }} />
                  <strong style={{ color: editData.type === opt.value ? opt.color : 'inherit' }}>{opt.label}</strong>
                </label>
              ))}
            </div>
            {editData.type === 'both' && <p style={{ fontSize: '0.75rem', color: '#059669', margin: '0.375rem 0 0' }}>O utilizador poderá escolher ver vídeo ou só ouvir o áudio.</p>}
          </div>

          {(editData.type === 'video' || editData.type === 'both') && (
            <div className="form-group">
              <label className="label">URL do Vídeo</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="input" value={editData.videoUrl || ''} onChange={e => setEditData({ ...editData, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..." style={{ flex: 1 }} />
                {editData.videoUrl && (
                  <button className="btn btn-sm btn-secondary" onClick={() => setPreviewUrl(normalizeVideoUrl(editData.videoUrl))} title="Pré-visualizar">
                    <Play size={14} />
                  </button>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                YouTube, Vimeo, ou URL direto .mp4. O URL do YouTube é convertido automaticamente para embed.
              </span>
            </div>
          )}

          {(editData.type === 'audio' || editData.type === 'both') && (
            <div className="form-group">
              <label className="label">URL do Áudio</label>
              <input className="input" value={editData.audioUrl || ''} onChange={e => setEditData({ ...editData, audioUrl: e.target.value })} placeholder="https://... (.mp3, .m4a, .ogg)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>URL direto de um ficheiro de áudio.</span>
            </div>
          )}

          <div className="form-group">
            <label className="label">Thumbnail (URL da imagem)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input className="input" value={editData.thumbnailUrl || ''} onChange={e => setEditData({ ...editData, thumbnailUrl: e.target.value })} placeholder="https://..." style={{ flex: 1 }} />
              {editData.thumbnailUrl && <img src={editData.thumbnailUrl} alt="" style={{ height: 48, width: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--sand)' }} onError={e => (e.currentTarget.style.display = 'none')} />}
            </div>
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="label">Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
              {(editData.tags || []).map((tag: string, i: number) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.625rem', background: 'var(--bg-secondary)', border: '1px solid var(--sand)', borderRadius: 999, fontSize: '0.8125rem' }}>
                  {tag}
                  <button onClick={() => setEditData({ ...editData, tags: editData.tags.filter((_: any, idx: number) => idx !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="input" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="ex: iniciante, relaxamento..." style={{ flex: 1 }} />
              <button className="btn btn-sm btn-secondary" onClick={addTag}><Plus size={16} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Ordem</label>
              <input className="input" type="number" value={editData.order} onChange={e => setEditData({ ...editData, order: e.target.value })} style={{ width: 80 }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.5rem' }}>
              <input type="checkbox" checked={editData.isPremium} onChange={e => setEditData({ ...editData, isPremium: e.target.checked })} />
              <Lock size={14} style={{ color: editData.isPremium ? '#d97706' : 'var(--text-muted)' }} />
              <span style={{ color: editData.isPremium ? '#d97706' : 'inherit' }}>Requer subscrição</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.5rem' }}>
              <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} />
              Ativo
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.title}>
              {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setPreviewUrl(null)}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewUrl(null)} style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            {isEmbedUrl(previewUrl) ? (
              <iframe src={previewUrl} style={{ width: '100%', aspectRatio: '16/9', border: 'none', borderRadius: 'var(--radius-lg)' }} allowFullScreen />
            ) : (
              <video src={previewUrl} controls style={{ width: '100%', borderRadius: 'var(--radius-lg)' }} />
            )}
          </div>
        </div>
      )}

      {/* Category Filter */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {allCats.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: '0.375rem 0.875rem', borderRadius: 999, border: '1.5px solid', borderColor: filterCat === cat ? 'var(--primary)' : 'var(--sand)', background: filterCat === cat ? 'var(--primary)' : 'white', color: filterCat === cat ? 'white' : 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Content Grid */}
      {filtered.length === 0 && !editing ? (
        <div className="empty-state"><p>Ainda não tens conteúdo. Adiciona o primeiro!</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {filtered.map(item => (
            <div key={item.id} style={{ background: 'white', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', opacity: item.isActive ? 1 : 0.6 }}>
              {/* Thumbnail */}
              <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.type === 'audio' ? <Headphones size={40} style={{ color: 'var(--text-muted)' }} /> : <Video size={40} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                )}
                <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: '0.25rem' }}>
                  <span style={{ padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: item.type === 'audio' ? '#7c3aed' : item.type === 'both' ? '#059669' : '#2563eb', color: 'white' }}>
                    {item.type === 'audio' ? 'ÁUDIO' : item.type === 'both' ? 'VÍD+ÁUD' : 'VÍDEO'}
                  </span>
                  {item.isPremium && <span style={{ padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: '#d97706', color: 'white' }}>PREMIUM</span>}
                </div>
                {item.duration && <span style={{ position: 'absolute', bottom: 8, right: 8, padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', background: 'rgba(0,0,0,0.6)', color: 'white' }}>{item.duration}min</span>}
              </div>
              {/* Info */}
              <div style={{ padding: '0.875rem' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{item.category}</div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9375rem' }}>{item.title}</div>
                {item.instructor && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>{item.instructor}</div>}
                {item.description && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</div>}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => startEdit(item)} disabled={!!editing}><Edit2 size={14} /> Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)} disabled={!!editing}><Trash2 size={14} /></button>
                  {(item.videoUrl || item.audioUrl) && <button className="btn btn-sm btn-secondary" onClick={() => setPreviewUrl(item.videoUrl ? normalizeVideoUrl(item.videoUrl) : item.audioUrl!)} title="Pré-visualizar"><Play size={14} /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        <Globe size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
        <strong>Onde hospedar vídeos:</strong> YouTube (não listado), Vimeo, ou qualquer URL direto .mp4.
        Para áudio: qualquer URL .mp3 ou .m4a. Os ficheiros podem ser no Firebase Storage se preferires controlo total.
      </div>

      <style>{`
        .edit-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 1.5rem; border: 2px solid var(--primary-light); }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; transition: all var(--transition-fast); }
        .btn-icon:hover { border-color: var(--error); color: var(--error); }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }
        @media (max-width: 768px) { .edit-card { padding: 1.25rem; } }
      `}</style>
    </div>
  );
}
