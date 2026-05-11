import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Save, Loader, CheckCircle, Cake, AlertCircle } from 'lucide-react';

export function ProfessorProfile() {
  const { professorData, refreshUser } = useAuth();
  const [dateOfBirth, setDateOfBirth] = useState(professorData?.dateOfBirth || '');
  const [bio, setBio] = useState(professorData?.bio || '');
  const [style, setStyle] = useState(professorData?.style || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!professorData) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'professors', professorData.id), {
        dateOfBirth: dateOfBirth || null,
        bio,
        style,
        updatedAt: new Date(),
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      {!professorData.dateOfBirth && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: 'rgba(193,127,89,0.1)', border: '1.5px solid rgba(193,127,89,0.3)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1.5rem' }}>
          <AlertCircle size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>Data de nascimento em falta</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Preenche a tua data de nascimento para receberes uma surpresa no teu aniversário!</div>
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {professorData.photoUrl ? (
            <img src={professorData.photoUrl} alt={professorData.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 600, fontFamily: 'var(--font-heading)', margin: '0 auto' }}>
              {professorData.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.375rem', fontWeight: 400, margin: '0.75rem 0 0.25rem' }}>{professorData.name}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>{professorData.linkedEmail}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Cake size={15} color="var(--accent)" />
              Data de Nascimento
              {!dateOfBirth && <span style={{ color: 'var(--accent)', fontSize: '0.8125rem' }}>*</span>}
            </label>
            <input
              className="input"
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              style={!dateOfBirth ? { borderColor: 'var(--accent)' } : {}}
            />
            {!dateOfBirth && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Necessária para o email de aniversário 🎂
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="label">Estilo de Yoga</label>
            <input className="input" value={style} onChange={e => setStyle(e.target.value)} placeholder="Vinyasa, Hatha, Yin..." />
          </div>

          <div className="form-group">
            <label className="label">Biografia</label>
            <textarea className="input textarea" rows={5} value={bio} onChange={e => setBio(e.target.value)} placeholder="Formação, experiência, filosofia de ensino..." />
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving}
          style={{ marginTop: '1.5rem', width: '100%' }}
        >
          {saving
            ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
            : saved
              ? <><CheckCircle size={18} /> Guardado!</>
              : <><Save size={18} /> Guardar</>
          }
        </button>
      </div>
    </div>
  );
}
