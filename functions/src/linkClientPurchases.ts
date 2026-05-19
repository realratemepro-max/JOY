/**
 * Admin-triggered: link all purchases for a given email to that user's current uid.
 * Fixes "orphan purchases" where the client paid as guest before having an account,
 * so userId on the purchase doesn't match their auth uid.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const linkClientPurchases = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Não autenticado.');
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas administradores.');
    }

    const { email: rawEmail } = data as { email: string };
    if (!rawEmail) throw new functions.https.HttpsError('invalid-argument', 'Email é obrigatório.');
    const email = String(rawEmail).trim().toLowerCase();

    let userUid: string;
    try {
      const u = await admin.auth().getUserByEmail(email);
      userUid = u.uid;
    } catch {
      throw new functions.https.HttpsError('not-found', 'Não existe nenhuma conta com este email.');
    }

    const db = admin.firestore();
    const snap = await db.collection('purchases').where('userEmail', '==', email).get();

    let linked = 0;
    let alreadyOk = 0;
    const batch = db.batch();
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.userId === userUid) {
        alreadyOk++;
      } else {
        batch.update(d.ref, { userId: userUid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        linked++;
      }
    });
    if (linked > 0) await batch.commit();

    return { linked, alreadyOk, totalFound: snap.size, uid: userUid };
  });
