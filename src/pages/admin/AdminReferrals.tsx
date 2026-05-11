import React, { useEffect, useState } from 'react';
import {
  collection, getDocs, query, orderBy, doc, setDoc, getDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ReferralConfig, Referral, ReferralStatus } from '../../types';
import { Users, Settings, Save, Loader, CheckCircle } from 'lucide-react';

const DEFAULT_CONFIG: ReferralConfig = {
  enabled: false,
  referrerRewardType: 'discount_code',
  referrerRewardValue: 10,
  referrerDiscountType: 'fixed',
  trigger: 'first_purchase',
  referredEnabled: true,
  referredDiscountType: 'percentage',
  referredDiscountValue: 10,
  description: 'Convida um amigo e ambos ganham!',
};

const STATUS_LABELS: Record<ReferralStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pendente',   color: '#92400e', bg: '#fef3c7' },
  rewarded: { label: 'Recompensado', color: '#166534', bg: '#dcfce7' },
  cancelled:{ label: 'Cancelado',  color: '#6b7280', bg: '#f3f4f6' },
};

export function AdminReferrals() {
  const [config, setConfig] = useState<ReferralConfig>(DEFAULT_CONFIG);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [tab, setTab] = useState<'config' | 'list'>('config');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const cfgDoc = await getDoc(doc(db, 'siteConfig', 'referrals'));
      if (cfgDoc.exists()) setConfig({ ...DEFAULT_CONFIG, ...cfgDoc.data() as ReferralConfig });

      const snap = await getDocs(query(collection(db, 'referrals'), orderBy('createdAt', 'desc')));
      setReferrals(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          createdAt: data.createdAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
        } as Referral;
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, 'siteConfig', 'referrals'), { ...config, updatedAt: Timestamp.now() });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (err) { console.error(err); alert('Erro ao guardar configuração'); }
    finally { setSavingConfig(false); }
  };

  const counts = {
    all: referrals.length,
    pending: referrals.filter(r => r.status === 'pending').length,
    rewarded: referrals.filter(r => r.status === 'rewarded').length,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', margin: 0 }}>Programa de Referência</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>Configure e monitorize o programa de referências</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: config.enabled ? 'var(--success)' : 'var(--text-muted)' }}>
            {config.enabled ? '● Ativo' : '○ Inativo'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-bar" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${tab === 'config' ? 'active' : ''}`} onClick={() => setTab('config')}>
          <Settings size={14} /> Configuração
        </button>
        <button className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          <Users size={14} /> Referências ({counts.all})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : tab === 'config' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Config panel */}
          <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '1.0625rem', fontWeight: 600 }}>Configurações Gerais</h2>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <div style={{ position: 'relative', width: 44, height: 24, flexShrink: 0 }}>
                <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
                <div onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))} style={{ position: 'absolute', inset: 0, background: config.enabled ? 'var(--primary)' : '#d1d5db', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: config.enabled ? 22 : 2, width: 20, height: 20, background: 'white', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>
              <span style={{ fontWeight: 500 }}>Programa ativo</span>
            </label>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Descrição para utilizadores</label>
              <textarea className="input" rows={2} value={config.description} onChange={e => setConfig(c => ({ ...c, description: e.target.value }))} style={{ resize: 'vertical' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mostrado no dashboard do cliente</span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Gatilho de recompensa</label>
              <select className="input" value={config.trigger} onChange={e => setConfig(c => ({ ...c, trigger: e.target.value as any }))}>
                <option value="signup">Ao registar (imediato)</option>
                <option value="first_purchase">Após primeira compra do referido</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quando é que o quem referiu recebe a recompensa</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Referrer reward */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '1.0625rem', fontWeight: 600 }}>Recompensa — Quem Refere</h2>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Tipo de recompensa</label>
                <select className="input" value={config.referrerRewardType} onChange={e => setConfig(c => ({ ...c, referrerRewardType: e.target.value as any }))}>
                  <option value="discount_code">Código de desconto</option>
                  <option value="credit">Crédito de aula</option>
                </select>
              </div>

              {config.referrerRewardType === 'discount_code' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label">Tipo de desconto</label>
                    <select className="input" value={config.referrerDiscountType} onChange={e => setConfig(c => ({ ...c, referrerDiscountType: e.target.value as any }))}>
                      <option value="fixed">Valor fixo (€)</option>
                      <option value="percentage">Percentagem (%)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label">Valor {config.referrerDiscountType === 'percentage' ? '(%)' : '(€)'}</label>
                    <input className="input" type="number" min="0" step="0.01" value={config.referrerRewardValue} onChange={e => setConfig(c => ({ ...c, referrerRewardValue: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              )}

              {config.referrerRewardType === 'credit' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="label">Número de aulas de crédito</label>
                  <input className="input" type="number" min="1" step="1" value={config.referrerRewardValue} onChange={e => setConfig(c => ({ ...c, referrerRewardValue: parseInt(e.target.value) || 1 }))} />
                </div>
              )}
            </div>

            {/* Referred discount */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '1.0625rem', fontWeight: 600 }}>Desconto — Novo Utilizador</h2>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={config.referredEnabled} onChange={e => setConfig(c => ({ ...c, referredEnabled: e.target.checked }))} />
                  Ativo
                </label>
              </div>

              {config.referredEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label">Tipo de desconto</label>
                    <select className="input" value={config.referredDiscountType} onChange={e => setConfig(c => ({ ...c, referredDiscountType: e.target.value as any }))}>
                      <option value="percentage">Percentagem (%)</option>
                      <option value="fixed">Valor fixo (€)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label">Valor {config.referredDiscountType === 'percentage' ? '(%)' : '(€)'}</label>
                    <input className="input" type="number" min="0" step="0.01" value={config.referredDiscountValue} onChange={e => setConfig(c => ({ ...c, referredDiscountValue: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              )}
              {config.referredEnabled && (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  O novo utilizador recebe um código de desconto pessoal para a primeira compra.
                </p>
              )}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSaveConfig} disabled={savingConfig} style={{ minWidth: 160 }}>
              {savingConfig ? <><div className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} /> A guardar...</> : savedOk ? <><CheckCircle size={16} /> Guardado!</> : <><Save size={16} /> Guardar Configuração</>}
            </button>
          </div>
        </div>
      ) : (
        /* Referrals list */
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: `Todos (${counts.all})` },
              { label: `Pendentes (${counts.pending})`, color: '#92400e', bg: '#fef3c7' },
              { label: `Recompensados (${counts.rewarded})`, color: '#166534', bg: '#dcfce7' },
            ].map(s => (
              <span key={s.label} style={{ padding: '0.25rem 0.875rem', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 500, color: s.color || 'var(--text-secondary)', background: s.bg || 'white', border: '1px solid var(--sand)' }}>{s.label}</span>
            ))}
          </div>
          {referrals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-xl)', color: 'var(--text-secondary)' }}>Nenhuma referência ainda</div>
          ) : (
            <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--sand)', background: 'var(--beige)' }}>
                    {['Quem Referiu', 'Código', 'Novo Utilizador', 'Estado', 'Gatilho', 'Data'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referrals.map(r => {
                    const s = STATUS_LABELS[r.status];
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--sand)' }}>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{r.referrerName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.referrerEmail}</div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem' }}>{r.referrerCode}</td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{r.referredName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.referredEmail}</div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          {r.trigger === 'signup' ? 'Registo' : '1ª Compra'}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {r.createdAt?.toLocaleDateString('pt-PT') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        .tabs-bar { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); width: fit-content; }
        .tab { background: none; border: none; padding: 0.5rem 1.25rem; font-family: var(--font-body); font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all 0.15s; display: flex; align-items: center; gap: 0.375rem; }
        .tab.active { background: var(--primary); color: white; }
        @media (max-width: 768px) { div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
