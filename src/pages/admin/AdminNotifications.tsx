import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { NotificationConfig, NotificationSetting } from '../../types';
import { Save, Loader, CheckCircle, Mail, MessageCircle, Send, Bell, Eye, EyeOff } from 'lucide-react';

const DEFAULT_PROFESSOR_TEMPLATES: Record<string, string> = {
  session_booked: 'Olá {{professor}}!\n\n{{aluno}} inscreveu-se na tua aula:\n📅 {{data}}\n🕐 {{hora}} - {{horaFim}}\n📍 {{espaco}}',
  session_cancelled: 'Olá {{professor}}!\n\n{{aluno}} cancelou a inscrição na aula de {{data}} às {{hora}} em {{espaco}}.',
  session_reminder: 'Olá {{professor}}!\n\nLembrete: tens aula em {{horas}}h.\n📅 {{data}}\n🕐 {{hora}} - {{horaFim}}\n📍 {{espaco}}\n👥 Alunos inscritos: {{numAlunos}}',
};

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  plan_purchased: {
    subject: 'Bem-vindo à JOY Yoga! 🧘',
    body: `Olá {{nome}}!\n\nObrigado por comprares o plano "{{plano}}".\n\nTens {{sessoes}} aulas disponíveis até {{validade}}.\n\nPara marcares a tua aula:\n1. Acede ao portal em joaquimyoga.pt/app\n2. Vai a "Aulas" e escolhe o horário\n3. Confirma a marcação\n\nRegras:\n• Podes marcar até {{antecedencia}}h antes da aula\n• Cancelamento até {{cancelamento}}h antes sem penalização\n• Créditos de cancelamento válidos por {{creditoDias}} dias\n\nBoas práticas! 🙏`,
  },
  session_booked: {
    subject: 'Aula marcada ✅',
    body: `Olá {{nome}}!\n\nA tua aula está confirmada:\n📅 {{data}}\n🕐 {{hora}} - {{horaFim}}\n📍 {{espaco}}\n👤 Professor: {{professor}}\n\nAté lá! 🧘`,
  },
  session_cancelled: {
    subject: 'Aula cancelada',
    body: `Olá {{nome}}!\n\nA tua aula de {{data}} às {{hora}} foi cancelada.\n\n{{compensacao}}\n\nPodes remarcar a qualquer momento no portal.`,
  },
  session_reminder: {
    subject: 'Lembrete: aula daqui a {{horas}}h 🧘',
    body: `Olá {{nome}}!\n\nLembrete da tua aula:\n📅 {{data}}\n🕐 {{hora}} - {{horaFim}}\n📍 {{espaco}}\n👤 {{professor}}\n\nNão te esqueças de trazer a tua toalha e água. Até já! 🙏`,
  },
  plan_expiring: {
    subject: 'O teu plano expira em {{dias}} dias',
    body: `Olá {{nome}}!\n\nO teu plano "{{plano}}" expira em {{validade}}.\n\nTens {{sessoes}} aulas por usar.\n\nRenova o teu plano em joaquimyoga.pt para não perderes o ritmo! 🧘`,
  },
  session_cancelled_admin: {
    subject: 'Aula cancelada pelo estúdio',
    body: `Olá {{nome}}!\n\nA aula de {{data}} às {{hora}} em {{espaco}} foi cancelada.\nMotivo: {{motivo}}\n\n✓ A sessão foi devolvida ao teu plano\n✓ A validade foi estendida em {{diasExtra}} dias (até {{novaValidade}})\n\nPodes marcar outra aula a qualquer momento no portal.\n\nLamentamos o incómodo. 🙏`,
  },
  professor_substituted: {
    subject: 'Alteração de professor na tua aula',
    body: `Olá {{nome}}!\n\nA aula de {{data}} às {{hora}} terá um professor diferente:\n\n👤 Novo professor: {{novoProfessor}}\n(em vez de {{professorOriginal}})\n\nPodes aceitar a alteração ou cancelar a aula no portal.`,
  },
};

