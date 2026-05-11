import React, { useEffect, useState } from 'react';
import { getSiteConfig, updateSiteConfig } from '../../services/siteConfig';
import { LOYALTY_PRESETS } from '../../services/loyaltyPresets';
import { SiteConfig, PracticeSection, LoyaltyConfig, LoyaltyTheme, LoyaltyLevel } from '../../types';
import { Save, Loader, CheckCircle, Plus, X, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { ImageUpload } from '../../components/ImageUpload';

export function AdminSiteSettings() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'hero' | 'about' | 'practices' | 'services' | 'testimonials' | 'contact' | 'success' | 'seo' | 'rules' | 'payments' | 'zoom' | 'gamification'>('hero');
  const [expandedPractice, setExpandedPractice] = useState<number | null>(0);

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
    { id: 'practices', label: 'Práticas' },
    { id: 'services', label: 'Secção Serviços' },
    { id: 'testimonials', label: 'Secção Testemunhos' },
    { id: 'contact', label: 'Contacto' },
    { id: 'success', label: 'Pós-Pagamento' },
    { id: 'seo', label: 'SEO / Branding' },
    { id: 'rules', label: 'Regras de Aulas' },
    { id: 'gamification', label: 'Gamificação' },
    { id: 'payments', label: 'Pagamentos' },
    { id: 'zoom', label: 'Zoom' },
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingBottom: '1.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--sand)' }}>
              <div className="form-group">
                <label className="label">Nome do Site (Navbar)</label>
                <input className="input" value={config.siteName} onChange={e => updateField('siteName', e.target.value)} placeholder="JOY" />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Aparece em destaque no canto superior esquerdo.</span>
              </div>
              <div className="form-group">
                <label className="label">Subtítulo do Site (Navbar)</label>
                <input className="input" value={config.tagline} onChange={e => updateField('tagline', e.target.value)} placeholder="Joaquim Oliveira Yoga" />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Texto mais pequeno debaixo do nome.</span>
              </div>
            </div>
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

        {/* PRÁTICAS */}
        {activeTab === 'practices' && (() => {
          const practices: PracticeSection[] = config.practices && config.practices.length > 0
            ? config.practices
            : [{ label: config.vinyasaLabel, title: config.vinyasaTitle, text: config.vinyasaText, benefits: [...config.vinyasaBenefits] }];

          const updatePractice = (idx: number, field: keyof PracticeSection, value: any) => {
            const updated = practices.map((p, i) => i === idx ? { ...p, [field]: value } : p);
            setConfig({ ...config, practices: updated });
          };

          const updateBenefit = (pIdx: number, bIdx: number, value: string) => {
            const updated = practices.map((p, i) => {
              if (i !== pIdx) return p;
              const benefits = [...p.benefits];
              benefits[bIdx] = value;
              return { ...p, benefits };
            });
            setConfig({ ...config, practices: updated });
          };

          const addBenefit = (pIdx: number) => {
            const updated = practices.map((p, i) => i === pIdx ? { ...p, benefits: [...p.benefits, ''] } : p);
            setConfig({ ...config, practices: updated });
          };

          const removeBenefit = (pIdx: number, bIdx: number) => {
            const updated = practices.map((p, i) => i === pIdx ? { ...p, benefits: p.benefits.filter((_, j) => j !== bIdx) } : p);
            setConfig({ ...config, practices: updated });
          };

          const addPractice = () => {
            const updated = [...practices, { label: 'A Prática', title: 'Porquê …?', text: '', benefits: [] }];
            setConfig({ ...config, practices: updated });
            setExpandedPractice(updated.length - 1);
          };

          const removePractice = (idx: number) => {
            if (!confirm('Remover esta prática?')) return;
            const updated = practices.filter((_, i) => i !== idx);
            setConfig({ ...config, practices: updated });
            setExpandedPractice(null);
          };

          return (
            <>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Cada prática cria uma secção na landing page. Adiciona quantas quiseres — Vinyasa, Hatha, Yin, etc.
              </p>
              {practices.map((p, idx) => (
                <div key={idx} style={{ border: '1.5px solid var(--sand)', borderRadius: 'var(--radius-xl)', marginBottom: '0.75rem', overflow: 'hidden' }}>
                  <button
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', background: expandedPractice === idx ? 'rgba(124,154,114,0.07)' : 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-heading)' }}
                    onClick={() => setExpandedPractice(expandedPractice === idx ? null : idx)}
                  >
                    <span>{p.title || `Prática ${idx + 1}`}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button type="button" onClick={e => { e.stopPropagation(); removePractice(idx); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '0.125rem', display: 'flex' }}><X size={16} /></button>
                      {expandedPractice === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {expandedPractice === idx && (
                    <div style={{ padding: '1.25rem', borderTop: '1px solid var(--sand)', background: 'white' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="label">Etiqueta da Secção</label>
                          <input className="input" value={p.label} onChange={e => updatePractice(idx, 'label', e.target.value)} placeholder="A Prática" />
                        </div>
                        <div className="form-group">
                          <label className="label">Título</label>
                          <input className="input" value={p.title} onChange={e => updatePractice(idx, 'title', e.target.value)} placeholder="Porquê Hatha Yoga?" />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="label">Texto introdutório</label>
                        <textarea className="input textarea" rows={3} value={p.text} onChange={e => updatePractice(idx, 'text', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="label">Benefícios</label>
                        {p.benefits.map((b, bIdx) => (
                          <div key={bIdx} className="array-item">
                            <input className="input" value={b} onChange={e => updateBenefit(idx, bIdx, e.target.value)} />
                            <button className="btn-icon" onClick={() => removeBenefit(idx, bIdx)}><X size={16} /></button>
                          </div>
                        ))}
                        <button className="btn btn-sm btn-secondary" onClick={() => addBenefit(idx)}><Plus size={16} /> Adicionar benefício</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button className="btn btn-primary" onClick={addPractice} style={{ marginTop: '0.5rem' }}>
                <Plus size={16} /> Nova prática
              </button>
            </>
          );
        })()}

        {/* SERVICES SECTION */}
        {activeTab === 'services' && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Textos que aparecem na secção de serviços da landing page. Os serviços em si são geridos em "Serviços / Preços".</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Etiqueta da Secção</label>
                <input className="input" value={config.servicesLabel} onChange={e => updateField('servicesLabel', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Título</label>
                <input className="input" value={config.servicesTitle} onChange={e => updateField('servicesTitle', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Subtítulo geral</label>
              <textarea className="input textarea" rows={2} value={config.servicesSubtitle} onChange={e => updateField('servicesSubtitle', e.target.value)} />
            </div>
            <div style={{ borderTop: '1px solid var(--sand)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '1rem' }}>Subsecção — Aulas Avulsas</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Título</label>
                  <input className="input" value={config.servicesDropinTitle || ''} onChange={e => updateField('servicesDropinTitle', e.target.value)} placeholder="Aulas Avulsas" />
                </div>
                <div className="form-group">
                  <label className="label">Descrição</label>
                  <input className="input" value={config.servicesDropinSubtitle || ''} onChange={e => updateField('servicesDropinSubtitle', e.target.value)} placeholder="Paga apenas o que usas, sem compromisso." />
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--sand)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '1rem' }}>Subsecção — Pacotes / Planos</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Título</label>
                  <input className="input" value={config.servicesPlansTitle || ''} onChange={e => updateField('servicesPlansTitle', e.target.value)} placeholder="Pacotes de Aulas" />
                </div>
                <div className="form-group">
                  <label className="label">Descrição</label>
                  <input className="input" value={config.servicesPlansSubtitle || ''} onChange={e => updateField('servicesPlansSubtitle', e.target.value)} placeholder="Poupa ao comprar um conjunto de aulas. Sem mensalidade, sem fidelização." />
                </div>
              </div>
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

        {/* PÓS-PAGAMENTO (Página de Sucesso) */}
        {activeTab === 'success' && (
          <>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Texto mostrado ao cliente depois de um pagamento concluído com sucesso.
            </p>
            <div className="form-group">
              <label className="label">Título</label>
              <input className="input" value={config.paymentSuccessTitle || ''} onChange={e => updateField('paymentSuccessTitle', e.target.value)} placeholder="Pagamento Confirmado!" />
            </div>
            <div className="form-group">
              <label className="label">Subtítulo</label>
              <input className="input" value={config.paymentSuccessSubtitle || ''} onChange={e => updateField('paymentSuccessSubtitle', e.target.value)} placeholder="O teu pagamento foi processado com sucesso." />
            </div>
            <div className="form-group">
              <label className="label">Título da Lista de Próximos Passos</label>
              <input className="input" value={config.paymentSuccessStepsTitle || ''} onChange={e => updateField('paymentSuccessStepsTitle', e.target.value)} placeholder="Próximos Passos" />
            </div>
            <div className="form-group">
              <label className="label">Próximos Passos (lista)</label>
              {(config.paymentSuccessSteps || []).map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    className="input"
                    value={step}
                    onChange={e => {
                      const arr = [...(config.paymentSuccessSteps || [])];
                      arr[i] = e.target.value;
                      updateField('paymentSuccessSteps', arr);
                    }}
                  />
                  <button
                    className="btn-icon"
                    onClick={() => updateField('paymentSuccessSteps', (config.paymentSuccessSteps || []).filter((_, idx) => idx !== i))}
                  ><X size={16} /></button>
                </div>
              ))}
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => updateField('paymentSuccessSteps', [...(config.paymentSuccessSteps || []), ''])}
              ><Plus size={16} /> Adicionar passo</button>
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

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--beige)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-body)', fontSize: '1rem' }}>Dados Legais</h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Usados nas páginas de Política de Privacidade e Termos. Necessário por RGPD.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Nome legal da empresa</label>
                  <input className="input" value={config.legalCompanyName || ''} onChange={e => updateField('legalCompanyName', e.target.value)} placeholder="Ex: Joaquim Oliveira, Unipessoal Lda" />
                </div>
                <div className="form-group">
                  <label className="label">NIF / NIPC</label>
                  <input className="input" value={config.legalNif || ''} onChange={e => updateField('legalNif', e.target.value)} placeholder="Ex: 500123456" />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Morada legal</label>
                <input className="input" value={config.legalAddress || ''} onChange={e => updateField('legalAddress', e.target.value)} placeholder="Rua, número, código postal, cidade" />
              </div>
              <div className="form-group">
                <label className="label">Data da última atualização (YYYY-MM-DD)</label>
                <input className="input" value={config.legalLastUpdate || ''} onChange={e => updateField('legalLastUpdate', e.target.value)} placeholder="2026-04-26" style={{ maxWidth: 200 }} />
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
              <label className="label">Validade da aula avulsa (dias)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input className="input" type="number" min="1" value={config.dropinValidityDays ?? 15} onChange={e => updateField('dropinValidityDays', Number(e.target.value))} style={{ width: 100 }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>dias após compra</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                Tempo para usar uma aula avulsa desde a data de compra. Se cancelada dentro do prazo, o crédito é válido pelo tempo restante desta janela.
              </span>
            </div>

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="label">Extensão de validade quando admin/professor cancela aula</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input className="input" type="number" min="0" value={config.cancellationGracePeriodDays ?? 7} onChange={e => updateField('cancellationGracePeriodDays', Number(e.target.value))} style={{ width: 100 }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>dias adicionados ao plano</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                Quando o admin/professor cancela uma aula, cada aluno inscrito recebe a sessão de volta + esta extensão de validade no seu plano/aula avulsa, para garantir que tem tempo para a usar.
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
                <li>Aula de plano cancelada → volta ao plano com a validade original</li>
                <li>Aula avulsa válida por <strong>{config.dropinValidityDays ?? 15} dias</strong> desde a compra</li>
                <li>Quando o admin/professor cancela: aulas devolvidas e plano estendido por <strong>{config.cancellationGracePeriodDays ?? 7} dias</strong></li>
              </ul>
            </div>
          </>
        )}

        {/* GAMIFICATION */}
        {activeTab === 'gamification' && (() => {
          const loyalty: LoyaltyConfig = config.loyalty || { enabled: false, theme: 'chakras', levels: [] };
          const setLoyalty = (l: LoyaltyConfig) => updateField('loyalty', l);
          const applyPreset = (theme: LoyaltyTheme) => {
            if (theme === 'custom') {
              setLoyalty({ ...loyalty, theme: 'custom', levels: [] });
            } else {
              const preset = LOYALTY_PRESETS[theme];
              setLoyalty({ ...loyalty, theme, levels: JSON.parse(JSON.stringify(preset.levels)) });
            }
          };
          const updateLevel = (i: number, patch: Partial<LoyaltyLevel>) => {
            const next = [...loyalty.levels];
            next[i] = { ...next[i], ...patch };
            setLoyalty({ ...loyalty, levels: next });
          };
          const addLevel = () => {
            const last = loyalty.levels[loyalty.levels.length - 1];
            const next: LoyaltyLevel = {
              name: `Novo nível ${loyalty.levels.length + 1}`,
              threshold: last ? last.threshold + 10 : 0,
              color: '#7c9a72',
              icon: '🌟',
              description: '',
              motivation: '',
            };
            setLoyalty({ ...loyalty, levels: [...loyalty.levels, next] });
          };
          const removeLevel = (i: number) => setLoyalty({ ...loyalty, levels: loyalty.levels.filter((_, idx) => idx !== i) });

          return (
            <>
              <div className="rules-info-box">
                Programa de fidelidade — alunos progridem por nível conforme acumulam presenças. Sobe de nível celebrado com toast e mostrado no dashboard / página de conquistas.
              </div>

              <div className="form-group">
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={loyalty.enabled} onChange={e => setLoyalty({ ...loyalty, enabled: e.target.checked })} />
                  <strong>Ativar programa de fidelidade</strong>
                </label>
              </div>

              {loyalty.enabled && (
                <>
                  <div style={{ marginTop: '1rem' }}>
                    <label className="label">Tema</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.625rem', marginTop: '0.5rem' }}>
                      {(Object.keys(LOYALTY_PRESETS) as Array<keyof typeof LOYALTY_PRESETS>).map(key => {
                        const preset = LOYALTY_PRESETS[key];
                        const active = loyalty.theme === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => applyPreset(key)}
                            style={{
                              background: active ? 'var(--primary-gradient)' : 'white',
                              color: active ? 'white' : 'var(--text-primary)',
                              border: `2px solid ${active ? 'transparent' : 'var(--sand)'}`,
                              borderRadius: 'var(--radius-lg)',
                              padding: '0.875rem 0.75rem',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            <div style={{ fontSize: '1.5rem' }}>{preset.icon}</div>
                            <div style={{ fontWeight: 700, marginTop: '0.25rem', fontSize: '0.9375rem' }}>{preset.label}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.125rem', lineHeight: 1.3 }}>{preset.description}</div>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => applyPreset('custom')}
                        style={{
                          background: loyalty.theme === 'custom' ? 'var(--primary-gradient)' : 'white',
                          color: loyalty.theme === 'custom' ? 'white' : 'var(--text-primary)',
                          border: `2px solid ${loyalty.theme === 'custom' ? 'transparent' : 'var(--sand)'}`,
                          borderRadius: 'var(--radius-lg)',
                          padding: '0.875rem 0.75rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ fontSize: '1.5rem' }}>🌱</div>
                        <div style={{ fontWeight: 700, marginTop: '0.25rem', fontSize: '0.9375rem' }}>Personalizado</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.125rem' }}>Cria os teus próprios níveis</div>
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Escolher um preset substitui os níveis atuais com os defaults desse tema. Podes editar tudo depois.
                    </p>
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                      <h4 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '1rem' }}><Trophy size={16} style={{ display: 'inline', marginRight: 6 }} /> Níveis ({loyalty.levels.length})</h4>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={addLevel}><Plus size={14} /> Adicionar nível</button>
                    </div>
                    {loyalty.levels.length === 0 && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Sem níveis. Escolhe um preset acima ou adiciona à mão.</p>
                    )}
                    {loyalty.levels.map((lvl, i) => (
                      <div key={i} style={{ background: 'white', border: '1px solid var(--sand)', borderRadius: 'var(--radius-lg)', padding: '0.875rem 1rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                          <span style={{ width: 28, height: 28, borderRadius: '50%', background: lvl.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }}>{lvl.icon || ''}</span>
                          <strong style={{ flex: 1 }}>Nível {i + 1}</strong>
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => removeLevel(i)} style={{ color: 'var(--error)' }}><X size={14} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 100px 80px', gap: '0.5rem' }}>
                          <input className="input" placeholder="Nome" value={lvl.name} onChange={e => updateLevel(i, { name: e.target.value })} />
                          <input className="input" placeholder="Ícone (emoji)" value={lvl.icon || ''} onChange={e => updateLevel(i, { icon: e.target.value })} />
                          <input className="input" type="number" placeholder="Aulas" value={lvl.threshold} onChange={e => updateLevel(i, { threshold: Number(e.target.value) || 0 })} title="Presenças necessárias" />
                          <input type="color" value={lvl.color} onChange={e => updateLevel(i, { color: e.target.value })} style={{ width: '100%', height: 38, border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md)' }} />
                        </div>
                        <input className="input" placeholder="Descrição (curta)" value={lvl.description || ''} onChange={e => updateLevel(i, { description: e.target.value })} style={{ marginTop: '0.5rem' }} />
                        <input className="input" placeholder="Mensagem motivacional ao subir" value={lvl.motivation || ''} onChange={e => updateLevel(i, { motivation: e.target.value })} style={{ marginTop: '0.375rem' }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })()}

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
                https://europe-west1-realrateme-731f1.cloudfunctions.net/eupagoWebhook
              </div>
            </div>

            <div className="rules-preview" style={{ marginTop: '0.75rem' }}>
              <strong>Como funciona o pagamento:</strong>
              <ul>
                <li>O cliente <strong>compra manualmente</strong> — sem débitos automáticos</li>
                <li><strong>Aula avulsa:</strong> paga → recebe 1 crédito de aula</li>
                <li><strong>Pack mensal:</strong> paga → ativa X aulas com validade de 1 mês</li>
                <li>Se cancelar aula de plano dentro do prazo → volta ao plano (validade original do plano)</li>
                <li>Se cancelar aula avulsa dentro do prazo → crédito válido pelo tempo restante dos {config.dropinValidityDays ?? 15} dias desde a compra</li>
              </ul>
            </div>
          </>
        )}

        {/* ZOOM */}
        {activeTab === 'zoom' && (
          <>
            <div className="rules-info-box">
              Credenciais da conta Zoom para geração automática de links de reunião nas aulas híbridas.
              Obtém estas credenciais em <strong>marketplace.zoom.us → Develop → Build App → Server-to-Server OAuth</strong>.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Account ID</label>
                <input className="input" value={(config as any).zoomAccountId ?? ''} onChange={e => updateField('zoomAccountId' as any, e.target.value)} placeholder="IBAxS1qxRw6M6LegyaTGkg" />
              </div>
              <div className="form-group">
                <label className="label">Client ID</label>
                <input className="input" value={(config as any).zoomClientId ?? ''} onChange={e => updateField('zoomClientId' as any, e.target.value)} placeholder="_ratfV65SgSYbJglhNHYJQ" />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Client Secret</label>
              <input className="input" type="password" value={(config as any).zoomClientSecret ?? ''} onChange={e => updateField('zoomClientSecret' as any, e.target.value)} placeholder="••••••••••••••••••••••••••••••••" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                Guardado de forma segura no Firestore (acesso apenas a admins e Cloud Functions).
              </span>
            </div>

            {(config as any).zoomAccountId && (
              <div className="rules-preview" style={{ background: 'rgba(124,154,114,0.08)', border: '1px solid rgba(124,154,114,0.3)' }}>
                ✓ Zoom configurado. As aulas híbridas irão gerar links automaticamente.
              </div>
            )}
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
