/**
 * CLOUD FUNCTION: Substitute the professor of a session
 *
 * Caller authorization:
 * - Admin (any user in /admins), OR
 * - The session's currently-assigned professor (with permissions.canSubstituteSession === true)
 *
 * Behavior:
 * - Verifies caller authorization
 * - Loads the new professor (must exist and be active)
 * - Marks session as 'replaced' with replacementProfessorId/Name
 * - Marks each enrolled student with replacementResponse: 'pending'
 * - Notification trigger handles emailing students about the substitution
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface SubstituteRequest {
  sessionId: string;
  replacementProfessorId: string;
  reason?: string;
  reasonText?: string;
}

export const substituteSessionProfessor = functions
  .region('europe-west1')
  .https.onCall(async (data: SubstituteRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
    }
    const callerUid = context.auth.uid;
    const { sessionId, replacementProfessorId, reason, reasonText } = data || ({} as SubstituteRequest);
    if (!sessionId) {
      throw new functions.https.HttpsError('invalid-argument', 'sessionId é obrigatório');
    }
    if (!replacementProfessorId) {
      throw new functions.https.HttpsError('invalid-argument', 'replacementProfessorId é obrigatório');
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
    let canSubstitute = isAdmin;
    if (!isAdmin) {
      const currentProfId = sessionData.professorId;
      if (currentProfId) {
        const profSnap = await db.collection('professors').doc(currentProfId).get();
        if (profSnap.exists && profSnap.data()?.linkedUserId === callerUid) {
          const perms = profSnap.data()?.permissions || {};
          if (perms.canSubstituteSession) canSubstitute = true;
        }
      }
    }
    if (!canSubstitute) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para substituir o professor desta aula');
    }

    // Load replacement professor
    const newProfSnap = await db.collection('professors').doc(replacementProfessorId).get();
    if (!newProfSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Professor substituto não encontrado');
    }
    const newProf = newProfSnap.data()!;
    if (newProf.isActive === false) {
      throw new functions.https.HttpsError('failed-precondition', 'Professor substituto não está ativo');
    }
    if (replacementProfessorId === sessionData.professorId) {
      throw new functions.https.HttpsError('invalid-argument', 'Não podes substituir pelo mesmo professor');
    }

    const now = new Date();

    // Mark all enrolled students as pending response
    const enrolled = (sessionData.enrolledStudents || []) as any[];
    const updatedStudents = enrolled.map(s => ({ ...s, replacementResponse: 'pending' }));

    await sessionRef.update({
      status: 'replaced',
      cancelReason: reason || null,
      cancelReasonText: reason === 'other' && reasonText ? reasonText : null,
      replacementProfessorId,
      replacementProfessorName: newProf.name || '',
      cancelledByUid: callerUid,
      cancelledAt: admin.firestore.Timestamp.fromDate(now),
      enrolledStudents: updatedStudents,
      updatedAt: admin.firestore.Timestamp.fromDate(now),
    });

    return {
      success: true,
      sessionId,
      replacementProfessorId,
      replacementProfessorName: newProf.name,
      studentsNotified: updatedStudents.length,
      cancelledBy: isAdmin ? 'admin' : 'professor',
    };
  });