const DEFAULT_TRIGGERS: NotificationSetting[] = [
  { trigger: 'plan_purchased', label: 'Plano Comprado', description: 'Quando o cliente compra um plano. Mensagem de boas-vindas + como funciona.', channels: { email: true, whatsapp: true, telegram: false, app: true }, notifyStudent: true, notifyProfessor: false, template: DEFAULT_TEMPLATES.plan_purchased.body },
  { trigger: 'session_booked', label: 'Aula Marcada', description: 'Quando o cliente marca uma aula.', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: true, template: DEFAULT_TEMPLATES.session_booked.body, professorTemplate: DEFAULT_PROFESSOR_TEMPLATES.session_booked },
  { trigger: 'session_cancelled', label: 'Aula Cancelada (cliente)', description: 'Quando o cliente cancela a sua aula.', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: true, template: DEFAULT_TEMPLATES.session_cancelled.body, professorTemplate: DEFAULT_PROFESSOR_TEMPLATES.session_cancelled },
  { trigger: 'session_reminder', label: 'Lembrete de Aula', description: 'Aviso X horas antes da aula começar.', channels: { email: true, whatsapp: true, telegram: false, app: true }, notifyStudent: true, notifyProfessor: true, template: DEFAULT_TEMPLATES.session_reminder.body, professorTemplate: DEFAULT_PROFESSOR_TEMPLATES.session_reminder },
  { trigger: 'plan_expiring', label: 'Plano a Expirar', description: 'Aviso X dias antes do plano expirar.', channels: { email: true, whatsapp: true, telegram: false, app: true }, notifyStudent: true, notifyProfessor: false, template: DEFAULT_TEMPLATES.plan_expiring.body },
  { trigger: 'session_cancelled_admin', label: 'Aula Cancelada (admin)', description: 'Quando o admin cancela uma aula com alunos inscritos.', channels: { email: true, whatsapp: true, telegram: false, app: true }, notifyStudent: true, notifyProfessor: true, template: DEFAULT_TEMPLATES.session_cancelled_admin.body },
  { trigger: 'professor_substituted', label: 'Professor Substituído', description: 'Quando o professor é substituído numa aula.', channels: { email: true, whatsapp: true, telegram: false, app: true }, notifyStudent: true, notifyProfessor: false, template: DEFAULT_TEMPLATES.professor_substituted.body },
  { trigger: 'waitlist_promoted', label: 'Lista de Espera — Lugar Disponível', description: 'Quando um lugar fica disponível e o aluno sobe na lista de espera.', channels: { email: true, whatsapp: true, telegram: false, app: true }, notifyStudent: true, notifyProfessor: false, template: 'Olá {{nome}}!\n\nÉ a tua vez! Ficou um lugar disponível na aula:\n📅 {{data}}\n🕐 {{hora}}\n📍 {{espaco}}\n\nAcede ao portal para confirmar a tua inscrição. O lugar é reservado por 2 horas.' },
  { trigger: 'class_attended', label: 'Presença Confirmada', description: 'Enviado ao aluno quando o professor marca presença. Inclui total de presenças.', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: false, template: 'Olá {{nome}}!\n\nObrigado por estares presente na aula de hoje com {{professor}}! 🙏\n\nJá tens {{totalPresencas}} presenças registadas. Cada aula é um passo na tua jornada.\n\nAté à próxima! 🧘' },
];

const DEFAULT_CONFIG: NotificationConfig = {
  emailEnabled: true, emailProvider: 'gmail', emailFrom: '', emailFromName: 'JOY Yoga', gmailAppPassword: '',
  whatsappEnabled: false, whatsappMode: 'link', whatsappApiToken: '', whatsappPhoneId: '',
  telegramEnabled: false, telegramBotToken: '', telegramChatId: '',
  sessionReminderHours: 2, planExpiryWarningDays: 3,
  triggers: DEFAULT_TRIGGERS,
};

