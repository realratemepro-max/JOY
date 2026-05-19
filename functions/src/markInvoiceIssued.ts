/**
 * Admin marks a payment as having an invoice issued externally (e.g. via
 * Word / accountant). Auto-assigns the next sequential invoice number from
 * a counter doc (invoiceCounter/main).
 *
 * If admin wants to UNMARK (rollback), pass action='unmark'.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const markInvoiceIssued = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Não autenticado.');
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) throw new functions.https.HttpsError('permission-denied', 'Apenas administradores.');

    const { paymentId, action, manualNumber } = data as { paymentId: string; action?: 'mark' | 'unmark'; manualNumber?: string };
    if (!paymentId) throw new functions.https.HttpsError('invalid-argument', 'paymentId obrigatório.');

    const paymentRef = db.collection('payments').doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) throw new functions.https.HttpsError('not-found', 'Pagamento não encontrado.');

    if (action === 'unmark') {
      await paymentRef.update({
        invoiceStatus: 'pending',
        invoiceNumber: admin.firestore.FieldValue.delete(),
        invoiceIssuedAt: admin.firestore.FieldValue.delete(),
        invoiceIssuedBy: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ok: true, action: 'unmarked' };
    }

    // Atomic: increment counter and assign number (or use manualNumber if given)
    let assignedNumber: string;
    if (manualNumber && String(manualNumber).trim()) {
      assignedNumber = String(manualNumber).trim();
    } else {
      const counterRef = db.collection('invoiceCounter').doc('main');
      assignedNumber = await db.runTransaction(async tx => {
        const snap = await tx.get(counterRef);
        const data = snap.exists ? snap.data() || {} : {};
        const current = Number(data.lastNumber || 0);
        const next = current + 1;
        const prefix = String(data.prefix || 'FR');
        const year = new Date().getFullYear();
        const padded = String(next).padStart(4, '0');
        const number = `${prefix} ${year}/${padded}`;
        tx.set(counterRef, { lastNumber: next, prefix, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return number;
      });
    }

    await paymentRef.update({
      invoiceStatus: 'issued',
      invoiceNumber: assignedNumber,
      invoiceIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
      invoiceIssuedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true, invoiceNumber: assignedNumber };
  });
