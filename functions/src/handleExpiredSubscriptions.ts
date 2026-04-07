import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Scheduled function that runs daily to handle expired subscriptions
 * Downgrades users from PRO to FREE and limits their resources
 *
 * Runs every day at 10:00 AM UTC (after expiry warnings)
 */
export const handleExpiredSubscriptions = functions.pubsub
  .schedule('0 10 * * *')
  .timeZone('Europe/Lisbon')
  .onRun(async (context) => {
    const db = admin.firestore();

    try {
      console.log('Running expired subscriptions check...');

      const now = new Date();

      // Get all PRO users with expired subscriptions
      const usersSnapshot = await db
        .collection('users')
        .where('plan', '==', 'pro')
        .get();

      let downgradedUsers = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const expiryDate = userData.subscriptionExpiry?.toDate();

        if (!expiryDate) continue;

        // Check if subscription has expired
        if (expiryDate < now) {
          console.log(`Subscription expired for user ${userDoc.id}. Downgrading to FREE...`);

          // Update user to FREE plan
          await userDoc.ref.update({
            plan: 'free',
            subscriptionStatus: 'expired',
            downgradedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Freeze extra professional profiles (keep only 1 active)
          const professionalsSnapshot = await db
            .collection('professionals')
            .where('userId', '==', userDoc.id)
            .get();

          if (professionalsSnapshot.size > 1) {
            // Keep the first profile active, freeze the rest
            const profiles = professionalsSnapshot.docs;
            for (let i = 1; i < profiles.length; i++) {
              await profiles[i].ref.update({
                isActive: false,
                frozenAt: admin.firestore.FieldValue.serverTimestamp(),
                frozenReason: 'Subscription expired - upgrade to PRO to reactivate',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`  - Froze professional profile ${profiles[i].id}`);
            }
          }

          // Freeze extra managed places (keep only 1 active)
          const placesSnapshot = await db
            .collection('places')
            .where('ownerId', '==', userDoc.id)
            .get();

          if (placesSnapshot.size > 1) {
            // Keep the first place active, freeze the rest
            const places = placesSnapshot.docs;
            for (let i = 1; i < places.length; i++) {
              await places[i].ref.update({
                isFrozen: true,
                frozenAt: admin.firestore.FieldValue.serverTimestamp(),
                frozenReason: 'Subscription expired - upgrade to PRO to reactivate',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`  - Froze place ${places[i].id}`);
            }
          }

          // Note: Workplaces are stored in professional documents, they're already limited
          // by the professional profile freeze above

          // Send downgrade notification email
          const emailContent = {
            to: userData.email,
            subject: 'A tua subscrição PRO expirou - RealRateMe',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
                  .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 10px 10px; }
                  .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
                  .info-box { background: #fef3c7; border-left: 4px solid #fbbf24; padding: 15px; margin: 20px 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Subscrição Expirada</h1>
                  </div>
                  <div class="content">
                    <p>Olá <strong>${userData.name || 'Cliente'}</strong>,</p>

                    <p>A tua subscrição RealRateMe PRO expirou em ${expiryDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>

                    <div class="info-box">
                      <h3 style="margin-top: 0;">A tua conta voltou ao Plano FREE</h3>
                      <p style="margin-bottom: 0;">Algumas funcionalidades foram limitadas:</p>
                    </div>

                    <ul>
                      <li>🔒 Perfis profissionais: limitado a 1 perfil ativo</li>
                      <li>🔒 Locais geridos: limitado a 1 local ativo</li>
                      <li>🔒 Locais de trabalho: limitado a 1 local por perfil</li>
                      <li>🔒 Funcionalidades PRO desativadas</li>
                    </ul>

                    <p><strong>Os teus dados estão seguros!</strong></p>
                    <p>Não eliminámos nada. Todos os teus perfis, locais e reviews continuam guardados. Estão apenas inacessíveis até renovares a subscrição PRO.</p>

                    <p><strong>Queres recuperar o acesso total?</strong></p>
                    <p>Renova a tua subscrição PRO agora e volta a ter acesso imediato a todas as funcionalidades!</p>

                    <p style="text-align: center; margin-top: 30px;">
                      <a href="https://realrateme-731f1.web.app/pricing" class="button">Renovar Subscrição PRO</a>
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

          downgradedUsers++;
          console.log(`User ${userDoc.id} downgraded to FREE`);
        }
      }

      console.log(`Expired subscriptions check complete. ${downgradedUsers} users downgraded.`);
      return { success: true, downgradedUsers };
    } catch (error) {
      console.error('Error handling expired subscriptions:', error);
      throw error;
    }
  });
