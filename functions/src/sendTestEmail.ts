/**
 * CLOUD FUNCTION: Send a test email to verify Gmail App Password / Resend config
 *
 * Caller authorization: Admin only
 * Reads notification config from siteConfig/notifications and sends a one-off test email.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendEmail } from './notificationService';
import { checkRateLimit, getCallerIdentifier } from './utils/rateLimit';

const db = admin.firestore();

interface TestEmailRequest {
  to: string;
}

export const sendTestEmail = functions
  .region('europe-west1')
  .https.onCall(async (data: TestEmailRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
    }
    const callerUid = context.auth.uid;
    const isAdmin = (await db.collection('admins').doc(callerUid).get()).exists;
    if (!isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem enviar emails de teste');
    }

    // Rate limit: 5 test emails per minute per admin
    const rlIdentifier = getCallerIdentifier(context, data);
    if (!(await checkRateLimit('sendTestEmail', rlIdentifier, 5))) {
      throw new functions.https.HttpsError('resource-exhausted', 'Demasiados envios de teste. Aguarda 1 minuto.');
    }

    const { to } = data || ({} as TestEmailRequest);
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      throw new functions.https.HttpsError('invalid-argument', 'Email destinatário inválido');
    }

    // Load notification config
    const configSnap = await db.collection('siteConfig').doc('notifications').get();
    if (!configSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Configuração de notificações não encontrada');
    }
    const config = configSnap.data()!;
    if (!config.emailEnabled) {
      throw new functions.https.HttpsError('failed-precondition', 'Email está desativado nas configurações');
    }

    const subject = 'Email de teste - JOY Yoga';
    const body = `Este é um email de teste enviado a partir do CRM do JOY Yoga.

Provedor: ${config.emailProvider || 'gmail'}
Remetente: ${config.emailFromName || 'JOY Yoga'} <${config.emailFrom || '?'}>
Data: ${new Date().toLocaleString('pt-PT')}

Se receberes esta mensagem, a configuração está a funcionar corretamente. ✓`;

    try {
      const ok = await sendEmail(config, to, subject, body);
      if (!ok) {
        throw new functions.https.HttpsError('internal', 'sendEmail retornou false — verificar logs');
      }
      return { success: true, provider: config.emailProvider || 'gmail', to };
    } catch (err: any) {
      console.error('❌ sendTestEmail failed:', err);
      throw new functions.https.HttpsError('internal', err?.message || 'Falha ao enviar email');
    }
  });
