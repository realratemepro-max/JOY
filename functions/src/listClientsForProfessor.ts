/**
 * CLOUD FUNCTION: List clients available to add to a session.
 *
 * Caller authorization:
 * - Admin (anyone in /admins), OR
 * - Linked professor with canAddStudentsToSession permission
 *
 * Returns minimal info (id, name, email) — no phone, address, injuries, etc.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const listClientsForProfessor = functions
  .region('europe-west1')
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
    }
    const callerUid = context.auth.uid;

    // Authorization
    const isAdmin = (await db.collection('admins').doc(callerUid).get()).exists;
    let isProfessor = false;
    if (!isAdmin) {
      const profsSnap = await db.collection('professors')
        .where('linkedUserId', '==', callerUid)
        .limit(1)
        .get();
      if (!profsSnap.empty) {
        const perms = profsSnap.docs[0].data()?.permissions || {};
        if (perms.canAddStudentsToSession || perms.canMarkAttendance) isProfessor = true;
      }
    }
    if (!isAdmin && !isProfessor) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão');
    }

    // Load users (clients only)
    const usersSnap = await db.collection('users').orderBy('name').get();
    const clients = usersSnap.docs
      .filter(d => {
        const role = d.data()?.role;
        return role === 'client' || !role; // include legacy without role
      })
      .map(d => ({
        id: d.id,
        name: d.data()?.name || d.data()?.email || '?',
        email: d.data()?.email || '',
      }));

    return { clients };
  });
