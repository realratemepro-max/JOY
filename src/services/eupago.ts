/**
 * EuPago Payment Integration Service
 * MB WAY + Multibanco payments via Firebase Cloud Functions
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface MbWayPaymentParams {
  planId: string;
  amount: number;
  phoneNumber: string;
  userEmail: string;
  userId: string;
}

export interface MultibancoPaymentParams {
  planId: string;
  amount: number;
  userEmail: string;
  userId: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export interface MultibancoResult extends PaymentResult {
  entity?: string;
  reference?: string;
  expiresAt?: Date;
}

export async function createMbWayPayment(
  params: MbWayPaymentParams
): Promise<PaymentResult> {
  try {
    const createPayment = httpsCallable(functions, 'createMbWayPayment');
    const result = await createPayment({
      planId: params.planId,
      amount: params.amount,
      phone: params.phoneNumber,
      email: params.userEmail,
      userId: params.userId,
    });
    const data = result.data as any;
    if (data.success) {
      return { success: true, paymentId: data.paymentId };
    }
    return { success: false, error: data.error || 'Erro ao processar pagamento MB WAY' };
  } catch (error: any) {
    console.error('MB WAY payment error:', error);
    return { success: false, error: error.message || 'Erro ao processar pagamento MB WAY' };
  }
}

export async function createMultibancoPayment(
  params: MultibancoPaymentParams
): Promise<MultibancoResult> {
  try {
    const createPayment = httpsCallable(functions, 'createMultibancoPayment');
    const result = await createPayment({
      planId: params.planId,
      amount: params.amount,
      email: params.userEmail,
      userId: params.userId,
    });
    const data = result.data as any;
    if (data.success) {
      return {
        success: true,
        paymentId: data.paymentId,
        entity: data.entity,
        reference: data.reference,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      };
    }
    return { success: false, error: data.error || 'Erro ao gerar referência Multibanco' };
  } catch (error: any) {
    console.error('Multibanco payment error:', error);
    return { success: false, error: error.message || 'Erro ao gerar referência Multibanco' };
  }
}

export async function getPaymentStatus(paymentId: string): Promise<{
  status: string;
  error?: string;
}> {
  try {
    const getStatus = httpsCallable(functions, 'getPaymentStatus');
    const result = await getStatus({ paymentId });
    const data = result.data as any;
    return { status: data.status || 'Unknown' };
  } catch (error: any) {
    console.error('Get payment status error:', error);
    return { status: 'Error', error: error.message };
  }
}
