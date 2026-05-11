/**
 * NOTIFICATION SERVICE
 * Sends notifications via Email (Nodemailer), Telegram Bot API, WhatsApp (link or API)
 * Reads config from Firestore siteConfig/notifications
 */
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

const db = admin.firestore();

let cachedConfig: any = null;
let configLoadedAt = 0;

async function getNotificationConfig(): Promise<any> {
  // Cache for 5 minutes
  if (cachedConfig && Date.now() - configLoadedAt < 5 * 60 * 1000) return cachedConfig;
  const doc = await db.collection('siteConfig').doc('notifications').get();
  const data = doc.exists ? doc.data() : {};
  // Also merge email settings from main siteConfig if not in notifications
  if (!data?.emailFrom || !data?.resendApiKey) {
    const mainDoc = await db.collection('siteConfig').doc('main').get();
    const mainData = mainDoc.exists ? mainDoc.data() : {};
    if (mainData?.paymentApiKey && !data?.resendApiKey) {
      // Check if resend config exists in main
    }
  }
  // Reset transporter when config changes
  if (cachedConfig && cachedConfig.emailProvider !== (data?.emailProvider || 'resend')) {
    transporter = null;
  }
  cachedConfig = { emailEnabled: true, emailProvider: 'resend', ...data };
  configLoadedAt = Date.now();
  console.log('📧 Notification config loaded:', { emailEnabled: cachedConfig.emailEnabled, emailProvider: cachedConfig.emailProvider, hasResendKey: !!cachedConfig.resendApiKey, triggersCount: cachedConfig.triggers?.length || 0 });
  return cachedConfig;
}

async function getSiteConfig(): Promise<any> {
  const doc = await db.collection('siteConfig').doc('main').get();
  return doc.exists ? doc.data() : {};
}

// ============ EMAIL ============
let transporter: nodemailer.Transporter | null = null;
let lastEmailProvider = '';

