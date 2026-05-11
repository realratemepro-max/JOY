import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export async function validatePromoCode(params: {
  code: string;
  planId: string;
  amount: number;
}): Promise<{
  valid: boolean;
  error?: string;
  promoCodeId?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  finalAmount?: number;
}> {
  try {
    const validate = httpsCallable(functions, 'validatePromoCode');
    const result = await validate(params);
    return result.data as any;
  } catch (error: any) {
    console.error('Validate promo code error:', error);
    return { valid: false, error: error.message || 'Erro ao validar código promocional' };
  }
}

export async function applyPromoCode(params: {
  promoCodeId: string;
  paymentId: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
}): Promise<void> {
  try {
    const apply = httpsCallable(functions, 'applyPromoCode');
    await apply(params);
  } catch (error: any) {
    console.error('Apply promo code error:', error);
  }
}
