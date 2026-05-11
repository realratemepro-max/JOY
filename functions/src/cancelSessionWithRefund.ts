/**
 * CLOUD FUNCTION: Cancel session with refund + endDate extension
 *
 * Caller authorization:
 * - Admin (anyone in /admins collection), OR
 * - Linked professor of the session (matches enrolled professor), OR
 * - Replacement professor of the session (if substitute flow)
 *
 * Behavior:
 * - Marks session as 'cancelled' with reason/cancelledBy/cancelledAt
 * - For each enrolled student (status 'enrolled' or 'attended'):
 *   - If enrollment has purchaseId → refund (+1 session) and extend purchase endDate by gracePeriodDays
 *   - If no purchaseId → create a credit valid for 30 + gracePeriodDays
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface CancelRequest {
  sessionId: string;
  reason?: string;          // e.g. 'professor_sick', 'space_unavailable', 'weather', 'other'
  reasonText?: string;      // free text when reason is 'other'
}

export const cancelSessionWithRefund = functions
  .region('europe-west1')
  .https.onCall(async (data: CancelRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
    }
    const callerUid = context.auth.uid;
    const { sessionId, reason, reasonText } = data || ({} as CancelRequest);
    if (!sessionId) {
      throw new functions.https.HttpsError('invalid-argument', 'sessionId é obrigatório');
    }

    // Load session
    const sessionRef = db.collection('sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Aula não encontrada');
    }
    const sessionData = sessionSnap.data()!;

    // Authorization
    const isAdmin = (await db.collection('admins').doc(callerUid).get()).exists;
    let canCancel = isAdmin;
    if (!isAdmin) {
      const professorIds = [sessionData.professorId, sessionData.replacementProfessorId].filter(Boolean);
      for (const profId of professorIds) {
        const profSnap = await db.collection('professors').doc(profId).get();
        if (profSnap.exists && profSnap.data()?.linkedUserId === callerUid) {
          // Check the professor has permission to cancel
          const perms = profSnap.data()?.permissions || {};
          if (perms.canCancelSessions) canCancel = true;
          break;
        }
      }
    }
    if (!canCancel) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para cancelar esta aula');
    }

    // Read grace period from siteConfig
    let gracePeriodDays = 7;
    try {
      const configSnap = await db.collection('siteConfig').doc('main').get();
      if (configSnap.exists) {
        gracePeriodDays = configSnap.data()?.cancellationGracePeriodDays ?? 7;
      }
    } catch (e) { /* default 7 */ }

    const now = new Date();
    const reasonLabel = reason || 'other';
    const reasonFinalText = reasonLabel === 'other' && reasonText ? reasonText : null;

    // Mark session cancelled
    await sessionRef.update({
      status: 'cancelled',
      cancelReason: reasonLabel,
      cancelReasonText: reasonFinalText,
      cancelledBy: isAdmin ? 'admin' : 'professor',
      cancelledByUid: callerUid,
      cancelledAt: admin.firestore.Timestamp.fromDate(now),
      updatedAt: admin.firestore.Timestamp.fromDate(now),
    });

    // Process each enrolled student
    const enrolled = (sessionData.enrolledStudents || []) as any[];
    const refundList: { userId: string; userName: string; refunded: boolean; newEndDate?: Date }[] = [];

    for (const student of enrolled) {
      if (student.status !== 'enrolled' && student.status !== 'attended') continue;

      const purchaseId = student.purchaseId;
      if (purchaseId) {
        try {
          const purchaseRef = db.collection('purchases').doc(purchaseId);
          const purchaseSnap = await purchaseRef.get();
          if (purchaseSnap.exists) {
            const currentEnd = purchaseSnap.data()?.endDate?.toDate() || new Date();
            const newEnd = new Date(currentEnd);
            newEnd.setDate(newEnd.getDate() + gracePeriodDays);
            await purchaseRef.update({
              sessionsUsed: admin.firestore.FieldValue.increment(-1),
              sessionsRemaining: admin.firestore.FieldValue.increment(1),
              endDate: admin.firestore.Timestamp.fromDate(newEnd),
              updatedAt: admin.firestore.Timestamp.fromDate(now),
            });
            refundList.push({ userId: student.userId, userName: student.userName, refunded: true, newEndDate: newEnd });
            continue;
          }
        } catch (e) {
          console.error('Failed to refund purchase', purchaseId, e);
        }
      }

      // Fallback: create a credit valid 30 + grace days
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 30 + gracePeriodDays);
      try {
        await db.collection('credits').add({
          userId: student.userId,
          userName: student.userName,
          type: 'session_return',
          amount: 1,
          reason: `Aula cancelada pelo ${isAdmin ? 'administrador' : 'professor'}: ${reasonLabel}${reasonFinalText ? ' - ' + reasonFinalText : ''}`,
          sessionId,
          sessionDate: sessionData.date || null,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        refundList.push({ userId: student.userId, userName: student.userName, refunded: true, newEndDate: expiresAt });
      } catch (e) {
        console.error('Failed to create credit', e);
        refundList.push({ userId: student.userId, userName: student.userName, refunded: false });
      }
    }

    return {
      success: true,
      sessionId,
      gracePeriodDays,
      refunded: refundList,
      cancelledBy: isAdmin ? 'admin' : 'professor',
    };
  });
