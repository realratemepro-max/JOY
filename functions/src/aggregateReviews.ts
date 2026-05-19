/**
 * Aggregations: keep professor.reviewAvg / professor.reviewCount and
 * location.reviewAvg / location.reviewCount in sync with the testimonials and
 * sessionRatings collections.
 *
 * - Testimonials (tagged professorIds / locationIds) → counted once per entity
 *   ONLY if approved + active.
 * - SessionRatings → counted via stars in aggregation by professorId / locationId.
 *
 * We keep separate counters per source for clarity:
 *   testimonialCount / testimonialAvg
 *   ratingCount / ratingAvg
 * And expose combined:
 *   reviewCount = testimonialCount + ratingCount
 *   reviewAvg = weighted average
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

async function recomputeProfessor(profId: string) {
  const [testSnap, ratingSnap] = await Promise.all([
    db.collection('testimonials')
      .where('taggedProfessorIds', 'array-contains', profId)
      .get(),
    db.collection('sessionRatings')
      .where('professorId', '==', profId)
      .get(),
  ]);

  const testimonials = testSnap.docs
    .map(d => d.data() as any)
    .filter(t => (!t.status || t.status === 'approved') && t.isActive !== false);

  const ratings = ratingSnap.docs
    .map(d => d.data() as any)
    .filter(r => r.status !== 'rejected');

  const tCount = testimonials.length;
  const tSum = testimonials.reduce((acc, t) => acc + (t.rating || 0), 0);
  const rCount = ratings.length;
  const rSum = ratings.reduce((acc, r) => acc + (r.stars || 0), 0);

  const totalCount = tCount + rCount;
  const totalSum = tSum + rSum;
  const avg = totalCount > 0 ? Math.round((totalSum / totalCount) * 10) / 10 : 0;

  await db.collection('professors').doc(profId).update({
    reviewCount: totalCount,
    reviewAvg: avg,
    testimonialCount: tCount,
    ratingCount: rCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }).catch(() => {/* prof may not exist; ignore */});
}

async function recomputeLocation(locId: string) {
  const [testSnap, ratingSnap] = await Promise.all([
    db.collection('testimonials')
      .where('taggedLocationIds', 'array-contains', locId)
      .get(),
    db.collection('sessionRatings')
      .where('locationId', '==', locId)
      .get(),
  ]);

  const testimonials = testSnap.docs
    .map(d => d.data() as any)
    .filter(t => (!t.status || t.status === 'approved') && t.isActive !== false);

  const ratings = ratingSnap.docs
    .map(d => d.data() as any)
    .filter(r => r.status !== 'rejected');

  const tCount = testimonials.length;
  const tSum = testimonials.reduce((acc, t) => acc + (t.rating || 0), 0);
  const rCount = ratings.length;
  const rSum = ratings.reduce((acc, r) => acc + (r.stars || 0), 0);

  const totalCount = tCount + rCount;
  const totalSum = tSum + rSum;
  const avg = totalCount > 0 ? Math.round((totalSum / totalCount) * 10) / 10 : 0;

  await db.collection('locations').doc(locId).update({
    reviewCount: totalCount,
    reviewAvg: avg,
    testimonialCount: tCount,
    ratingCount: rCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }).catch(() => {});
}

export const onTestimonialWritten = functions
  .region('europe-west1')
  .firestore.document('testimonials/{id}')
  .onWrite(async (change, _ctx) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const profIds = new Set<string>([
      ...((before?.taggedProfessorIds as string[]) || []),
      ...((after?.taggedProfessorIds as string[]) || []),
    ]);
    const locIds = new Set<string>([
      ...((before?.taggedLocationIds as string[]) || []),
      ...((after?.taggedLocationIds as string[]) || []),
    ]);
    await Promise.all([
      ...Array.from(profIds).map(id => recomputeProfessor(id)),
      ...Array.from(locIds).map(id => recomputeLocation(id)),
    ]);
  });

export const onSessionRatingWritten = functions
  .region('europe-west1')
  .firestore.document('sessionRatings/{id}')
  .onWrite(async (change, _ctx) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const profIds = new Set<string>();
    const locIds = new Set<string>();
    if (before?.professorId) profIds.add(before.professorId);
    if (after?.professorId)  profIds.add(after.professorId);
    if (before?.locationId)  locIds.add(before.locationId);
    if (after?.locationId)   locIds.add(after.locationId);
    await Promise.all([
      ...Array.from(profIds).map(id => recomputeProfessor(id)),
      ...Array.from(locIds).map(id => recomputeLocation(id)),
    ]);
  });
