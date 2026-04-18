/**
 * EuPago Payment Service
 * MB WAY + Multibanco via Cloud Functions (onRequest)
 * Adapted from myimomatepro for JOY
 */

const FUNCTIONS_URL = 'https://us-central1-realrateme-731f1.cloudfunctions.net';

export interface MbWayPaymentParams {
  planId: string;
  planName?: string;
  amount: number;
  phoneNumber: string;
  userEmail: string;
  userId: string;
  type?: 'plan_subscription' | 'event_booking' | 'single_class';
}

export interface MultibancoPaymentParams {
  planId: string;
  planName?: string;
  amount: number;
  userEmail: string;
  userId: string;
  type?: 'plan_subscription' | 'event_booking' | 'single_class';
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  error?: string;
}

export interface MultibancoResult extends PaymentResult {
  entity?: string;
  reference?: string;
}

export async function createMbWayPayment(params: MbWayPaymentParams): Promise<PaymentResult> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/createMbWayPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: params.userId,
        amount: params.amount,
        phone: params.phoneNumber,
        email: params.userEmail,
        planId: params.planId,
        planName: params.planName || '',
        type: params.type || 'plan_subscription',
      }),
    });
    const data = await response.json();
    if (data.success) {
      return { success: true, paymentId: data.paymentId, transactionId: data.transactionId };
    }
    return { success: false, error: data.error || 'Erro ao processar pagamento MB WAY' };
  } catch (error: any) {
    console.error('MB WAY error:', error);
    return { success: false, error: error.message || 'Erro ao processar pagamento' };
  }
}

export async function createMultibancoPayment(params: MultibancoPaymentParams): Promise<MultibancoResult> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/createMultibancoPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: params.userId,
        amount: params.amount,
        customerEmail: params.userEmail,
        planId: params.planId,
        planName: params.planName || '',
        type: params.type || 'plan_subscription',
      }),
    });
    const data = await response.json();
    if (data.success) {
      return { success: true, paymentId: data.paymentId, entity: data.entity, reference: data.reference };
    }
    return { success: false, error: data.error || 'Erro ao gerar referência Multibanco' };
  } catch (error: any) {
    console.error('Multibanco error:', error);
    return { success: false, error: error.message || 'Erro ao gerar referência' };
  }
}

export async function getPaymentStatus(paymentId: string): Promise<{ status: string; error?: string }> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/getPaymentStatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
    const data = await response.json();
    return { status: data.status || 'Unknown' };
  } catch (error: any) {
    return { status: 'Error', error: error.message };
  }
}
