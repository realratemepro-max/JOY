import React, { useEffect, useState } from 'react';
import { getSiteConfig, updateSiteConfig } from '../../services/siteConfig';
import { SiteConfig } from '../../types';
import { Save, Loader, CheckCircle, Plus, X } from 'lucide-react';
import { ImageUpload } from '../../components/ImageUpload';

export function AdminSiteSettings() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'hero' | 'about' | 'vinyasa' | 'services' | 'testimonials' | 'contact' | 'seo' | 'rules' | 'payments'>('hero');

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    const data = await getSiteConfig();
    setConfig(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      await updateSiteConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error('Error saving:', err); }
    finally { setSaving(false); }
  };

  const updateField = (field: keyof SiteConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  const updateArrayItem = (field: 'aboutHighlights' | 'vinyasaBenefits', index: number, value: string) => {
    if (!config) return;
    const arr = [...config[field]];
    arr[index] = value;
    setConfig({ ...config, [field]: arr });
  };

  const addArrayItem = (field: 'aboutHighlights' | 'vinyasaBenefits') => {
    if (!config) return;
    setConfig({ ...config, [field]: [...config[field], ''] });
  };

  const removeArrayItem = (field: 'aboutHighlights' | 'vinyasaBenefits', index: number) => {
    if (!config) return;
    setConfig({ ...config, [field]: config[field].filter((_, i) => i !== index) });
  };

  if (loading || !config) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;
  }

  const tabs = [
    { id: 'hero', label: 'Hero' },
    { id: 'about', label: 'Sobre' },
    { id: 'vinyasa', label: 'Vinyasa' },
    { id: 'services', label: 'Secção Serviços' },
    { id: 'testimonials', label: 'Secção Testemunhos' },
    { id: 'contact', label: 'Contacto' },
    { id: 'seo', label: 'SEO / Branding' },
    { id: 'rules', label: 'Regras de Aulas' },
    { id: 'payments', label: 'Pagamentos' },
  ] as const;

  return (
    <div>
      <div className="save-bar">
        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <><CheckCircle size={18} /> Guardado!</> : <><Save size={18} /> Guardar</>}
        </button>
      </div>

      <div className="settings-card">
        {/* HERO */}
        {activeTab === 'hero' && (
          <>
            <div className="form-group">
              <label className="label">Badge (texto pequeno sobre o título)</label>
              <input className="input" value={config.heroBadge} onChange={e => updateField('heroBadge', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Título Hero</label>
              <input className="input" value={config.heroTitle} onChange={e => updateField('heroTitle', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Subtítulo Hero</label>
              <textarea className="input textarea" rows={3} value={config.heroSubtitle} onChange={e => updateField('heroSubtitle', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Texto do Botão Principal</label>
                <input className="input" value={config.heroCtaText} onChange={e => updateField('heroCtaText', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Link do Botão Principal</label>
                <input className="input" value={config.heroCtaLink} onChange={e => updateField('heroCtaLink', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Texto do Botão Secundário</label>
              <input className="input" value={config.heroSecondaryText} onChange={e => updateField('heroSecondaryText', e.target.value)} />
            </div>
            <ImageUpload value={config.heroImage || ''} onChange={url => updateField('heroImage', url)} folder="site" label="Imagem de Fundo do Hero" />
          </>
        )}

        {/* ABOUT */}
        {activeTab === 'about' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Etiqueta da Secção</label>
                <input className="input" value={config.aboutLabel} onChange={e => updateField('aboutLabel', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Título</label>
                <input className="input" value={config.aboutTitle} onChange={e => updateField('aboutTitle', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Texto (usa linhas em branco para parágrafos)</label>
              <textarea className="input textarea" rows={8} value={config.aboutText} onChange={e => updateField('aboutText', e.target.value)} />
            </div>
            <ImageUpload value={config.aboutImage || ''} onChange={url => updateField('aboutImage', url)} folder="site" label="Foto do Sobre" />
            <div className="form-group">
              <label className="label">Destaques</label>
              {config.aboutHighlights.map((h, i) => (
                <div key={i} className="array-item">
                  <input className="input" value={h} onChange={e => updateArrayItem('aboutHighlights', i, e.target.value)} />
                  <button className="btn-icon" onClick={() => removeArrayItem('aboutHighlights', i)}><X size={16} /></button>
                </div>
              ))}
              <button className="btn btn-sm btn-secondary" onClick={() => addArrayItem('aboutHighlights')}><Plus size={16} /> Adicionar</button>
            </div>
          </>
        )}

        {/* VINYASA */}
        {activeTab === 'vinyasa' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Etiqueta da Secção</label>
                <input className="input" value={config.vinyasaLabel} onChange={e => updateField('vinyasaLabel', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Título</label>
                <input className="input" value={config.vinyasaTitle} onChange={e => updateField('vinyasaTitle', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Texto introdutório</label>
              <textarea className="input textarea" rows={4} value={config.vinyasaText} onChange={e => updateField('vinyasaText', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Benefícios</label>
              {config.vinyasaBenefits.map((b, i) => (
                <div key={i} className="array-item">
                  <input className="input" value={b} onChange={e => updateArrayItem('vinyasaBenefits', i, e.target.value)} />
                  <button className="btn-icon" onClick={() => removeArrayItem('vinyasaBenefits', i)}><X size={16} /></button>
                </div>
              ))}
              <button className="btn btn-sm btn-secondary" onClick={() => addArrayItem('vinyasaBenefits')}><Plus size={16} /> Adicionar</button>
            </div>
          </>
        )}

        {/* SERVICES SECTION */}
        {activeTab === 'services' && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Textos que aparecem na secção de serviços da landing page. Os serviços em si são geridos em "Serviços / Preços".</p>
            <div className="form-group">
              <label className="label">Etiqueta da Secção</label>
              <input className="input" value={config.servicesLabel} onChange={e => updateField('servicesLabel', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Título</label>
              <input className="input" value={config.servicesTitle} onChange={e => updateField('servicesTitle', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Subtítulo</label>
              <textarea className="input textarea" rows={2} value={config.servicesSubtitle} onChange={e => updateField('servicesSubtitle', e.target.value)} />
            </div>
          </>
        )}

        {/* TESTIMONIALS SECTION */}
        {activeTab === 'testimonials' && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Textos que aparecem na secção de testemunhos. Os testemunhos em si são geridos em "Testemunhos".</p>
            <div className="form-group">
              <label className="label">Etiqueta da Secção</label>
              <input className="input" value={config.testimonialsLabel} onChange={e => updateField('testimonialsLabel', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Título</label>
              <input className="input" value={config.testimonialsTitle} onChange={e => updateField('testimonialsTitle', e.target.value)} />
            </div>
          </>
        )}

        {/* CONTACT */}
        {activeTab === 'contact' && (
          <>
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Textos da Secção</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Etiqueta</label>
                <input className="input" value={config.contactLabel} onChange={e => updateField('contactLabel', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Título</label>
                <input className="input" value={config.contactTitle} onChange={e => updateField('contactTitle', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Subtítulo</label>
              <textarea className="input textarea" rows={2} value={config.contactSubtitle} onChange={e => updateField('contactSubtitle', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Título do Card CTA</label>
                <input className="input" value={config.contactCtaTitle} onChange={e => updateField('contactCtaTitle', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Texto do Card CTA</label>
                <input className="input" value={config.contactCtaText} onChange={e => updateField('contactCtaText', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Botão Email</label>
                <input className="input" value={config.contactEmailButton} onChange={e => updateField('contactEmailButton', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Botão Telefone</label>
                <input className="input" value={config.contactPhoneButton} onChange={e => updateField('contactPhoneButton', e.target.value)} />
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--beige)', margin: '2rem 0' }} />
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Dados de Contacto</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Email</label>
                <input className="input" value={config.email} onChange={e => updateField('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Telefone</label>
                <input className="input" value={config.phone} onChange={e => updateField('phone', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Instagram (username)</label>
                <input className="input" value={config.instagram || ''} onChange={e => updateField('instagram', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Facebook (username)</label>
                <input className="input" value={config.facebook || ''} onChange={e => updateField('facebook', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">YouTube (channel)</label>
                <input className="input" value={config.youtube || ''} onChange={e => updateField('youtube', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Localização</label>
                <input className="input" value={config.location || ''} onChange={e => updateField('location', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Texto do Footer</label>
              <input className="input" value={config.footerText} onChange={e => updateField('footerText', e.target.value)} />
            </div>
          </>
        )}

        {/* SEO / BRANDING */}
        {activeTab === 'seo' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Nome do Site</label>
                <input className="input" value={config.siteName} onChange={e => updateField('siteName', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Tagline</label>
                <input className="input" value={config.tagline} onChange={e => updateField('tagline', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <ImageUpload value={config.logo || ''} onChange={url => updateField('logo', url)} folder="site" label="Logo" />
              <ImageUpload value={config.favicon || ''} onChange={url => updateField('favicon', url)} folder="site" label="Favicon" />
            </div>
            <div className="form-group">
              <label className="label">Meta Title (SEO)</label>
              <input className="input" value={config.metaTitle} onChange={e => updateField('metaTitle', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Meta Description (SEO)</label>
              <textarea className="input textarea" rows={3} value={config.metaDescription} onChange={e => updateField('metaDescription', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Cor Primária</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={config.primaryColor} onChange={e => updateField('primaryColor', e.target.value)} style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }} />
                  <input className="input" value={config.primaryColor} onChange={e => updateField('primaryColor', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Cor Secundária</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={config.secondaryColor} onChange={e => updateField('secondaryColor', e.target.value)} style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }} />
                  <input className="input" value={config.secondaryColor} onChange={e => updateField('secondaryColor', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Cor Accent</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={config.accentColor} onChange={e => updateField('accentColor', e.target.value)} style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }} />
                  <input className="input" value={config.accentColor} onChange={e => updateField('accentColor', e.target.value)} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* BUSINESS RULES */}
        {activeTab === 'rules' && (
          <>
            <div className="rules-info-box">
              Estas regras controlam quando os clientes podem marcar e cancelar aulas no portal.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Antecedência mínima para marcar (horas)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input className="input" type="number" min="0" step="1" value={config.bookingMinHoursBefore ?? 24} onChange={e => updateField('bookingMinHoursBefore', Number(e.target.value))} style={{ width: 100 }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>horas antes</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Ex: 24h → o cliente pode marcar até 24h antes da aula começar.
                </span>
              </div>
              <div className="form-group">
                <label className="label">Limite para cancelar (horas)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input className="input" type="number" min="0" step="1" value={config.cancelLimitHoursBefore ?? 2} onChange={e => updateField('cancelLimitHoursBefore', Number(e.target.value))} style={{ width: 100 }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>horas antes</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Ex: 2h → o cliente pode cancelar até 2h antes da aula.
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
              <div className="form-group">
                <label className="label">Cancelamento dentro do prazo</label>
                <select className="input" value={config.cancelRefundPolicy ?? 'credit'} onChange={e => updateField('cancelRefundPolicy', e.target.value)}>
                  <option value="credit">Gera crédito para usar noutra aula</option>
                  <option value="refund">Devolução do valor pago</option>
                  <option value="none">Sem compensação</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  O que acontece quando o cliente cancela dentro do prazo permitido.
                </span>
              </div>
              <div className="form-group">
                <label className="label">Cancelamento fora do prazo</label>
                <select className="input" value={config.lateCancelPenalty ?? 'no_refund'} onChange={e => updateField('lateCancelPenalty', e.target.value)}>
                  <option value="no_refund">Sem devolução (perde a aula)</option>
                  <option value="half_credit">Metade do crédito</option>
                  <option value="none">Mesma política (sem penalidade)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  O que acontece quando cancela depois do prazo limite.
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="label">Validade do crédito (dias)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input className="input" type="number" min="1" value={config.creditValidityDays ?? 30} onChange={e => updateField('creditValidityDays', Number(e.target.value))} style={{ width: 100 }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>dias</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                Tempo que o cliente tem para usar o crédito após cancelamento. Depois caduca.
              </span>
            </div>

            <div className="rules-preview">
              <strong>Resumo das regras:</strong>
              <ul>
                <li>Marcar aulas até <strong>{config.bookingMinHoursBefore ?? 24}h</strong> antes</li>
                <li>Cancelar até <strong>{config.cancelLimitHoursBefore ?? 2}h</strong> antes — {
                  config.cancelRefundPolicy === 'credit' ? 'recebem crédito' :
                  config.cancelRefundPolicy === 'refund' ? 'recebem devolução' : 'sem compensação'
                }</li>
                <li>Cancelamento tardio — {
                  config.lateCancelPenalty === 'no_refund' ? 'perde a aula' :
                  config.lateCancelPenalty === 'half_credit' ? 'metade do crédito' : 'sem penalidade'
                }</li>
                <li>Créditos válidos por <strong>{config.creditValidityDays ?? 30} dias</strong></li>
              </ul>
            </div>
          </>
        )}

        {/* PAYMENT PROVIDER */}
        {activeTab === 'payments' && (
          <>
            <div className="rules-info-box">
              Configuração do fornecedor de pagamentos. Os dados são usados pelas Cloud Functions para processar pagamentos.
            </div>

            <div className="form-group">
              <label className="label">Fornecedor de Pagamentos</label>
              <select className="input" value={config.paymentProvider ?? 'eupago'} onChange={e => updateField('paymentProvider', e.target.value)} style={{ width: 200 }}>
                <option value="eupago">EuPago</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">API Key / Client ID</label>
                <input className="input" type="password" value={config.paymentApiKey ?? ''} onChange={e => updateField('paymentApiKey', e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx-xxxx" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Chave de API do EuPago (Client ID).
                </span>
              </div>
              <div className="form-group">
                <label className="label">URL Base da API</label>
                <input className="input" value={config.paymentApiBaseUrl ?? 'https://clientes.eupago.pt'} onChange={e => updateField('paymentApiBaseUrl', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Webhook Encryption Key (opcional)</label>
              <input className="input" type="password" value={config.paymentWebhookEncryptionKey ?? ''} onChange={e => updateField('paymentWebhookEncryptionKey', e.target.value)} placeholder="Chave de encriptação para Webhooks 2.0" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                Para Webhooks 2.0 encriptados. Deixar vazio se usar Webhooks 1.0.
              </span>
            </div>

            <div className="form-group">
              <label className="label">Métodos de Pagamento Ativos</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={config.paymentMethodsMbway !== false} onChange={e => updateField('paymentMethodsMbway', e.target.checked)} />
                  MB WAY
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={config.paymentMethodsMultibanco !== false} onChange={e => updateField('paymentMethodsMultibanco', e.target.checked)} />
                  Multibanco (Referência)
                </label>
              </div>
            </div>

            <div className="rules-preview" style={{ marginTop: '1rem' }}>
              <strong>URL do Webhook (configurar no painel EuPago):</strong>
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'white', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8125rem', wordBreak: 'break-all' }}>
                https://us-central1-realrateme-731f1.cloudfunctions.net/eupagoWebhook
              </div>
            </div>

            <div className="rules-preview" style={{ marginTop: '0.75rem' }}>
              <strong>Como funciona o pagamento:</strong>
              <ul>
                <li>O cliente <strong>compra manualmente</strong> — sem débitos automáticos</li>
                <li><strong>Aula avulsa:</strong> paga → recebe 1 crédito de aula</li>
                <li><strong>Pack mensal:</strong> paga → ativa X aulas com validade de 1 mês</li>
                <li>Se cancelar aula dentro do prazo → crédito válido por {config.creditValidityDays ?? 30} dias</li>
              </ul>
            </div>
          </>
        )}
      </div>

      <style>{`
        .save-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
        .tabs { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); overflow-x: auto; }
        .tab { background: none; border: none; padding: 0.5rem 0.75rem; font-family: var(--font-body); font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); white-space: nowrap; }
        .tab.active { background: var(--primary); color: white; }
        .tab:hover:not(.active) { background: var(--beige); }
        .settings-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-sm); }
        .array-item { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
        .array-item .input { flex: 1; }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.5rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; transition: all var(--transition-fast); }
        .btn-icon:hover { border-color: var(--error); color: var(--error); }

        .rules-info-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: var(--radius-lg); padding: 0.75rem 1rem; font-size: 0.875rem; color: #0369a1; margin-bottom: 1.25rem; }
        .rules-preview { background: var(--bg-secondary); border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-top: 1rem; font-size: 0.875rem; }
        .rules-preview ul { margin: 0.5rem 0 0; padding-left: 1.25rem; }
        .rules-preview li { margin-bottom: 0.375rem; color: var(--text-secondary); }

        @media (max-width: 768px) {
          .settings-card { padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