function buildHtml(body: string): string {
  const htmlBody = body.replace(/\n/g, '<br>');
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="color: #7c9a72; margin: 0;">JOY</h2>
        <p style="color: #999; font-size: 0.75rem; margin: 0.25rem 0 0;">Joaquim Oliveira Yoga</p>
      </div>
      <div style="font-size: 0.9375rem; line-height: 1.6; color: #333;">
        ${htmlBody}
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;" />
      <p style="font-size: 0.75rem; color: #999; text-align: center;">
        JOY - Joaquim Oliveira Yoga · joaquimyoga.pt
      </p>
    </div>
  `;
}

// ---- Gmail (Nodemailer SMTP) ----
async function getGmailTransporter(config: any): Promise<nodemailer.Transporter | null> {
  if (transporter && lastEmailProvider === 'gmail') return transporter;
  lastEmailProvider = 'gmail';
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.emailFrom, pass: config.gmailAppPassword },
  });
  return transporter;
}

async function sendViaGmail(config: any, to: string, subject: string, body: string, bcc?: string): Promise<boolean> {
  const mailer = await getGmailTransporter(config);
  if (!mailer) return false;
  await mailer.sendMail({
    from: `"${config.emailFromName || 'JOY Yoga'}" <${config.emailFrom}>`,
    to, bcc, subject, text: body, html: buildHtml(body),
  });
  return true;
}

// ---- Resend (API) ----
async function sendViaResend(config: any, to: string, subject: string, body: string, bcc?: string): Promise<boolean> {
  const response = await axios.post('https://api.resend.com/emails', {
    from: `${config.emailFromName || 'JOY Yoga'} <${config.resendFromEmail || config.emailFrom}>`,
    to: bcc ? undefined : [to],
    bcc: bcc ? bcc.split(',').map((e: string) => e.trim()) : undefined,
    subject,
    text: body,
    html: buildHtml(body),
  }, {
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
  });
  console.log('✅ Resend response:', response.data);
  return true;
}

// ---- Send Email (router) ----
export async function sendEmail(config: any, to: string, subject: string, body: string, bcc?: string): Promise<boolean> {
  if (!config.emailEnabled) { console.log('📧 Email disabled'); return false; }
  console.log('📧 Sending email via', config.emailProvider, 'to:', to, 'from:', config.resendFromEmail || config.emailFrom);
  try {
    if (config.emailProvider === 'resend') {
      return await sendViaResend(config, to, subject, body, bcc);
    }
    // Default: Gmail
    return await sendViaGmail(config, to, subject, body, bcc);
  } catch (error: any) {
    console.error('❌ Email failed:', error.response?.data || error.message);
    return false;
  }
}

// ============ TELEGRAM ============
async function sendTelegram(config: any, message: string): Promise<boolean> {
  if (!config.telegramEnabled || !config.telegramBotToken || !config.telegramChatId) {
    console.log('📱 Telegram disabled or not configured');
    return false;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      chat_id: config.telegramChatId,
      text: message,
      parse_mode: 'HTML',
    });
    console.log('✅ Telegram sent');
    return true;
  } catch (error: any) {
    console.error('❌ Telegram failed:', error.response?.data || error.message);
    return false;
  }
}

// ============ WHATSAPP ============
async function sendWhatsApp(config: any, phone: string, message: string): Promise<{ sent: boolean; link?: string }> {
  if (!config.whatsappEnabled) {
    console.log('📱 WhatsApp disabled');
    return { sent: false };
  }

  if (config.whatsappMode === 'api' && config.whatsappApiToken && config.whatsappPhoneId) {
    // WhatsApp Business Cloud API
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${config.whatsappPhoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone.replace(/\D/g, ''),
          type: 'text',
          text: { body: message },
        },
        { headers: { Authorization: `Bearer ${config.whatsappApiToken}`, 'Content-Type': 'application/json' } }
      );
      console.log('✅ WhatsApp API sent to:', phone);
      return { sent: true };
    } catch (error: any) {
      console.error('❌ WhatsApp API failed:', error.response?.data || error.message);
      return { sent: false };
    }
  } else {
    // Generate wa.me link (manual send)
    const cleanPhone = phone.replace(/\D/g, '');
    const link = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    console.log('📱 WhatsApp link generated:', link);
    return { sent: false, link };
  }
}

// ============ MAIN SEND FUNCTION ============
interface NotificationParams {
  trigger: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
  variables: Record<string, string>;
  templateOverride?: string;
}

export async function sendNotification(params: NotificationParams): Promise<void> {
  const config = await getNotificationConfig();
  const siteConfig = await getSiteConfig();

  // Fallback triggers if config not saved yet
  const defaultTriggers = [
    { trigger: 'plan_purchased', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: false, template: 'Olá {{nome}}!\n\nObrigado por comprares o plano "{{plano}}".\nTens {{sessoes}} aulas disponíveis até {{validade}}.\n\nBoas práticas! 🧘' },
    { trigger: 'session_booked', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: true, template: 'Olá {{nome}}!\n\nA tua aula está confirmada:\n📅 {{data}}\n🕐 {{hora}} - {{horaFim}}\n📍 {{espaco}}\n👤 Professor: {{professor}}\n\nAté lá! 🧘' },
    { trigger: 'session_cancelled', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: true, template: 'Olá {{nome}}!\n\nA tua aula de {{data}} às {{hora}} foi cancelada.\n{{compensacao}}' },
    { trigger: 'session_reminder', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: true, template: 'Olá {{nome}}!\n\nLembrete: tens aula hoje!\n📅 {{data}}\n🕐 {{hora}}\n📍 {{espaco}}' },
    { trigger: 'plan_expiring', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: false, template: 'Olá {{nome}}!\n\nO teu plano "{{plano}}" expira em {{dias}} dias.\nTens {{sessoes}} aulas por usar.' },
    { trigger: 'waitlist_promoted', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: false, label: 'Lista de Espera — Lugar Disponível', template: 'Olá {{nome}}!\n\nÉ a tua vez! Ficou um lugar disponível na aula:\n📅 {{data}}\n🕐 {{hora}}\n📍 {{espaco}}\n\nAcede ao portal para confirmar a tua inscrição. O lugar é reservado por 2 horas.' },
    { trigger: 'class_attended', channels: { email: true, whatsapp: false, telegram: false, app: true }, notifyStudent: true, notifyProfessor: false, label: 'Presença Confirmada', template: 'Olá {{nome}}!\n\nObrigado por estares presente na aula de hoje com {{professor}}! 🙏\n\nJá tens {{totalPresencas}} presenças registadas. Cada aula é um passo na tua jornada.\n\nAté à próxima! 🧘' },
  ];

  const triggers = (config.triggers && Array.isArray(config.triggers) && config.triggers.length > 0) ? config.triggers : defaultTriggers;

  const triggerConfig = triggers.find((t: any) => t.trigger === params.trigger);
  if (!triggerConfig) {
    console.log('⚠️ Trigger not found:', params.trigger);
    return;
  }

  console.log('📬 Processing notification:', params.trigger, 'to:', params.recipientEmail);

  // Build message from template (allow override for professor-specific messages)
  let message = params.templateOverride || triggerConfig.template || '';
  let subject = '';

  // Replace variables
  const vars: Record<string, string> = {
    ...params.variables,
    antecedencia: String(siteConfig.bookingMinHoursBefore || 24),
    cancelamento: String(siteConfig.cancelLimitHoursBefore || 2),
    creditoDias: String(siteConfig.creditValidityDays || 30),
  };

  for (const [key, value] of Object.entries(vars)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Simple subject from trigger label
  subject = `JOY Yoga - ${triggerConfig.label}`;

  const results: string[] = [];

  // Email
  if (triggerConfig.channels.email && params.recipientEmail) {
    const ok = await sendEmail(config, params.recipientEmail, subject, message);
    results.push(`email:${ok ? 'ok' : 'fail'}`);
  }

  // Telegram
  if (triggerConfig.channels.telegram) {
    const telegramMsg = `<b>${triggerConfig.label}</b>\n\n${message.replace(/\n/g, '\n')}`;
    const ok = await sendTelegram(config, telegramMsg);
    results.push(`telegram:${ok ? 'ok' : 'fail'}`);
  }

  // WhatsApp
  if (triggerConfig.channels.whatsapp && params.recipientPhone) {
    const result = await sendWhatsApp(config, params.recipientPhone, message);
    results.push(`whatsapp:${result.sent ? 'ok' : result.link ? 'link' : 'fail'}`);

    // Store WhatsApp link for manual sending if in link mode
    if (result.link) {
      await db.collection('pendingWhatsApp').add({
        trigger: params.trigger,
        recipientName: params.recipientName || '',
        recipientPhone: params.recipientPhone,
        message,
        link: result.link,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sent: false,
      });
    }
  }

  // Log notification
  await db.collection('notificationLogs').add({
    trigger: params.trigger,
    recipientEmail: params.recipientEmail || null,
    recipientPhone: params.recipientPhone || null,
    recipientName: params.recipientName || null,
    channels: results,
    message: message.substring(0, 200),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`📬 Notification [${params.trigger}]:`, results.join(', '));
}

// ============ MASS MESSAGE ============
export async function processMassMessage(messageDoc: FirebaseFirestore.DocumentSnapshot): Promise<void> {
  const data = messageDoc.data();
  if (!data || data.status !== 'pending') return;

  const config = await getNotificationConfig();

  // Get all active clients
  const usersSnap = await db.collection('users').where('role', '==', 'client').get();
  const emails: string[] = [];
  const phones: string[] = [];

  usersSnap.docs.forEach(d => {
    const u = d.data();
    if (u.email) emails.push(u.email);
    if (u.phone) phones.push(u.phone);
  });

  let sent = 0;

  // Email BCC
  if (data.channels?.email && emails.length > 0) {
    try {
      const ok = await sendEmail(config, config.emailFrom, data.subject, data.body, emails.join(','));
      if (ok) {
        sent += emails.length;
        console.log(`✅ Mass email sent to ${emails.length} recipients via ${config.emailProvider}`);
      }
    } catch (e: any) {
      console.error('❌ Mass email failed:', e.message);
    }
  }

  // Telegram
  if (data.channels?.telegram) {
    await sendTelegram(config, `<b>${data.subject}</b>\n\n${data.body}`);
  }

  // Update status
  await messageDoc.ref.update({
    status: 'sent',
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    recipientCount: sent,
  });
}
