/**
 * SCHEDULED CLOUD FUNCTION: Daily Firestore backup to GCS bucket
 *
 * Runs every day at 03:00 Europe/Lisbon (low-traffic window).
 * Exports all Firestore collections to: gs://{projectId}-firestore-backups/{YYYY-MM-DD}
 *
 * Setup (one-time, run in Cloud Shell or locally with gcloud):
 * 1. Create the bucket:
 *    gsutil mb -l europe-west1 gs://realrateme-731f1-firestore-backups
 * 2. Grant the Cloud Functions service account "Cloud Datastore Import Export Admin":
 *    gcloud projects add-iam-policy-binding realrateme-731f1 \
 *      --member=serviceAccount:realrateme-731f1@appspot.gserviceaccount.com \
 *      --role=roles/datastore.importExportAdmin
 * 3. Optional retention (delete files older than 30 days):
 *    gsutil lifecycle set lifecycle.json gs://realrateme-731f1-firestore-backups
 *    (lifecycle.json with rule: { "rule": [{ "action": {"type":"Delete"}, "condition": {"age":30} }] })
 *
 * Restore (if ever needed):
 *   gcloud firestore import gs://realrateme-731f1-firestore-backups/2026-04-26
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'realrateme-731f1';
const BUCKET = `${PROJECT_ID}-firestore-backups`;

export const backupFirestore = functions
  .region('europe-west1')
  .pubsub.schedule('0 3 * * *')
  .timeZone('Europe/Lisbon')
  .onRun(async () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
    const outputUriPrefix = `gs://${BUCKET}/${dateStr}`;

    try {
      // Use admin SDK's credentials to get an access token
      const credential: any = (admin.app() as any).options.credential;
      const tokenObj = credential && typeof credential.getAccessToken === 'function'
        ? await credential.getAccessToken()
        : null;
      const accessToken = tokenObj?.access_token || tokenObj?.token;
      if (!accessToken) throw new Error('Could not obtain access token from admin SDK');

      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputUriPrefix }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Export request failed: ${response.status} ${errText}`);
      }

      const result: any = await response.json();
      console.log('✅ Firestore backup started:', dateStr, 'operation:', result.name);

      // Audit log so admins can track backups via Firestore
      try {
        await admin.firestore().collection('systemLogs').add({
          type: 'firestore_backup',
          status: 'started',
          dateStr,
          outputUriPrefix,
          operation: result.name || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) { /* non-blocking */ }

      return null;
    } catch (err: any) {
      console.error('❌ Firestore backup failed:', err?.message || err);
      try {
        await admin.firestore().collection('systemLogs').add({
          type: 'firestore_backup',
          status: 'failed',
          dateStr,
          error: err?.message || String(err),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) { /* non-blocking */ }
      throw err;
    }
  });
