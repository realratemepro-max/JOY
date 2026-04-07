import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function: Update stats when a new review is created
 * Triggered automatically when a review document is created
 * Updates both Professional and Place (if applicable) statistics
 */
export const onReviewCreated = functions.firestore
  .document('reviews/{reviewId}')
  .onCreate(async (snapshot, context) => {
    const review = snapshot.data();
    const reviewId = context.params.reviewId;

    console.log(`Processing new review: ${reviewId}`);

    try {
      const batch = admin.firestore().batch();

      // 1. Update Professional stats
      await updateProfessionalStats(review.professionalId, batch);

      // 2. Update Place stats (if review is attributed to a place)
      if (review.placeId) {
        await updatePlaceStats(review.placeId, batch);
      }

      // Commit all updates
      await batch.commit();

      console.log(`Successfully updated stats for review ${reviewId}`);
    } catch (error) {
      console.error(`Error updating stats for review ${reviewId}:`, error);
      // Don't throw - we don't want to fail the review creation
    }
  });

/**
 * Update professional statistics
 */
async function updateProfessionalStats(professionalId: string, batch: FirebaseFirestore.WriteBatch) {
  const reviewsRef = admin.firestore().collection('reviews');
  const professionalRef = admin.firestore().collection('professionals').doc(professionalId);

  // Query all reviews for this professional
  const reviewsSnapshot = await reviewsRef
    .where('professionalId', '==', professionalId)
    .where('isPublic', '==', true)
    .get();

  if (reviewsSnapshot.empty) {
    return;
  }

  // Calculate stats
  const totalReviews = reviewsSnapshot.size;
  let totalRating = 0;
  let recommendCount = 0;

  reviewsSnapshot.forEach(doc => {
    const review = doc.data();
    totalRating += review.rating || 0;

    // Count recommendations from answers
    const recommendAnswer = review.answers?.find((a: any) =>
      a.questionId === 'recommend' || a.questionText.toLowerCase().includes('recommend')
    );
    if (recommendAnswer?.value === true) {
      recommendCount++;
    }
  });

  const averageRating = totalRating / totalReviews;
  const recommendationRate = (recommendCount / totalReviews) * 100;

  // Update professional document
  batch.update(professionalRef, {
    totalReviews,
    averageRating: Math.round(averageRating * 10) / 10,
    recommendationRate: Math.round(recommendationRate),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`Updated professional ${professionalId}: ${totalReviews} reviews, ${averageRating.toFixed(1)} avg rating`);
}

/**
 * Update place statistics
 */
async function updatePlaceStats(placeId: string, batch: FirebaseFirestore.WriteBatch) {
  const reviewsRef = admin.firestore().collection('reviews');
  const placeRef = admin.firestore().collection('places').doc(placeId);

  // Query all reviews attributed to this place
  const reviewsSnapshot = await reviewsRef
    .where('placeId', '==', placeId)
    .where('isPublic', '==', true)
    .get();

  if (reviewsSnapshot.empty) {
    return;
  }

  // Calculate stats
  const totalReviews = reviewsSnapshot.size;
  let totalRating = 0;

  reviewsSnapshot.forEach(doc => {
    const review = doc.data();
    totalRating += review.rating || 0;
  });

  const averageRating = totalRating / totalReviews;

  // Update place document
  batch.update(placeRef, {
    totalReviews,
    averageRating: Math.round(averageRating * 10) / 10,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`Updated place ${placeId}: ${totalReviews} reviews, ${averageRating.toFixed(1)} avg rating`);
}

/**
 * Cloud Function: Recalculate stats when a review is updated
 */
export const onReviewUpdated = functions.firestore
  .document('reviews/{reviewId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Only recalculate if relevant fields changed
    if (
      beforeData.rating !== afterData.rating ||
      beforeData.isPublic !== afterData.isPublic ||
      beforeData.placeId !== afterData.placeId
    ) {
      const batch = admin.firestore().batch();

      // Update professional stats
      await updateProfessionalStats(afterData.professionalId, batch);

      // Update old place stats if place changed
      if (beforeData.placeId && beforeData.placeId !== afterData.placeId) {
        await updatePlaceStats(beforeData.placeId, batch);
      }

      // Update new place stats
      if (afterData.placeId) {
        await updatePlaceStats(afterData.placeId, batch);
      }

      await batch.commit();
    }
  });

/**
 * Cloud Function: Update stats when a review is deleted
 */
export const onReviewDeleted = functions.firestore
  .document('reviews/{reviewId}')
  .onDelete(async (snapshot, context) => {
    const review = snapshot.data();

    const batch = admin.firestore().batch();

    // Update professional stats
    await updateProfessionalStats(review.professionalId, batch);

    // Update place stats if applicable
    if (review.placeId) {
      await updatePlaceStats(review.placeId, batch);
    }

    await batch.commit();
  });
