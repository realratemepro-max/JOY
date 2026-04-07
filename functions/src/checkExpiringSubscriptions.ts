import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Scheduled function that runs daily to check for expiring subscriptions
 * Sends warning emails at:
 * - 30 days before expiry (monthly subscriptions: 7 days)
 * - 14 days before expiry
 * - 1 day before expiry
 *
 * Runs every day at 9:00 AM UTC
 */
export const checkExpiringSubscriptions = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Europe/Lisbon')
  .onRun(async (context) => {
    const db = admin.firestore();

    try {
      console.log('Running expiry check...');

      const now = new Date();

      // Get all PRO users with active subscriptions
      const usersSnapshot = await db
        .collection('users')
        .where('plan', '==', 'pro')
        .where('subscriptionStatus', '==', 'active')
        .get();

      let emailsSent = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const expiryDate = userData.subscriptionExpiry?.toDate();

        if (!expiryDate) continue;

        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Check if we should send a warning
        let shouldSendWarning = false;
        let warningType = '';

        // 1 day warning (both monthly and annual)
        if (daysUntilExpiry === 1 && !userData.warning1DaySent) {
          shouldSendWarning = true;
          warningType = '1day';
        }
        // 7 days warning (monthly subscriptions)
        else if (daysUntilExpiry === 7 && !userData.warning7DaysSent) {
          shouldSendWarning = true;
          warningType = '7days';
        }
        // 14 days warning (annual subscriptions)
        else if (daysUntilExpiry === 14 && !userData.warning14DaysSent) {
          shouldSendWarning = true;
          warningType = '14days';
        }
        // 30 days warning (annual subscriptions)
        else if (daysUntilExpiry === 30 && !userData.warning30DaysSent) {
          shouldSendWarning = true;
          warningType = '30days';
        }

        if (shouldSendWarning) {
          // Send warning email
          const emailContent = {
            to: userData.email,
            subject: `⚠️ A tua subscrição PRO expira em ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'dia' : 'dias'}!`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #fb923c 0%, #f97316 100%); color: #7c2d12; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
                  .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 10px 10px; }
                  .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
                  .warning-box { background: #fef3c7; border: 2px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>⚠️ Aviso de Expiração</h1>
                  </div>
                  <div class="content">
                    <p>Olá <strong>${userData.name || 'Cliente'}</strong>,</p>

                    <div class="warning-box">
                      <h3 style="margin-top: 0;">A tua subscrição PRO expira em ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'dia' : 'dias'}!</h3>
                      <p style="margin-bottom: 0;">Data de expiração: <strong>${expiryDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
                    </div>

                    <p>Para continuares a usufruir de todas as funcionalidades PRO, renova a tua subscrição antes da data de expiração:</p>

                    <ul>
                      <li>✓ Perfis profissionais ilimitados</li>
                      <li>✓ Locais geridos ilimitados</li>
                      <li>✓ Locais de trabalho ilimitados</li>
                      <li>✓ Perguntas personalizadas</li>
                      <li>✓ Estatísticas avançadas</li>
                      <li>✓ E muito mais...</li>
                    </ul>

                    <p><strong>O que acontece se não renovar?</strong></p>
                    <p>Após a expiração, a tua conta voltará ao Plano FREE e algumas funcionalidades serão limitadas. Os teus dados não serão eliminados, apenas ficarão inacessíveis até renovares.</p>

                    <p style="text-align: center; margin-top: 30px;">
                      <a href="https://realrateme-731f1.web.app/pricing" class="button">Renovar Agora</a>
                    </p>
                  </div>
                  <div class="footer">
                    <p>Este é um email automático. Por favor não respondas.</p>
                    <p>RealRateMe - A tua reputação profissional em destaque</p>
                    <p><a href="https://realrateme-731f1.web.app">realrateme.me</a></p>
                  </div>
                </div>
              </body>
              </html>
            `
          };

          // Store email for sending
          await db.collection('emails').add({
            ...emailContent,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Mark warning as sent
          const updateData: any = {};
          updateData[`warning${warningType.replace('days', 'Days').replace('day', 'Day')}Sent`] = true;
          updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

          await userDoc.ref.update(updateData);

          emailsSent++;
          console.log(`Warning email sent to ${userData.email} (${daysUntilExpiry} days until expiry)`);
        }
      }

      console.log(`Expiry check complete. ${emailsSent} warning emails sent.`);
      return { success: true, emailsSent };
    } catch (error) {
      console.error('Error checking expiring subscriptions:', error);
      throw error;
    }
  });
