import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Bell, X, Hash, Cake, Loader, AlertCircle } from 'lucide-react';

/**
 * Non-blocking alert: shows a bell with badge in the bottom-right if the
 * client's profile is missing NIF or date-of-birth. Clicking opens a quick
 * form to fill the missing data. Once saved, the alert disappears.
 *
 * The user CAN dismiss it (snooze 7 days) so they aren't nagged on every visit.
 */
const SNOOZE_KEY = 'joy_profile_alert_snoozed_v1';
const SNOOZE_DAYS = 7;

export function ProfileCompletionAlert() {
  const { user } = useAuth();
  const [missing, setMissing] = useState<{ nif: boolean; dob: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [showBell, setShowBell] = useState(false);

  const [nif, setNif] = useState('');
  const [consumidorFinal, setConsumidorFinal] = useState(false);
  const [dob, setDob] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) return;
        const data = snap.data();
        const noNif = !data.nif && !data.consumidorFinal;
        const noDob = !data.dateOfBirth;
        if (noNif || noDob) {
          setMissing({ nif: noNif, dob: noDob });
          setDob(data.dateOfBirth || '');
          // Check snooze
          try {
            const ts = parseInt(localStorage.getItem(SNOOZE_KEY) || '', 10);
            const snoozedRecently = !Number.isNaN(ts) && Date.now() - ts < SNOOZE_DAYS * 24 * 3600 * 1000;
            setShowBell(!snoozedRecently);
          } catch { setShowBell(true); }
        }
      } catch (e) { console.warn('ProfileCompletionAlert load failed', e); }
    })();
  }, [user]);

  const snooze = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch {}
    setShowBell(false);
  };

  const submit = async () => {
    if (!user) return;
    setError(null);
    const trimmedNif = nif.trim().replace(/\s/g, '');
    if (missing?.nif && !consumidorFinal && !/^\d{9}$/.test(trimmedNif)) {
      setError('Indica um NIF válido (9 dígitos) ou marca "Sou consumidor final".');
      return;
    }
    if (missing?.dob && !dob) {
      setError('A data de nascimento é necessária.');
      return;
    }
    setSaving(true);
    try {
      const updates: any = { updatedAt: new Date() };
      if (missing?.nif) {
        updates.nif = consumidorFinal ? '' : trimmedNif;
        updates.consumidorFinal = consumidorFinal;
      }
      if (missing?.dob) {
        updates.dateOfBirth = dob;
      }
      await updateDoc(doc(db, 'users', user.uid), updates);
      setOpen(false);
      setMissing(null);
      setShowBell(false);
      try { localStorage.removeItem(SNOOZE_KEY); } catch {}
    } catch (e: any) {
      setError(e?.message || 'Erro a guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!user || !missing || !showBell) return null;

  return (
    <>
      <button
        className="pca-bell"
        onClick={() => setOpen(true)}
        title="Tens dados em falta no perfil"
        aria-label="Perfil incompleto"
      >
        <Bell size={18} />
        <span className="pca-badge">!</span>
      </button>

      {open && (
        <div className="pca-overlay" onClick={() => setOpen(false)}>
          <div className="pca-modal" onClick={e => e.stopPropagation()}>
            <button className="pca-close" onClick={() => setOpen(false)}><X size={18} /></button>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div className="pca-icon"><AlertCircle size={24} /></div>
              <h3>Completa o teu perfil</h3>
              <p className="pca-sub">Faltam-te dados rápidos de preencher (~30s).</p>
            </div>

            {missing.dob && (
              <div className="pca-field">
                <label><Cake size={14} /> Data de nascimento</label>
                <input
                  type="date"
                  className="pca-input"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 10)).toISOString().split('T')[0]}
                />
                <small>Para te enviarmos uma surpresa no teu aniversário 🎂</small>
              </div>
            )}

            {missing.nif && (
              <div className="pca-field">
                <label><Hash size={14} /> NIF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{9}"
                  maxLength={9}
                  className="pca-input"
                  value={nif}
                  onChange={e => setNif(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="9 dígitos"
                  disabled={consumidorFinal}
                />
                <label className="pca-checkbox">
                  <input type="checkbox" checked={consumidorFinal} onChange={e => setConsumidorFinal(e.target.checked)} />
                  Sou consumidor final (dispensa fatura com NIF)
                </label>
              </div>
            )}

            {error && <div className="pca-error">{error}</div>}

            <div className="pca-actions">
              <button className="pca-snooze" onClick={() => { snooze(); setOpen(false); }} disabled={saving}>
                Mais tarde
              </button>
              <button className="pca-save" onClick={submit} disabled={saving}>
                {saving ? <Loader size={14} className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pca-bell { position: fixed; bottom: 1.25rem; right: 1.25rem; width: 48px; height: 48px; border-radius: 50%; background: #fbbf24; color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(251,191,36,0.4); z-index: 1898; transition: transform 0.15s; }
        .pca-bell:hover { transform: scale(1.05); }
        .pca-badge { position: absolute; top: 4px; right: 4px; width: 16px; height: 16px; border-radius: 50%; background: #dc2626; color: white; font-size: 0.625rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }

        .pca-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 2001; padding: 1rem; }
        .pca-modal { background: white; border-radius: 18px; max-width: 420px; width: 100%; padding: 1.5rem; box-shadow: 0 20px 60px rgba(0,0,0,0.25); position: relative; }
        .pca-close { position: absolute; top: 0.625rem; right: 0.625rem; background: none; border: none; cursor: pointer; padding: 0.3rem; color: var(--text-muted); }
        .pca-icon { width: 48px; height: 48px; border-radius: 50%; background: #fef3c7; color: #92400e; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; }
        .pca-modal h3 { margin: 0 0 0.25rem; font-family: var(--font-body); font-size: 1.125rem; font-weight: 600; }
        .pca-sub { color: var(--text-secondary); font-size: 0.875rem; margin: 0; }
        .pca-field { margin-bottom: 1rem; }
        .pca-field label { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; font-weight: 600; margin-bottom: 0.375rem; color: var(--text-primary); }
        .pca-field small { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.375rem; }
        .pca-input { width: 100%; padding: 0.5rem 0.75rem; border: 1.5px solid var(--sand); border-radius: 8px; font-family: inherit; font-size: 0.9375rem; }
        .pca-input:disabled { opacity: 0.5; }
        .pca-checkbox { font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.5rem; font-weight: 400; cursor: pointer; }
        .pca-checkbox input { margin-right: 0.4rem; }
        .pca-error { background: #fee2e2; color: #991b1b; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.8125rem; margin-bottom: 0.75rem; }
        .pca-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
        .pca-snooze { background: none; border: 1.5px solid var(--sand); border-radius: 8px; padding: 0.5rem 0.875rem; font-size: 0.875rem; cursor: pointer; color: var(--text-secondary); font-family: inherit; }
        .pca-save { background: var(--primary); color: white; border: none; border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; font-family: inherit; }
        .pca-save:disabled { opacity: 0.6; }
      `}</style>
    </>
  );
}
