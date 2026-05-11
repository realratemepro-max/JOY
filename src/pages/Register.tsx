import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Phone, ArrowLeft, Loader, Cake, Users } from 'lucide-react';

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const loginLink = next ? `/login?next=${encodeURIComponent(next)}` : '/login';
  const { register, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setReferralCode(ref.toUpperCase());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!dateOfBirth) {
      setLocalError('A data de nascimento é obrigatória.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('As passwords não coincidem.');
      return;
    }
    if (password.length < 6) {
      setLocalError('A password deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!acceptTerms) {
      setLocalError('Tens de aceitar os Termos e a Política de Privacidade para criares conta.');
      return;
    }

    try {
      setLoading(true);
      clearError();
      await register(email, password, name, phone || undefined, dateOfBirth);

      // Record consent on user doc (RGPD audit)
      try {
        const authUser = (await import('firebase/auth')).getAuth().currentUser;
        if (authUser) {
          await updateDoc(doc(db, 'users', authUser.uid), {
            termsAcceptedAt: Timestamp.now(),
            termsAcceptedVersion: '2026-04-26',
          });
        }
      } catch (e) { console.warn('Could not record consent timestamp', e); }

      // Process referral code if provided
      if (referralCode.trim()) {
        try {
          // Find the user with this referral code
          const refSnap = await getDocs(query(collection(db, 'users'), where('referralCode', '==', referralCode.trim().toUpperCase())));
          if (!refSnap.empty) {
            const referrer = refSnap.docs[0];
            // Get the newly created user
            const authUser = (await import('firebase/auth')).getAuth().currentUser;
            if (authUser) {
              // Store referral code on new user
              await updateDoc(doc(db, 'users', authUser.uid), { referredByCode: referralCode.trim().toUpperCase(), referredByUserId: referrer.id });

              // Load referral config to check trigger + referred discount
              const cfgDoc = await getDoc(doc(db, 'siteConfig', 'referrals'));
              const cfg = cfgDoc.exists() ? cfgDoc.data() : null;

              if (cfg?.enabled) {
                let referredPromoId: string | undefined;
                // Give referred user their welcome discount
                if (cfg.referredEnabled && cfg.referredDiscountValue > 0) {
                  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                  let code = 'BEM-';
                  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
                  const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 3);
                  const promoRef = await addDoc(collection(db, 'promoCodes'), {
                    code,
                    discountType: cfg.referredDiscountType || 'percentage',
                    discountValue: cfg.referredDiscountValue || 10,
                    isActive: true, maxUses: 1, currentUses: 0,
                    expiresAt: Timestamp.fromDate(expiry),
                    applicablePlans: [], forUserId: authUser.uid,
                    createdBy: 'system_referral',
                    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
                  });
                  referredPromoId = promoRef.id;
                  await updateDoc(doc(db, 'users', authUser.uid), { referralWelcomePromoCode: code, referralWelcomePromoId: promoRef.id });
                }

                // Create referral doc
                const referrerData = referrer.data();
                await addDoc(collection(db, 'referrals'), {
                  referrerId: referrer.id,
                  referrerName: referrerData.name || '',
                  referrerEmail: referrerData.email || '',
                  referrerCode: referralCode.trim().toUpperCase(),
                  referredId: authUser.uid,
                  referredName: name,
                  referredEmail: email,
                  status: cfg.trigger === 'signup' ? 'rewarded' : 'pending',
                  trigger: cfg.trigger || 'first_purchase',
                  ...(referredPromoId ? { referredPromoId } : {}),
                  createdAt: Timestamp.now(),
                });

                // If trigger = 'signup', immediately reward referrer
                if (cfg.trigger === 'signup') {
                  const rewardExpiry = new Date(); rewardExpiry.setMonth(rewardExpiry.getMonth() + 6);
                  if (cfg.referrerRewardType === 'discount_code') {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    let code = 'REF-';
                    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
                    await addDoc(collection(db, 'promoCodes'), {
                      code, discountType: cfg.referrerDiscountType || 'fixed',
                      discountValue: cfg.referrerRewardValue || 10,
                      isActive: true, maxUses: 1, currentUses: 0,
                      expiresAt: Timestamp.fromDate(rewardExpiry),
                      applicablePlans: [], forUserId: referrer.id,
                      createdBy: 'system_referral', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
                    });
                  }
                }
              }
            }
          }
        } catch (refErr) {
          console.warn('Referral processing failed (non-blocking):', refErr);
        }
      }

      navigate('/app');
    } catch {
      // error handled by context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        <button onClick={() => navigate('/')} className="back-link">
          <ArrowLeft size={16} /> Voltar ao site
        </button>

        <div className="register-header">
          <span className="register-logo">JOY</span>
          <h1>Criar Conta</h1>
          <p>Regista-te para reservar aulas e gerir o teu plano</p>
        </div>

        <form onSubmit={handleSubmit}>
          {(error || localError) && <div className="alert alert-error">{localError || error}</div>}

          <div className="form-group">
            <label className="label">Nome Completo</label>
            <div className="input-icon-wrapper">
              <User size={18} className="input-icon" />
              <input type="text" className="input input-with-icon" value={name} onChange={e => setName(e.target.value)} placeholder="O teu nome" required />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Email</label>
            <div className="input-icon-wrapper">
              <Mail size={18} className="input-icon" />
              <input type="email" className="input input-with-icon" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.pt" required />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Telefone <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
            <div className="input-icon-wrapper">
              <Phone size={18} className="input-icon" />
              <input type="tel" className="input input-with-icon" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+351 912 345 678" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">
              Data de Nascimento
              <span style={{ color: 'var(--accent)', marginLeft: '0.25rem', fontSize: '0.8125rem' }}>*</span>
            </label>
            <div className="input-icon-wrapper">
              <Cake size={18} className="input-icon" />
              <input type="date" className="input input-with-icon" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required max={new Date(new Date().setFullYear(new Date().getFullYear() - 10)).toISOString().split('T')[0]} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Usada para te oferecer uma surpresa no teu aniversário 🎂</span>
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input type="password" className="input input-with-icon" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Confirmar Password</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input type="password" className="input input-with-icon" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repete a password" required />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Código de Referência <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
            <div className="input-icon-wrapper">
              <Users size={18} className="input-icon" />
              <input type="text" className="input input-with-icon" value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())} placeholder="Ex: MARIA-X4K2" style={{ textTransform: 'uppercase' }} />
            </div>
            {referralCode && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', display: 'block' }}>✓ Código de desconto será aplicado após registo</span>}
          </div>

          <div className="form-group consent-group">
            <label className="consent-label">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
              />
              <span>
                Li e aceito os <Link to="/termos" target="_blank" rel="noopener noreferrer">Termos e Condições</Link> e a <Link to="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.
              </span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading || !acceptTerms}>
            {loading ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 'Criar Conta'}
          </button>

          <p className="login-link">
            Já tens conta? <Link to={loginLink}>Entra aqui</Link>
          </p>
        </form>
      </div>

      <style>{`
        .register-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); padding: 2rem; }
        .register-card { width: 100%; max-width: 460px; background: white; border-radius: var(--radius-2xl); padding: 2.5rem; box-shadow: var(--shadow-xl); }
        .back-link { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; color: var(--text-secondary); background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 2rem; transition: color var(--transition-fast); }
        .back-link:hover { color: var(--primary); }
        .register-header { text-align: center; margin-bottom: 2rem; }
        .register-logo { font-family: var(--font-heading); font-size: 2.5rem; font-weight: 600; color: var(--primary-dark); letter-spacing: 0.1em; }
        .register-header h1 { font-family: var(--font-body); font-size: 1.25rem; font-weight: 500; color: var(--text-secondary); margin-top: 0.25rem; }
        .register-header p { font-size: 0.875rem; color: var(--text-muted); }
        .input-icon-wrapper { position: relative; }
        .input-icon { position: absolute; left: 0.875rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .input-with-icon { padding-left: 2.75rem; }
        .login-link { text-align: center; font-size: 0.875rem; color: var(--text-secondary); margin-top: 1.5rem; }
        .login-link a { color: var(--primary); font-weight: 500; }

        .consent-group { margin-bottom: 1rem; }
        .consent-label { display: flex; align-items: flex-start; gap: 0.625rem; font-size: 0.875rem; line-height: 1.45; color: var(--text-secondary); cursor: pointer; }
        .consent-label input[type=\"checkbox\"] { flex-shrink: 0; margin-top: 0.2rem; width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }
        .consent-label a { color: var(--primary); text-decoration: underline; font-weight: 500; }
        .consent-label a:hover { color: var(--primary-dark); }
      `}</style>
    </div>
  );
}
