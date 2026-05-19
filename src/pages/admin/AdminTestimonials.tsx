import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Testimonial, SessionRating, Professor, Location, TestimonialOrigin } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Loader, Star, Clock, Check, XIcon, MapPin, User as UserIcon, Tag as TagIcon } from 'lucide-react';
import { ImageUpload } from '../../components/ImageUpload';

type Tab = 'all' | 'pending';

export function AdminTestimonials() {
  const [tab, setTab] = useState<Tab>('all');
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [pending, setPending] = useState<SessionRating[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    // Each query independent — one failing must not block the others.
    const [testRes, pendRes, profsRes, locsRes] = await Promise.allSettled([
      getDocs(query(collection(db, 'testimonials'), orderBy('order'))),
      getDocs(query(collection(db, 'sessionRatings'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'professors'), orderBy('name'))),
      getDocs(query(collection(db, 'locations'), orderBy('order'))),
    ]);

    if (testRes.status === 'fulfilled') {
      setTestimonials(testRes.value.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() } as Testimonial)));
    } else { console.error('testimonials load failed', testRes.reason); }

    if (pendRes.status === 'fulfilled') {
      setPending(pendRes.value.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate(), sessionDate: data.sessionDate?.toDate() } as SessionRating;
      }));
    } else { console.warn('sessionRatings pending load failed (likely missing index)', pendRes.reason); }

    if (profsRes.status === 'fulfilled') {
      setProfessors(profsRes.value.docs.map(d => ({ id: d.id, ...d.data() } as Professor)));
    } else { console.error('professors load failed', profsRes.reason); }

    if (locsRes.status === 'fulfilled') {
      setLocations(locsRes.value.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
    } else { console.error('locations load failed', locsRes.reason); }

    setLoading(false);
  };

  // ─── Testimonial CRUD ───────────────────────────────────────────────────────
  const startNew = () => {
    setEditing('new');
    setEditData({
      name: '', text: '', rating: 5, photo: '',
      isActive: true, order: testimonials.length,
      taggedProfessorIds: [],
      taggedLocationIds: [],
      origin: 'manual' as TestimonialOrigin,
      status: 'approved',
      featured: false,
    });
  };
  const startEdit = (t: Testimonial) => {
    setEditing(t.id);
    setEditData({
      ...t,
      taggedProfessorIds: t.taggedProfessorIds || [],
      taggedLocationIds: t.taggedLocationIds || [],
      origin: t.origin || 'manual',
      status: t.status || 'approved',
    });
  };
  const cancelEdit = () => { setEditing(null); setEditData(null); };

  const toggleProfTag = (id: string) => {
    const list: string[] = editData.taggedProfessorIds || [];
    setEditData({ ...editData, taggedProfessorIds: list.includes(id) ? list.filter(x => x !== id) : [...list, id] });
  };
  const toggleLocTag = (id: string) => {
    const list: string[] = editData.taggedLocationIds || [];
    setEditData({ ...editData, taggedLocationIds: list.includes(id) ? list.filter(x => x !== id) : [...list, id] });
  };

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const id = editing === 'new' ? doc(collection(db, 'testimonials')).id : editing!;
      const data: any = {
        ...editData,
        rating: Number(editData.rating),
        order: Number(editData.order),
        createdAt: editing === 'new' ? new Date() : editData.createdAt,
        updatedAt: new Date(),
        taggedProfessorIds: editData.taggedProfessorIds || [],
        taggedLocationIds: editData.taggedLocationIds || [],
        origin: editData.origin || 'manual',
        status: editData.status || 'approved',
        featured: !!editData.featured,
      };
      delete data.id;
      await setDoc(doc(db, 'testimonials', id), data);
      await loadAll();
      cancelEdit();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este testemunho permanentemente?')) return;
    await deleteDoc(doc(db, 'testimonials', id));
    await loadAll();
  };

  // ─── Rating approval ────────────────────────────────────────────────────────
  const handleApprove = async (rating: SessionRating) => {
    setActing(rating.id);
    try {
      // Create testimonial from rating
      const testRef = await addDoc(collection(db, 'testimonials'), {
        name: rating.userName,
        text: rating.comment || '',
        rating: rating.stars,
        isActive: true,
        order: 99,
        source: 'rating',
        ratingId: rating.id,
        createdAt: new Date(),
      });
      await updateDoc(doc(db, 'sessionRatings', rating.id), {
        status: 'approved',
        testimonialId: testRef.id,
      });
      await loadAll();
    } catch (err) { console.error(err); }
    finally { setActing(null); }
  };

  const handleReject = async (ratingId: string) => {
    setActing(ratingId);
    try {
      await updateDoc(doc(db, 'sessionRatings', ratingId), { status: 'rejected' });
      await loadAll();
    } catch (err) { console.error(err); }
    finally { setActing(null); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Tabs + header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', background: 'white', borderRadius: 'var(--radius-lg)', padding: '0.25rem', boxShadow: 'var(--shadow-sm)', width: 'fit-content' }}>
          <button
            className={`tab ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            Todos ({testimonials.length})
          </button>
          <button
            className={`tab ${tab === 'pending' ? 'active' : ''}`}
            onClick={() => setTab('pending')}
            style={{ position: 'relative' }}
          >
            Por Aprovar
            {pending.length > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--accent)', color: 'white', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, padding: '0.1rem 0.4rem', minWidth: 18, textAlign: 'center' }}>
                {pending.length}
              </span>
            )}
          </button>
        </div>
        {tab === 'all' && (
          <button className="btn btn-primary" onClick={startNew} disabled={!!editing}><Plus size={18} /> Novo Testemunho</button>
        )}
      </div>

      {/* ── ALL TESTIMONIALS ── */}
      {tab === 'all' && (
        <>
          {editing && editData && (
            <div className="edit-card">
              <div className="edit-header">
                <h3>{editing === 'new' ? 'Novo Testemunho' : 'Editar Testemunho'}</h3>
                <button className="btn-icon" onClick={cancelEdit}><X size={18} /></button>
              </div>
              <div className="edit-grid">
                <div className="form-group"><label className="label">Nome</label><input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Nome do aluno" /></div>
                <div className="form-group">
                  <label className="label">Avaliação</label>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setEditData({ ...editData, rating: n })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                        <Star size={24} fill={n <= editData.rating ? '#f59e0b' : 'none'} color={n <= editData.rating ? '#f59e0b' : '#d1d5db'} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-group"><label className="label">Texto</label><textarea className="input textarea" rows={4} value={editData.text} onChange={e => setEditData({ ...editData, text: e.target.value })} placeholder="O que o aluno disse..." /></div>

              {/* Tags */}
              <div className="form-group">
                <label className="label"><TagIcon size={14} style={{ display: 'inline', marginRight: 4 }} /> Tags — Professores</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                  {professors.length === 0 && <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Sem professores criados ainda.</span>}
                  {professors.map(p => {
                    const sel = (editData.taggedProfessorIds || []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProfTag(p.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                          padding: '0.3rem 0.7rem',
                          borderRadius: 999,
                          background: sel ? 'rgba(124,154,114,0.15)' : 'white',
                          border: `1.5px solid ${sel ? 'var(--primary)' : 'var(--sand)'}`,
                          color: sel ? 'var(--primary-dark)' : 'var(--text-secondary)',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <UserIcon size={12} /> {p.name}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Aparece no card destes professores no site.
                </span>
              </div>

              <div className="form-group">
                <label className="label"><TagIcon size={14} style={{ display: 'inline', marginRight: 4 }} /> Tags — Espaços</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                  {locations.map(l => {
                    const sel = (editData.taggedLocationIds || []).includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleLocTag(l.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                          padding: '0.3rem 0.7rem',
                          borderRadius: 999,
                          background: sel ? 'rgba(193,127,89,0.12)' : 'white',
                          border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--sand)'}`,
                          color: sel ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <MapPin size={12} /> {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="edit-grid">
                <div className="form-group">
                  <label className="label">Origem</label>
                  <select className="input" value={editData.origin || 'manual'} onChange={e => setEditData({ ...editData, origin: e.target.value as TestimonialOrigin })}>
                    <option value="manual">Manual (admin)</option>
                    <option value="client_submitted">Submetido pelo cliente</option>
                    <option value="google">Importado do Google</option>
                    <option value="imported">Outro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Estado</label>
                  <select className="input" value={editData.status || 'approved'} onChange={e => setEditData({ ...editData, status: e.target.value as any })}>
                    <option value="approved">Aprovado (público)</option>
                    <option value="pending">Pendente (oculto)</option>
                    <option value="rejected">Rejeitado</option>
                  </select>
                </div>
              </div>

              <div className="edit-grid">
                <ImageUpload value={editData.photo || ''} onChange={url => setEditData({ ...editData, photo: url })} folder="testimonials" label="Foto" />
                <div className="form-group"><label className="label">Ordem</label><input className="input" type="number" value={editData.order} onChange={e => setEditData({ ...editData, order: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.checked })} />
                  Ativo (visível no site)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!editData.featured} onChange={e => setEditData({ ...editData, featured: e.target.checked })} />
                  ⭐ Em destaque na landing
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editData.name || !editData.text}>
                  {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={18} /> Guardar</>}
                </button>
                <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
              </div>
            </div>
          )}

          {testimonials.length === 0 && !editing ? (
            <div className="empty-state"><p>Sem testemunhos. Adiciona o primeiro!</p></div>
          ) : (
            <div className="testimonials-list">
              {testimonials.map(t => (
                <div key={t.id} className={`testimonial-row ${!t.isActive ? 'inactive' : ''}`}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                      <strong>{t.name}</strong>
                      <div style={{ display: 'flex', gap: '0.125rem' }}>
                        {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < t.rating ? '#f59e0b' : 'none'} color={i < t.rating ? '#f59e0b' : '#d1d5db'} />)}
                      </div>
                      {!t.isActive && <span className="badge badge-warning">Inativo</span>}
                      {(t as any).source === 'rating' && <span style={{ fontSize: '0.7rem', background: 'rgba(124,154,114,0.12)', color: 'var(--primary-dark)', padding: '0.1rem 0.4rem', borderRadius: 999 }}>via avaliação</span>}
                    </div>
                    <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>"{t.text.substring(0, 120)}{t.text.length > 120 ? '...' : ''}"</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => startEdit(t)} disabled={!!editing}><Edit2 size={14} /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)} disabled={!!editing}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── PENDING RATINGS ── */}
      {tab === 'pending' && (
        <>
          {pending.length === 0 ? (
            <div className="empty-state">
              <Check size={32} color="var(--primary)" style={{ margin: '0 auto 0.75rem' }} />
              <p>Sem avaliações a aguardar aprovação.</p>
            </div>
          ) : (
            <div className="testimonials-list">
              {pending.map(r => (
                <div key={r.id} className="testimonial-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                        <strong>{r.userName}</strong>
                        <div style={{ display: 'flex', gap: '0.125rem' }}>
                          {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < r.stars ? '#f59e0b' : 'none'} color={i < r.stars ? '#f59e0b' : '#d1d5db'} />)}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={12} /> {r.createdAt?.toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                      {r.sessionName && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          Aula: {r.sessionName}{r.sessionDate ? ` · ${r.sessionDate.toLocaleDateString('pt-PT')}` : ''}
                        </div>
                      )}
                      <div style={{ background: 'var(--beige)', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                        "{r.comment}"
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'rgba(220,53,69,0.07)', color: 'var(--error)', border: '1.5px solid rgba(220,53,69,0.2)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      onClick={() => handleReject(r.id)}
                      disabled={!!acting}
                    >
                      {acting === r.id ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <><XIcon size={13} /> Rejeitar</>}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'rgba(124,154,114,0.1)', color: 'var(--primary-dark)', border: '1.5px solid rgba(124,154,114,0.3)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      onClick={() => handleApprove(r)}
                      disabled={!!acting}
                    >
                      {acting === r.id ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <><Check size={13} /> Aprovar e Publicar</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        .tab { background: none; border: none; padding: 0.5rem 1.25rem; font-family: var(--font-body); font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); position: relative; }
        .tab.active { background: var(--primary); color: white; }
        .edit-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 1.5rem; border: 2px solid var(--primary-light); }
        .edit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .edit-header h3 { font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; margin: 0; }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.375rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; }
        .testimonials-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .testimonial-row { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
        .testimonial-row.inactive { opacity: 0.6; }
        .testimonial-row:hover { box-shadow: var(--shadow-md); }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: var(--radius-xl); }
        @media (max-width: 768px) { .edit-grid { grid-template-columns: 1fr; } .testimonial-row { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
}