const CHANNEL_ICONS: Record<string, any> = { email: Mail, whatsapp: MessageCircle, telegram: Send, app: Bell };
const CHANNEL_LABELS: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp', telegram: 'Telegram', app: 'App' };

export function AdminNotifications() {
  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'triggers' | 'email' | 'whatsapp' | 'telegram' | 'mass'>('triggers');
  const [massMessage, setMassMessage] = useState({ subject: '', body: '', channels: { email: true, whatsapp: false, telegram: false } });
  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'siteConfig', 'notifications'));
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setConfig({ ...DEFAULT_CONFIG, ...data, triggers: data.triggers || DEFAULT_TRIGGERS });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'siteConfig', 'notifications'), { ...config, updatedAt: new Date() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const updateTrigger = (index: number, field: string, value: any) => {
    const triggers = [...config.triggers];
    triggers[index] = { ...triggers[index], [field]: value };
    setConfig({ ...config, triggers });
  };

  const toggleChannel = (triggerIndex: number, channel: string) => {
    const triggers = [...config.triggers];
    const channels = { ...triggers[triggerIndex].channels, [channel]: !triggers[triggerIndex].channels[channel as keyof typeof triggers[0]['channels']] };
    triggers[triggerIndex] = { ...triggers[triggerIndex], channels };
    setConfig({ ...config, triggers });
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  const tabs = [
    { id: 'triggers', label: 'Notificações', icon: Bell },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'telegram', label: 'Telegram', icon: Send },
    { id: 'mass', label: 'Envio em Massa', icon: Send },
  ] as const;

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) return;
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const fn = httpsCallable(functions, 'sendTestEmail');
      const result: any = await fn({ to: testEmailAddress });
      if (result?.data?.success) {
        setTestEmailResult({ success: true, message: `Email enviado com sucesso para ${result.data.to} via ${result.data.provider}. Confirma a caixa de entrada.` });
      } else {
        setTestEmailResult({ success: false, message: 'Falha ao enviar — verifica os logs no Firebase Console.' });
      }
    } catch (err: any) {
      console.error(err);
      setTestEmailResult({ success: false, message: err?.message || 'Erro ao enviar email de teste' });
    } finally {
      setTestEmailSending(false);
    }
  };

  return (
    <div>
      {/* Save bar */}
      <div className="save-bar">
        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <><CheckCircle size={18} /> Guardado</> : <><Save size={18} /> Guardar</>}
        </button>
      </div>

      <div className="settings-card">
        {/* TRIGGERS */}
        {activeTab === 'triggers' && (
          <>
            <div className="info-box">Ativa/desativa notificações por evento e canal. Cada notificação pode ser enviada por email, WhatsApp, Telegram ou in-app.</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="label">Lembrete de aula (horas antes)</label>
                <input className="input" type="number" min="1" value={config.sessionReminderHours} onChange={e => setConfig({ ...config, sessionReminderHours: Number(e.target.value) })} style={{ width: 100 }} />
              </div>
              <div className="form-group">
                <label className="label">Aviso de expiração (dias antes)</label>
                <input className="input" type="number" min="1" value={config.planExpiryWarningDays} onChange={e => setConfig({ ...config, planExpiryWarningDays: Number(e.target.value) })} style={{ width: 100 }} />
              </div>
            </div>

            <div className="triggers-list">
              {config.triggers.map((t, i) => {
                const isExpanded = expandedTrigger === t.trigger;
                const defaultTemplate = DEFAULT_TEMPLATES[t.trigger];
                const hasActiveChannels = Object.values(t.channels).some(v => v);
                return (
                <div key={t.trigger} className={`trigger-card ${isExpanded ? 'expanded' : ''} ${!hasActiveChannels ? 'disabled' : ''}`}>
                  <div className="trigger-header" onClick={() => setExpandedTrigger(isExpanded ? null : t.trigger)} style={{ cursor: 'pointer' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>{t.label}</strong>
                        {!hasActiveChannels && <span className="badge badge-warning" style={{ fontSize: '0.5625rem' }}>Desativado</span>}
                      </div>
                      <span className="trigger-desc">{t.description}</span>
                    </div>
                    <span className="trigger-expand">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  <div className="trigger-channels" onClick={e => e.stopPropagation()}>
                    {Object.entries(CHANNEL_LABELS).map(([ch, label]) => {
                      const Icon = CHANNEL_ICONS[ch];
                      const enabled = t.channels[ch as keyof typeof t.channels];
                      return (
                        <button key={ch} className={`channel-toggle ${enabled ? 'active' : ''}`} onClick={() => toggleChannel(i, ch)} title={label}>
                          <Icon size={14} /> {label}
                        </button>
                      );
                    })}
                    <span className="trigger-divider" />
                    <label className="notify-label">
                      <input type="checkbox" checked={t.notifyStudent} onChange={e => updateTrigger(i, 'notifyStudent', e.target.checked)} /> Aluno
                    </label>
                    <label className="notify-label">
                      <input type="checkbox" checked={t.notifyProfessor} onChange={e => updateTrigger(i, 'notifyProfessor', e.target.checked)} /> Professor
                    </label>
                  </div>

                  {/* Expanded: template editor */}
                  {isExpanded && (
                    <div className="trigger-template" onClick={e => e.stopPropagation()}>
                      <div className="form-group">
                        <label className="label">Assunto do email</label>
                        <input className="input" value={defaultTemplate?.subject || ''} readOnly style={{ background: 'var(--bg-secondary)' }} />
                      </div>
                      <div className="form-group">
                        <label className="label">Mensagem para o Aluno</label>
                        <textarea className="input textarea" rows={6} value={t.template || defaultTemplate?.body || ''} onChange={e => updateTrigger(i, 'template', e.target.value)} />
                      </div>
                      {t.notifyProfessor && (
                        <div className="form-group">
                          <label className="label" style={{ color: '#7c3aed' }}>Mensagem para o Professor</label>
                          <textarea className="input textarea" rows={4} value={t.professorTemplate || DEFAULT_PROFESSOR_TEMPLATES[t.trigger] || ''} onChange={e => updateTrigger(i, 'professorTemplate', e.target.value)} />
                          <div className="template-vars" style={{ marginTop: '0.375rem' }}>
                            <span className="template-vars-label">Variáveis:</span>
                            {['{{professor}}', '{{aluno}}', '{{data}}', '{{hora}}', '{{horaFim}}', '{{espaco}}', '{{numAlunos}}', '{{horas}}'].map(v => (
                              <button key={v} className="var-chip" onClick={() => {
                                const current = t.professorTemplate || DEFAULT_PROFESSOR_TEMPLATES[t.trigger] || '';
                                updateTrigger(i, 'professorTemplate', current + v);
                              }}>{v}</button>
                            ))}
                          </div>
                          <button className="btn btn-sm btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => updateTrigger(i, 'professorTemplate', DEFAULT_PROFESSOR_TEMPLATES[t.trigger] || '')}>
                            Repor texto original
                          </button>
                        </div>
                      )}
                      <div className="template-vars">
                        <span className="template-vars-label">Variáveis (aluno):</span>
                        {['{{nome}}', '{{plano}}', '{{sessoes}}', '{{validade}}', '{{data}}', '{{hora}}', '{{horaFim}}', '{{espaco}}', '{{professor}}', '{{motivo}}', '{{compensacao}}', '{{antecedencia}}', '{{cancelamento}}', '{{creditoDias}}', '{{novoProfessor}}', '{{professorOriginal}}', '{{dias}}', '{{horas}}'].map(v => (
                          <button key={v} className="var-chip" onClick={() => {
                            const current = t.template || defaultTemplate?.body || '';
                            updateTrigger(i, 'template', current + v);
                          }}>{v}</button>
                        ))}
                      </div>
                      <button className="btn btn-sm btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => updateTrigger(i, 'template', defaultTemplate?.body || '')}>
                        Repor texto original
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </>
        )}

        {/* EMAIL CONFIG */}
        {activeTab === 'email' && (
          <>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
                <input type="checkbox" checked={config.emailEnabled} onChange={e => setConfig({ ...config, emailEnabled: e.target.checked })} />
                <strong>Email ativo</strong>
              </label>
            </div>
            {config.emailEnabled && (
              <>
                <div className="form-group">
                  <label className="label">Provider</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <label className={`mode-option ${config.emailProvider === 'gmail' ? 'active' : ''}`}>
                      <input type="radio" name="emailProvider" value="gmail" checked={config.emailProvider === 'gmail'} onChange={() => setConfig({ ...config, emailProvider: 'gmail' })} />
                      <Mail size={18} />
                      <strong>Gmail</strong>
                      <small>SMTP com App Password. Grátis até 500 emails/dia.</small>
                    </label>
                    <label className={`mode-option ${config.emailProvider === 'resend' ? 'active' : ''}`}>
                      <input type="radio" name="emailProvider" value="resend" checked={config.emailProvider === 'resend'} onChange={() => setConfig({ ...config, emailProvider: 'resend' })} />
                      <Send size={18} />
                      <strong>Resend</strong>
                      <small>API moderna. Domínio próprio. 3000 emails/mês grátis.</small>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="label">Nome do remetente</label>
                    <input className="input" value={config.emailFromName} onChange={e => setConfig({ ...config, emailFromName: e.target.value })} placeholder="JOY Yoga" />
                  </div>
                  <div className="form-group">
                    <label className="label">{config.emailProvider === 'resend' ? 'Email de notificação (para respostas)' : 'Email de envio (Gmail)'}</label>
                    <input className="input" value={config.emailFrom} onChange={e => setConfig({ ...config, emailFrom: e.target.value })} placeholder="geral@joaquimyoga.pt" />
                  </div>
                </div>

                {config.emailProvider === 'gmail' && (
                  <div className="form-group">
                    <label className="label">Gmail App Password</label>
                    <input className="input" type="password" value={config.gmailAppPassword || ''} onChange={e => setConfig({ ...config, gmailAppPassword: e.target.value })} placeholder="xxxx xxxx xxxx xxxx" />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                      Criar em: Google Account → Segurança → Passwords de apps. Ativar 2FA primeiro.
                    </span>
                  </div>
                )}

                {config.emailProvider === 'resend' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="label">API Key</label>
                        <input className="input" type="password" value={(config as any).resendApiKey || ''} onChange={e => setConfig({ ...config, resendApiKey: e.target.value } as any)} placeholder="re_xxxxxxxxx" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                          Criar em: resend.com → API Keys
                        </span>
                      </div>
                      <div className="form-group">
                        <label className="label">Email verificado (From)</label>
                        <input className="input" value={(config as any).resendFromEmail || ''} onChange={e => setConfig({ ...config, resendFromEmail: e.target.value } as any)} placeholder="noreply@joaquimyoga.pt" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                          Domínio verificado no Resend ou usar onboarding@resend.dev para testes.
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Test email */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--beige)' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>Enviar email de teste</h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Confirma que a configuração funciona — guarda primeiro se alteraste algo acima.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      type="email"
                      value={testEmailAddress}
                      onChange={e => setTestEmailAddress(e.target.value)}
                      placeholder="email@exemplo.pt"
                      style={{ flex: 1, minWidth: 240 }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSendTestEmail}
                      disabled={testEmailSending || !testEmailAddress}
                    >
                      {testEmailSending ? 'A enviar...' : 'Enviar teste'}
                    </button>
                  </div>
                  {testEmailResult && (
                    <div style={{
                      marginTop: '0.625rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem',
                      background: testEmailResult.success ? '#d1fae5' : '#fef2f2',
                      color: testEmailResult.success ? '#065f46' : '#991b1b',
                      border: `1px solid ${testEmailResult.success ? '#a7f3d0' : '#fecaca'}`,
                    }}>
                      {testEmailResult.message}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* WHATSAPP CONFIG */}
        {activeTab === 'whatsapp' && (
          <>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
                <input type="checkbox" checked={config.whatsappEnabled} onChange={e => setConfig({ ...config, whatsappEnabled: e.target.checked })} />
                <strong>WhatsApp ativo</strong>
              </label>
            </div>
            {config.whatsappEnabled && (
              <>
                <div className="form-group">
                  <label className="label">Modo</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <label className={`mode-option ${config.whatsappMode === 'link' ? 'active' : ''}`}>
                      <input type="radio" name="waMode" value="link" checked={config.whatsappMode === 'link'} onChange={() => setConfig({ ...config, whatsappMode: 'link' })} />
                      <strong>Links wa.me</strong>
                      <small>Abre WhatsApp com mensagem pré-preenchida. Requer ação manual.</small>
                    </label>
                    <label className={`mode-option ${config.whatsappMode === 'api' ? 'active' : ''}`}>
                      <input type="radio" name="waMode" value="api" checked={config.whatsappMode === 'api'} onChange={() => setConfig({ ...config, whatsappMode: 'api' })} />
                      <strong>API Business</strong>
                      <small>Envio automático sem intervenção. Requer conta Business verificada.</small>
                    </label>
                  </div>
                </div>
                {config.whatsappMode === 'api' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="label">API Token</label>
                      <input className="input" type="password" value={config.whatsappApiToken || ''} onChange={e => setConfig({ ...config, whatsappApiToken: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label">Phone Number ID</label>
                      <input className="input" value={config.whatsappPhoneId || ''} onChange={e => setConfig({ ...config, whatsappPhoneId: e.target.value })} />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* TELEGRAM CONFIG */}
        {activeTab === 'telegram' && (
          <>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
                <input type="checkbox" checked={config.telegramEnabled} onChange={e => setConfig({ ...config, telegramEnabled: e.target.checked })} />
                <strong>Telegram ativo</strong>
              </label>
            </div>
            {config.telegramEnabled && (
              <>
                <div className="info-box">
                  Cria um bot no Telegram via @BotFather, obtém o token, e adiciona o bot ao grupo/canal desejado.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="label">Bot Token</label>
                    <input className="input" type="password" value={config.telegramBotToken || ''} onChange={e => setConfig({ ...config, telegramBotToken: e.target.value })} placeholder="123456:ABC-DEF..." />
                  </div>
                  <div className="form-group">
                    <label className="label">Chat ID (grupo/canal)</label>
                    <input className="input" value={config.telegramChatId || ''} onChange={e => setConfig({ ...config, telegramChatId: e.target.value })} placeholder="-100123456789" />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* MASS MESSAGE */}
        {activeTab === 'mass' && (
          <>
            <div className="info-box">Enviar mensagem em massa para todos os clientes ativos. Email enviado em BCC.</div>
            <div className="form-group">
              <label className="label">Assunto</label>
              <input className="input" value={massMessage.subject} onChange={e => setMassMessage({ ...massMessage, subject: e.target.value })} placeholder="Novidades JOY Yoga" />
            </div>
            <div className="form-group">
              <label className="label">Mensagem</label>
              <textarea className="input textarea" rows={6} value={massMessage.body} onChange={e => setMassMessage({ ...massMessage, body: e.target.value })} placeholder="Olá! Temos novidades..." />
            </div>
            <div className="form-group">
              <label className="label">Canais</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={massMessage.channels.email} onChange={e => setMassMessage({ ...massMessage, channels: { ...massMessage.channels, email: e.target.checked } })} /> Email (BCC)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={massMessage.channels.whatsapp} onChange={e => setMassMessage({ ...massMessage, channels: { ...massMessage.channels, whatsapp: e.target.checked } })} /> WhatsApp
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={massMessage.channels.telegram} onChange={e => setMassMessage({ ...massMessage, channels: { ...massMessage.channels, telegram: e.target.checked } })} /> Telegram
                </label>
              </div>
            </div>
            <button className="btn btn-primary" disabled={!massMessage.subject || !massMessage.body} onClick={async () => {
              if (!confirm(`Enviar mensagem para todos os clientes ativos?\n\nAssunto: ${massMessage.subject}`)) return;
              await setDoc(doc(db, 'massMessages', Date.now().toString()), {
                ...massMessage, status: 'pending', createdAt: new Date(),
              });
              alert('Mensagem agendada! Será processada pela Cloud Function.');
              setMassMessage({ subject: '', body: '', channels: { email: true, whatsapp: false, telegram: false } });
            }}>
              <Send size={18} /> Enviar para Todos
            </button>
          </>
        )}
      </div>

      <style>{`
        .save-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
        .tabs { display: flex; gap: 0.25rem; background: white; border-radius: var(--radius-lg); padding: 0.25rem; box-shadow: var(--shadow-sm); overflow-x: auto; }
        .tab { background: none; border: none; padding: 0.5rem 0.75rem; font-family: var(--font-body); font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: var(--radius-md); transition: all var(--transition-fast); white-space: nowrap; display: flex; align-items: center; gap: 0.375rem; }
        .tab.active { background: var(--primary); color: white; }
        .settings-card { background: white; border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-sm); }
        .info-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: var(--radius-lg); padding: 0.75rem 1rem; font-size: 0.875rem; color: #0369a1; margin-bottom: 1.25rem; }

        .triggers-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .trigger-card { border: 1px solid var(--sand); border-radius: var(--radius-lg); padding: 1rem; transition: all var(--transition-fast); }
        .trigger-card:hover { border-color: var(--primary-light); box-shadow: var(--shadow-sm); }
        .trigger-card.expanded { border-color: var(--primary); box-shadow: var(--shadow-md); }
        .trigger-card.disabled { opacity: 0.5; }
        .trigger-header { margin-bottom: 0.5rem; display: flex; align-items: flex-start; gap: 0.5rem; }
        .trigger-header strong { font-size: 0.9375rem; }
        .trigger-expand { font-size: 0.625rem; color: var(--text-muted); margin-top: 0.25rem; }
        .trigger-desc { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.125rem; }
        .trigger-channels { display: flex; gap: 0.375rem; align-items: center; flex-wrap: wrap; }
        .channel-toggle { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.3rem 0.625rem; border-radius: 999px; border: 1.5px solid var(--sand); background: white; font-size: 0.75rem; font-family: var(--font-body); color: var(--text-muted); cursor: pointer; transition: all var(--transition-fast); }
        .channel-toggle:hover { border-color: var(--primary); }
        .channel-toggle.active { background: var(--primary); color: white; border-color: var(--primary); }
        .trigger-divider { width: 1px; height: 20px; background: var(--sand); margin: 0 0.25rem; }
        .notify-label { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--text-secondary); cursor: pointer; }

        .trigger-template { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--beige); }
        .template-vars { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.5rem; align-items: center; }
        .template-vars-label { font-size: 0.6875rem; color: var(--text-muted); font-weight: 600; margin-right: 0.25rem; }
        .var-chip { display: inline-block; padding: 0.125rem 0.375rem; border-radius: 4px; border: 1px solid var(--sand); background: var(--bg-secondary); font-size: 0.625rem; font-family: monospace; color: var(--primary-dark); cursor: pointer; transition: all var(--transition-fast); }
        .var-chip:hover { background: var(--primary); color: white; border-color: var(--primary); }

        .mode-option { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.75rem; border: 2px solid var(--sand); border-radius: var(--radius-lg); cursor: pointer; transition: all var(--transition-fast); text-align: center; }
        .mode-option input[type="radio"] { display: none; }
        .mode-option small { font-size: 0.6875rem; color: var(--text-muted); }
        .mode-option:hover { border-color: var(--primary); }
        .mode-option.active { border-color: var(--primary); background: rgba(124,154,114,0.08); }

        @media (max-width: 768px) { .settings-card { padding: 1.5rem; } }
      `}</style>
    </div>
  );
}
