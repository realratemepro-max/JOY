import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

/**
 * Cloud Function to import Google reviews for a verified place
 *
 * Uses Google Places API to fetch up to 5 reviews (selected by Google's relevance algorithm)
 * This is more reliable than My Business API which has strict rate limits
 */
export const importGoogleReviews = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to import reviews'
    );
  }

  const { placeId } = data;

  if (!placeId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required parameter: placeId'
    );
  }

  try {
    // Get place from Firestore
    const placeRef = admin.firestore().collection('places').doc(placeId);
    const placeDoc = await placeRef.get();

    if (!placeDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Place not found'
      );
    }

    const placeData = placeDoc.data();

    // Verify user owns this place
    if (placeData?.ownerId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to import reviews for this place'
      );
    }

    // Verify place is verified
    if (placeData?.verificationStatus !== 'verified') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Place must be verified before importing reviews'
      );
    }

    // WORKAROUND: Use Google Places API instead of My Business API
    // The My Business API has extremely strict rate limits (429 errors)
    // Google Places API has better limits and we already have the API key configured
    const googlePlaceId = placeData.googlePlaceId;

    if (!googlePlaceId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No Google Place ID found for this place'
      );
    }

    // Get Google Places API key
    const placesApiKey = process.env.GOOGLE_PLACES_API_KEY || functions.config().google?.places_api_key;

    if (!placesApiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Google Places API key not configured'
      );
    }

    // Fetch place details with reviews from Google Places API
    const placesApiUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
    const response = await fetch(`${placesApiUrl}?place_id=${googlePlaceId}&fields=reviews,rating,user_ratings_total&key=${placesApiKey}`);

    if (!response.ok) {
      throw new functions.https.HttpsError(
        'internal',
        'Failed to fetch from Google Places API'
      );
    }

    const placesData = await response.json() as any;

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', placesData.status);
      throw new functions.https.HttpsError(
        'internal',
        `Google Places API error: ${placesData.status}`
      );
    }

    const result = placesData.result || {};
    const allReviews = result.reviews || [];
    const averageRating = result.rating || 0;
    const totalReviewCount = result.user_ratings_total || 0;

    if (allReviews.length === 0) {
      return {
        success: true,
        imported: 0,
        message: 'No reviews found for this business'
      };
    }

    let importedCount = 0;

    // Import each review (Google Places API format)
    for (const review of allReviews) {
      // Use author_name + time as unique identifier (Places API doesn't provide review ID)
      const reviewId = `${googlePlaceId}_${review.author_name}_${review.time}`;

      // Check if review already exists
      const reviewRef = admin.firestore().collection('placeReviews').doc(reviewId);
      const existingReview = await reviewRef.get();

      const now = admin.firestore.FieldValue.serverTimestamp();
      const reviewTime = new Date(review.time * 1000);

      if (!existingReview.exists) {
        // Create new review
        await reviewRef.set({
          placeId,
          googlePlaceId,
          authorName: review.author_name,
          authorPhoto: review.profile_photo_url || null,
          rating: review.rating,
          text: review.text || '',
          time: reviewTime,
          relativeTime: review.relative_time_description || 'Recentemente',
          language: review.language || 'pt',
          importedAt: now,
          lastSyncedAt: now,
        });
        importedCount++;
      }
    }

    // Update place with Google rating info
    await placeRef.update({
      googleReviewsLastSync: admin.firestore.FieldValue.serverTimestamp(),
      googleReviewsCount: allReviews.length,
      googleRating: averageRating || null,
      googleReviewCount: totalReviewCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      imported: importedCount,
      total: allReviews.length,
      message: `Imported ${importedCount} new reviews (${allReviews.length} total reviews found)`
    };

  } catch (error: any) {
    console.error('Error importing Google reviews:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `Failed to import Google reviews: ${error.message}`
    );
  }
});
