/**
 * Admin-triggered password reset for an existing client.
 * Generates a reset link (Auth) and emails it using the same notifications
 * email config (Gmail/Resend) used by the rest of the system.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const sendClientPasswordReset = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Não autenticado.');
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem fazer reset.');
    }

    const { email: rawEmail, name } = data as { email: string; name?: string };
    if (!rawEmail) throw new functions.https.HttpsError('invalid-argument', 'Email é obrigatório.');
    const email = String(rawEmail).trim().toLowerCase();

    const db = admin.firestore();
    const [mainSnap, notifSnap] = await Promise.all([
      db.collection('siteConfig').doc('main').get(),
      db.collection('siteConfig').doc('notifications').get(),
    ]);
    const config = { ...(mainSnap.data() || {}), ...(notifSnap.data() || {}) };
    const siteName: string = config.siteName || 'JOY';

    // Verify the user exists in Auth (don't reveal if not)
    let displayName = name || '';
    let userUid: string | null = null;
    try {
      const u = await admin.auth().getUserByEmail(email);
      userUid = u.uid;
      if (!displayName) displayName = u.displayName || email.split('@')[0];
    } catch {
      throw new functions.https.HttpsError('not-found', 'Não existe nenhuma conta com este email.');
    }

    // Link any orphan purchases (paid as guest) to this user's uid
    if (userUid) {
      try {
        const orphanPurchases = await db.collection('purchases').where('userEmail', '==', email).get();
        let linked = 0;
        const batch = db.batch();
        orphanPurchases.docs.forEach(d => {
          const data = d.data();
          if (!data.userId || data.userId !== userUid) {
            batch.update(d.ref, { userId: userUid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            linked++;
          }
        });
        if (linked > 0) {
          await batch.commit();
          console.log(`🔗 Linked ${linked} orphan purchase(s) to uid ${userUid} (${email})`);
        }
      } catch (e) {
        console.error('Failed to link orphan purchases:', e);
      }
    }

    const resetLink = await admin.auth().generatePasswordResetLink(email);

    const fromName: string = config.emailFromName || config.fromName || siteName;
    const fromEmail: string = config.resendFromEmail || config.emailFrom || 'noreply@joaquimyoga.pt';
    const subject = `Recupera a tua password — ${siteName}`;
    const html = `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; background: #faf8f5; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c9a72, #5a7a52); padding: 2.5rem 2rem; text-align: center;">
          <h1 style="color: white; font-family: Georgia, serif; font-weight: 400; font-size: 1.75rem; margin: 0;">Recupera a tua password</h1>
        </div>
        <div style="padding: 2rem; background: white;">
          <p style="color: #4a5568; font-size: 1rem; line-height: 1.6; margin: 0 0 1.25rem;">
            ${displayName ? `Olá ${displayName.split(' ')[0]},` : 'Olá,'}
          </p>
          <p style="color: #4a5568; font-size: 1rem; line-height: 1.6; margin: 0 0 1.5rem;">
            Recebemos um pedido para repor a tua password no ${siteName}. Clica no botão abaixo para definires uma nova:
          </p>
          <div style="text-align: center; margin: 1.5rem 0;">
            <a href="${resetLink}" style="display: inline-block; background: #7c9a72; color: white; padding: 0.875rem 2rem; border-radius: 8px; text-decoration: none; font-family: sans-serif; font-weight: 600; font-size: 1rem;">
              Definir nova password
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 0.8125rem; margin: 1.25rem 0 0; text-align: center;">
            O link é válido por 1 hora. Se não pediste este reset, podes ignorar este email.
          </p>
        </div>
        <div style="padding: 1.25rem; text-align: center; background: #f5f0ea;">
          <p style="color: #a0aec0; font-size: 0.8125rem; margin: 0; font-family: sans-serif;">
            Com carinho, <strong style="color: #7c9a72;">${siteName}</strong>
          </p>
        </div>
      </div>
    `;

    let emailSent = false;
    let emailError: string | null = null;
    try {
      if (config.emailProvider === 'resend' && config.resendApiKey) {
        const axios = require('axios');
        await axios.post('https://api.resend.com/emails', {
          from: `${fromName} <${fromEmail}>`, to: email, subject, html,
        }, { headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' } });
        emailSent = true;
      } else if (config.emailProvider === 'gmail' && config.gmailAppPassword && config.emailFrom) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: config.emailFrom, pass: config.gmailAppPassword },
        });
        await transporter.sendMail({ from: `"${fromName}" <${config.emailFrom}>`, to: email, subject, html });
        emailSent = true;
      } else {
        emailError = 'Nenhum provedor de email configurado';
      }
    } catch (err: any) {
      emailError = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      console.error('❌ Password reset email failed:', emailError);
    }

    // Log to notificationLogs so it appears in the client's Comunicações tab
    try {
      await db.collection('notificationLogs').add({
        trigger: 'password_reset',
        recipientEmail: email,
        recipientName: displayName || null,
        channels: [emailSent ? 'email:ok' : `email:failed:${(emailError || 'no provider').substring(0, 50)}`],
        message: emailSent
          ? `Link de reset de password enviado para ${email}`
          : `Link gerado mas email falhou: ${emailError || 'sem provedor'}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (logErr) {
      console.error('Failed to log password_reset notification:', logErr);
    }

    return { resetLink, emailSent, emailError };
  });
