import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

export const createProfessorAccount = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    const callerDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!callerDoc.exists) throw new functions.https.HttpsError('permission-denied', 'Not an admin');

    const { email: rawEmail, professorId, professorName } = data as { email: string; professorId: string; professorName: string };
    if (!rawEmail || !professorId) throw new functions.https.HttpsError('invalid-argument', 'email and professorId required');
    const email = String(rawEmail).trim().toLowerCase();

    let uid: string;

    try {
      const existing = await admin.auth().getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-4).toUpperCase() + '!';
      const newUser = await admin.auth().createUser({ email, password: tempPassword, displayName: professorName });
      uid = newUser.uid;
    }

    await admin.firestore().collection('professors').doc(professorId).update({
      linkedUserId: uid,
      linkedEmail: email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const resetLink = await admin.auth().generatePasswordResetLink(email);

    // Send invite email — supports Resend OR Gmail (same as createClientAccount)
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const [notifSnap, mainSnap] = await Promise.all([
        admin.firestore().collection('siteConfig').doc('notifications').get(),
        admin.firestore().collection('siteConfig').doc('main').get(),
      ]);
      const config = { ...mainSnap.data(), ...notifSnap.data() };
      const fromEmail = config.resendFromEmail || config.emailFrom || 'noreply@joaquimyoga.pt';
      const fromName = config.emailFromName || 'JOY Yoga';
      const siteName = config.siteName || 'JOY';
      const subject = `Convite para o Portal do Professor — ${siteName}`;
      const html = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#ffffff;padding:40px 40px 24px;text-align:center;border-bottom:1px solid #f0ede8;">
          <div style="font-family:Georgia,serif;font-size:2rem;font-weight:600;color:#8b5e3c;letter-spacing:0.15em;">JOY</div>
          <div style="font-size:0.625rem;text-transform:uppercase;letter-spacing:0.2em;color:#aaa;margin-top:4px;">Joaquim Oliveira Yoga</div>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 8px;font-size:1.375rem;font-weight:600;color:#1a1a1a;">Bem-vindo, ${professorName}!</h1>
          <p style="margin:0 0 24px;font-size:0.9375rem;line-height:1.6;color:#555;">
            Foi criado o teu acesso ao <strong style="color:#1a1a1a;">Portal do Professor</strong> de ${siteName}.<br>
            Clica no botão abaixo para definir a tua password e começar a usar o portal.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetLink}" style="display:inline-block;background:#7c9a72;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem;">
              Definir Password e Entrar
            </a>
          </div>
          <div style="background:#f9f7f4;border-radius:8px;padding:16px 20px;margin-top:8px;">
            <p style="margin:0;font-size:0.8125rem;color:#888;line-height:1.5;">
              ⏱ Este link expira em <strong>24 horas</strong>.<br>
              Se não pediste este acesso, podes ignorar este email.
            </p>
          </div>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;text-align:center;border-top:1px solid #f0ede8;">
          <p style="margin:0;font-size:0.75rem;color:#bbb;">
            ${siteName} · <a href="https://joaquimyoga.pt" style="color:#bbb;text-decoration:none;">joaquimyoga.pt</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      if (config.emailProvider === 'resend' && config.resendApiKey) {
        await axios.post('https://api.resend.com/emails', {
          from: `${fromName} <${fromEmail}>`, to: email, subject, html,
        }, { headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' } });
        emailSent = true;
        console.log('✅ Professor invite email sent via Resend to:', email);
      } else if (config.emailProvider === 'gmail' && config.gmailAppPassword && config.emailFrom) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: config.emailFrom, pass: config.gmailAppPassword },
        });
        await transporter.sendMail({ from: `"${fromName}" <${config.emailFrom}>`, to: email, subject, html });
        emailSent = true;
        console.log('✅ Professor invite email sent via Gmail to:', email);
      } else {
        emailError = 'Nenhum provedor de email configurado (Gmail App Password ou Resend API key)';
        console.warn('⚠️', emailError);
      }
    } catch (err: any) {
      emailError = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      console.error('❌ Professor invite email failed:', emailError);
    }

    return { uid, resetLink, emailSent, emailError };
  });
