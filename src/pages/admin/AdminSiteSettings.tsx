import React, { useEffect, useState } from 'react';
import { getSiteConfig, updateSiteConfig } from '../../services/siteConfig';
import { SiteConfig } from '../../types';
import { Save, Loader, CheckCircle, Plus, X } from 'lucide-react';

export function AdminSiteSettings() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'hero' | 'about' | 'vinyasa' | 'contact' | 'seo'>('hero');

  useEffect(() => {
    loadConfig();
  }, []);

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
    } catch (err) {
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
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
    { id: 'contact', label: 'Contacto' },
    { id: 'seo', label: 'SEO / Branding' },
  ] as const;

  return (
    <div>
      {/* Save bar */}
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
        {/* HERO TAB */}
        {activeTab === 'hero' && (
          <>
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
                <label className="label">Texto do Botão CTA</label>
                <input className="input" value={config.heroCtaText} onChange={e => updateField('heroCtaText', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Link do CTA</label>
                <input className="input" value={config.heroCtaLink} onChange={e => updateField('heroCtaLink', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">URL Imagem Hero (opcional)</label>
              <input className="input" value={config.heroImage || ''} onChange={e => updateField('heroImage', e.target.value)} placeholder="https://..." />
            </div>
          </>
        )}

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <>
            <div className="form-group">
              <label className="label">Título</label>
              <input className="input" value={config.aboutTitle} onChange={e => updateField('aboutTitle', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Texto (usa linhas em branco para parágrafos)</label>
              <textarea className="input textarea" rows={8} value={config.aboutText} onChange={e => updateField('aboutText', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">URL Foto (opcional)</label>
              <input className="input" value={config.aboutImage || ''} onChange={e => updateField('aboutImage', e.target.value)} placeholder="https://..." />
            </div>
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

        {/* VINYASA TAB */}
        {activeTab === 'vinyasa' && (
          <>
            <div className="form-group">
              <label className="label">Título</label>
              <input className="input" value={config.vinyasaTitle} onChange={e => updateField('vinyasaTitle', e.target.value)} />
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

        {/* CONTACT TAB */}
        {activeTab === 'contact' && (
          <>
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
                <input className="input" value={config.instagram || ''} onChange={e => updateField('instagram', e.target.value)} placeholder="username" />
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

        {/* SEO TAB */}
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
      </div>

      <style>{`
        .save-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
        .tabs { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); }
        .tab { background: none; border: none; padding: 0.5rem 1rem; font-family: var(--font-body); font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .tab.active { background: var(--primary); color: white; }
        .tab:hover:not(.active) { background: var(--beige); }
        .settings-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-sm); }
        .array-item { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
        .array-item .input { flex: 1; }
        .btn-icon { background: none; border: 1px solid var(--sand); border-radius: var(--radius-md); padding: 0.5rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; transition: all var(--transition-fast); }
        .btn-icon:hover { border-color: var(--error); color: var(--error); }

        @media (max-width: 768px) {
          .tabs { overflow-x: auto; }
          .settings-card { padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
