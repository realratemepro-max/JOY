import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Send payment confirmation email
 * Called when a payment is successful
 */
export const sendPaymentConfirmation = functions.https.onCall(async (data, context) => {
  const { userEmail, userName, amount, plan, paymentMethod, expiryDate } = data;

  try {
    // TODO: Implement email sending
    // For now, we'll log the email content
    // In production, integrate with SendGrid, Mailgun, or Firebase Extensions Email

    const emailContent = {
      to: userEmail,
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
              <p>Olá <strong>${userName}</strong>,</p>

              <p>O teu pagamento foi processado com sucesso! A tua subscrição <strong>RealRateMe PRO</strong> está agora ativa.</p>

              <h3>Detalhes do Pagamento:</h3>
              <div class="detail-row">
                <span class="detail-label">Plano:</span>
                <span class="detail-value">${plan}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Valor:</span>
                <span class="detail-value">€${amount.toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Método:</span>
                <span class="detail-value">${paymentMethod}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Válido até:</span>
                <span class="detail-value">${new Date(expiryDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
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
      `
    };

    console.log('Payment confirmation email:', emailContent);

    // Store email in Firestore for manual sending or future implementation
    await admin.firestore().collection('emails').add({
      ...emailContent,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: 'Email queued for sending' };
  } catch (error: any) {
    console.error('Error sending payment email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send payment confirmation');
  }
});
