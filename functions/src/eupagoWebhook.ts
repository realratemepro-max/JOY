import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const eupagoWebhook = functions.https.onRequest(async (req, res) => {
  // Apenas aceitar POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const db = admin.firestore();

  try {
    const { identificador, estado, metodo, valor } = req.body;

    console.log('EuPago Webhook received:', {
      identificador,
      estado,
      metodo,
      valor,
    });

    // Encontrar pagamento pelo identificador
    const paymentsQuery = await db
      .collection('payments')
      .where('identifier', '==', identificador)
      .limit(1)
      .get();

    if (paymentsQuery.empty) {
      console.error('Payment not found for identifier:', identificador);
      res.status(404).send('Payment not found');
      return;
    }

    const paymentDoc = paymentsQuery.docs[0];
    const paymentId = paymentDoc.id;
    const payment = paymentDoc.data();

    // Atualizar status do pagamento baseado no webhook
    let newStatus = 'Pending';

    if (estado === 'success' || estado === 'paid') {
      newStatus = 'Paid';
    } else if (estado === 'failed' || estado === 'error') {
      newStatus = 'Failed';
    } else if (estado === 'cancelled') {
      newStatus = 'Cancelled';
    }

    // Atualizar documento de pagamento
    await paymentDoc.ref.update({
      status: newStatus,
      paidAt: newStatus === 'Paid' ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Se pagamento foi bem-sucedido, criar/atualizar subscrição
    if (newStatus === 'Paid') {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // 1 ano de subscrição

      const subscriptionId = payment.userId; // Use userId as subscription doc ID

      // Criar documento de subscrição
      await db.collection('subscriptions').doc(subscriptionId).set({
        userId: payment.userId,
        plan: payment.plan,
        status: 'active',
        startDate: admin.firestore.Timestamp.fromDate(startDate),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        paymentId: paymentId,
        autoRenew: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // NOVO SISTEMA: Se for plano PRO (monthly ou annual), atualizar User document
      if (payment.plan === 'pro' || payment.plan === 'pro-monthly' || payment.plan === 'pro-annual') {
        // Calculate expiry based on billing period
        const expiryDate = new Date(startDate);
        if (payment.plan === 'pro-monthly') {
          expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month
        } else {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year
        }

        await db.collection('users').doc(payment.userId).update({
          plan: 'pro',
          subscriptionId: subscriptionId,
          subscriptionExpiry: admin.firestore.Timestamp.fromDate(expiryDate),
          subscriptionStatus: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log('User upgraded to PRO:', payment.userId, 'Plan:', payment.plan);

        // Send payment confirmation email
        try {
          const userDoc = await db.collection('users').doc(payment.userId).get();
          const userData = userDoc.data();

          if (userData && userData.email) {
            await db.collection('emails').add({
              to: userData.email,
              subject: 'Pagamento Confirmado - RealRateMe PRO',
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #78350f; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
                    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
                    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
                    .detail-label { font-weight: 600; color: #6b7280; }
                    .detail-value { font-weight: 700; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>✓ Pagamento Confirmado!</h1>
                    </div>
                    <div class="content">
                      <p>Olá <strong>${userData.name || 'Cliente'}</strong>,</p>
                      <p>O teu pagamento foi processado com sucesso! A tua subscrição <strong>RealRateMe PRO</strong> está agora ativa.</p>
                      <h3>Detalhes do Pagamento:</h3>
                      <div class="detail-row">
                        <span class="detail-label">Plano:</span>
                        <span class="detail-value">PRO (Anual)</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Valor:</span>
                        <span class="detail-value">€${payment.amount.toFixed(2)}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Método:</span>
                        <span class="detail-value">${payment.method}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Válido até:</span>
                        <span class="detail-value">${expiryDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <h3>O que tens acesso agora:</h3>
                      <ul>
                        <li>✓ Perfis profissionais ilimitados</li>
                        <li>✓ Locais geridos ilimitados</li>
                        <li>✓ Locais de trabalho ilimitados</li>
                        <li>✓ Perguntas personalizadas para reviews</li>
                        <li>✓ Estatísticas avançadas</li>
                        <li>✓ Integração com Google Reviews</li>
                        <li>✓ Suporte prioritário</li>
                      </ul>
                      <p style="text-align: center; margin-top: 30px;">
                        <a href="https://realrateme-731f1.web.app/dashboard" class="button">Ir para o Dashboard</a>
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
              `,
              status: 'pending',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log('Payment confirmation email queued for:', userData.email);
          }
        } catch (emailError) {
          console.error('Error queuing payment email:', emailError);
          // Don't fail the webhook if email fails
        }
      }

      // LEGACY: Suporte para planos antigos (manter compatibilidade)
      // Atualizar plano do usuário (se for professional)
      if (payment.plan.startsWith('professional-')) {
        // Encontrar todos os perfis profissionais do usuário
        const professionalsQuery = await db
          .collection('professionals')
          .where('userId', '==', payment.userId)
          .get();

        // Atualizar plano de todos os perfis
        const planName = payment.plan.replace('professional-', '');
        const batch = db.batch();

        professionalsQuery.docs.forEach((doc) => {
          batch.update(doc.ref, {
            plan: planName,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
      }

      // LEGACY: Se for place owner, atualizar places
      if (payment.plan.startsWith('place-')) {
        // Encontrar User document
        const userDoc = await db.collection('users').doc(payment.userId).get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          const ownedPlaceIds = userData?.ownedPlaceIds || [];

          // Atualizar isPremium de todos os places
          const batch = db.batch();

          ownedPlaceIds.forEach((placeId: string) => {
            const placeRef = db.collection('places').doc(placeId);
            batch.update(placeRef, {
              isPremium: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });

          await batch.commit();
        }
      }

      console.log('Subscription created for user:', payment.userId);
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});
