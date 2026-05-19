/**
 * One-off admin migration: lowercase all email fields across collections so that
 * lookups by email work consistently regardless of how the user typed their email
 * originally. Safe to run multiple times — only updates docs whose email differs
 * from its lowercase form.
 *
 * Scans:
 *  - users.email
 *  - clients.email
 *  - professors.linkedEmail
 *  - purchases.userEmail
 *  - payments.userEmail
 *  - notificationLogs.recipientEmail
 *
 * Returns a per-collection breakdown of how many docs were updated.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface FieldSpec {
  collection: string;
  field: string;
}

const TARGETS: FieldSpec[] = [
  { collection: 'users', field: 'email' },
  { collection: 'clients', field: 'email' },
  { collection: 'professors', field: 'linkedEmail' },
  { collection: 'purchases', field: 'userEmail' },
  { collection: 'payments', field: 'userEmail' },
  { collection: 'payments', field: 'customerEmail' },
  { collection: 'notificationLogs', field: 'recipientEmail' },
];

export const normalizeEmailsCase = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 300 })
  .https.onCall(async (_data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Não autenticado.');
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas administradores.');
    }

    const results: Record<string, { scanned: number; updated: number; field: string }> = {};

    for (const t of TARGETS) {
      const snap = await db.collection(t.collection).get();
      let updated = 0;
      // Chunk into batches of 400 ops
      for (let i = 0; i < snap.docs.length; i += 400) {
        const chunk = snap.docs.slice(i, i + 400);
        const batch = db.batch();
        let batchHasChanges = false;
        for (const d of chunk) {
          const data = d.data() as Record<string, any>;
          const value = data[t.field];
          if (typeof value === 'string' && value !== value.trim().toLowerCase()) {
            batch.update(d.ref, { [t.field]: value.trim().toLowerCase(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            updated++;
            batchHasChanges = true;
          }
        }
        if (batchHasChanges) await batch.commit();
      }
      const key = `${t.collection}.${t.field}`;
      results[key] = { scanned: snap.size, updated, field: t.field };
      console.log(`📧 ${key}: ${updated}/${snap.size} updated`);
    }

    // Backfill: payments and purchases missing userEmail — look up via users.{userId}
    const payMissing = await db.collection('payments').get();
    let payBackfilled = 0;
    for (let i = 0; i < payMissing.docs.length; i += 200) {
      const chunk = payMissing.docs.slice(i, i + 200);
      const batch = db.batch();
      let dirty = false;
      for (const d of chunk) {
        const data = d.data() as any;
        if ((!data.userEmail || data.userEmail === '') && data.userId) {
          try {
            const u = await db.collection('users').doc(data.userId).get();
            if (u.exists && u.data()?.email) {
              batch.update(d.ref, {
                userEmail: String(u.data()!.email).trim().toLowerCase(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              payBackfilled++;
              dirty = true;
            }
          } catch (e) { /* skip */ }
        }
      }
      if (dirty) await batch.commit();
    }
    results['payments.userEmail (backfill)'] = { scanned: payMissing.size, updated: payBackfilled, field: 'userEmail' };
    console.log(`💳 payments backfilled: ${payBackfilled}/${payMissing.size}`);

    return { ok: true, results };
  });
