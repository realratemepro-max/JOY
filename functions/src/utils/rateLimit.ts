/**
 * Simple Firestore-based rate limiter.
 *
 * Uses minute buckets: each (key, identifier) combination has a doc per minute.
 * Counts increment atomically. Old docs are kept (small) but Firestore TTL on
 * `expiresAt` can be enabled by admin to auto-delete after 2 minutes.
 *
 * Usage:
 *   if (!(await checkRateLimit('createMbWay', identifier, 10))) {
 *     throw new functions.https.HttpsError('resource-exhausted', 'Too many requests');
 *   }
 */
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Check + increment a per-minute counter.
 * @param key       Function name or action label (e.g. 'createMbWay')
 * @param identifier Caller fingerprint — typically userId, email or IP
 * @param maxPerMinute Maximum requests allowed per minute
 * @returns true if request is allowed, false if rate limit exceeded
 */
export async function checkRateLimit(key: string, identifier: string, maxPerMinute: number): Promise<boolean> {
  const safeIdentifier = (identifier || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const minute = Math.floor(Date.now() / 60000);
  const docId = `${key}_${safeIdentifier}_${minute}`;
  const docRef = db.collection('rateLimits').doc(docId);

  try {
    return await db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      const count = snap.exists ? (snap.data()?.count || 0) : 0;
      if (count >= maxPerMinute) return false;
      tx.set(docRef, {
        count: count + 1,
        key,
        identifier: safeIdentifier,
        minute,
        // For Firestore TTL (admin can enable on `expiresAt`)
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 120_000)),
      }, { merge: true });
      return true;
    });
  } catch (e) {
    // Fail-open: if rate limiter itself fails, don't block legitimate users
    console.warn('rateLimit check failed for', docId, e);
    return true;
  }
}

/**
 * Helper to extract a request identifier (prefers userId, falls back to IP, then anonymous).
 */
export function getCallerIdentifier(context: any, body?: any): string {
  if (context?.auth?.uid) return `uid:${context.auth.uid}`;
  if (body?.userId) return `uid:${body.userId}`;
  if (body?.email) return `email:${body.email.toLowerCase()}`;
  const ip = context?.rawRequest?.ip
    || context?.rawRequest?.headers?.['x-forwarded-for']
    || context?.rawRequest?.headers?.['fastly-client-ip']
    || 'unknown';
  const ipStr = Array.isArray(ip) ? ip[0] : String(ip).split(',')[0].trim();
  return `ip:${ipStr}`;
}

/**
 * Same as getCallerIdentifier but for onRequest (Express-style req).
 */
export function getReqIdentifier(req: any, fallbackUserId?: string): string {
  if (fallbackUserId) return `uid:${fallbackUserId}`;
  const ip = req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || 'unknown';
  const ipStr = Array.isArray(ip) ? ip[0] : String(ip).split(',')[0].trim();
  return `ip:${ipStr}`;
}
