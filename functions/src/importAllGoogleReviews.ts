import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

// Google Business Profile API endpoints
const GOOGLE_BUSINESS_PROFILE_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const GOOGLE_BUSINESS_INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1';

/**
 * TEST FUNCTION: Import ALL Google reviews using My Business API
 * This function implements pagination and rate limiting to get all reviews
 */
export const importAllGoogleReviewsTest = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes max (enough for pagination with delays)
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
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
        throw new functions.https.HttpsError('not-found', 'Place not found');
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

      // Get the stored Google OAuth access token
      const accessToken = placeData.googleAccessToken;
      if (!accessToken) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No Google access token found. Place must be verified via Google OAuth.'
        );
      }

      const googlePlaceId = placeData.googlePlaceId;

      console.log('Starting full review import for place:', placeId);

      // Helper function to add delay between requests
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Step 1: Get all Google Business accounts
      console.log('Fetching Google Business accounts...');
      await delay(1000); // Wait 1 second before first request

      const accountsResponse = await fetch(`${GOOGLE_BUSINESS_PROFILE_API}/accounts`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error('Failed to fetch accounts:', errorText);

        // Check for rate limiting
        if (accountsResponse.status === 429) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            'Google API rate limit exceeded. Please wait 1 minute and try again.'
          );
        }

        throw new functions.https.HttpsError(
          'internal',
          'Failed to fetch Google Business accounts'
        );
      }

      const accountsData = await accountsResponse.json() as { accounts: any[] };

      if (!accountsData.accounts || accountsData.accounts.length === 0) {
        return {
          success: true,
          imported: 0,
          total: 0,
          message: 'No Google Business accounts found'
        };
      }

      console.log(`Found ${accountsData.accounts.length} accounts`);

      let allReviews: any[] = [];
      let locationFound = false;

      // Step 2: For each account, get locations
      for (const account of accountsData.accounts) {
        console.log('Checking account:', account.name);
        await delay(2000); // Wait 2 seconds between account requests

        const locationsResponse = await fetch(
          `${GOOGLE_BUSINESS_INFO_API}/${account.name}/locations`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!locationsResponse.ok) {
          console.warn('Failed to fetch locations for account:', account.name);
          continue;
        }

        const locationsData = await locationsResponse.json() as { locations: any[] };

        if (!locationsData.locations) continue;

        console.log(`Found ${locationsData.locations.length} locations in account`);

        // Step 3: For each location, get ALL reviews with pagination
        for (const location of locationsData.locations) {
          console.log('Fetching reviews for location:', location.name);
          locationFound = true;

          let pageToken: string | undefined;
          let pageNumber = 1;

          do {
            await delay(3000); // Wait 3 seconds between review requests (conservative)

            const reviewsUrl = pageToken
              ? `${GOOGLE_BUSINESS_INFO_API}/${location.name}/reviews?pageSize=50&pageToken=${pageToken}`
              : `${GOOGLE_BUSINESS_INFO_API}/${location.name}/reviews?pageSize=50`;

            console.log(`Fetching page ${pageNumber}...`);

            const reviewsResponse = await fetch(reviewsUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!reviewsResponse.ok) {
              const errorText = await reviewsResponse.text();
              console.error(`Failed to fetch reviews (page ${pageNumber}):`, errorText);

              if (reviewsResponse.status === 429) {
                console.log('Rate limit hit, waiting 60 seconds...');
                await delay(60000); // Wait 1 minute if rate limited
                continue; // Retry this page
              }
              break; // Skip this location on other errors
            }

            const reviewsData = await reviewsResponse.json() as {
              reviews?: any[];
              nextPageToken?: string;
              totalReviewCount?: number;
              averageRating?: number;
            };

            if (reviewsData.reviews && reviewsData.reviews.length > 0) {
              console.log(`Page ${pageNumber}: Found ${reviewsData.reviews.length} reviews`);
              allReviews = allReviews.concat(reviewsData.reviews);
            }

            pageToken = reviewsData.nextPageToken;
            pageNumber++;

            console.log(`Total reviews so far: ${allReviews.length}`);

          } while (pageToken); // Continue while there are more pages
        }
      }

      if (!locationFound) {
        return {
          success: true,
          imported: 0,
          total: 0,
          message: 'Could not find location in Google Business Profile'
        };
      }

      console.log(`Finished fetching. Total reviews: ${allReviews.length}`);

      if (allReviews.length === 0) {
        return {
          success: true,
          imported: 0,
          total: 0,
          message: 'No reviews found for this business'
        };
      }

      // Step 4: Import reviews to Firestore
      const starRatingToNumber = (rating: string): number => {
        const map: { [key: string]: number } = {
          'STAR_RATING_UNSPECIFIED': 0,
          'ONE': 1,
          'TWO': 2,
          'THREE': 3,
          'FOUR': 4,
          'FIVE': 5,
        };
        return map[rating] || 5;
      };

      let importedCount = 0;

      for (const review of allReviews) {
        const reviewId = `${googlePlaceId}_${review.name}`;

        const reviewRef = admin.firestore().collection('placeReviews').doc(reviewId);
        const existingReview = await reviewRef.get();

        if (!existingReview.exists) {
          await reviewRef.set({
            placeId,
            googlePlaceId,
            authorName: review.reviewer?.displayName || 'Anonymous',
            authorPhoto: review.reviewer?.profilePhotoUrl || null,
            rating: starRatingToNumber(review.starRating),
            text: review.comment || '',
            time: new Date(review.createTime),
            relativeTime: 'Importado',
            language: 'pt',
            importedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          importedCount++;
        }
      }

      // Update place
      await placeRef.update({
        googleReviewsLastSync: admin.firestore.FieldValue.serverTimestamp(),
        googleReviewsCount: allReviews.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        imported: importedCount,
        total: allReviews.length,
        message: `Successfully imported ${importedCount} new reviews (${allReviews.length} total reviews found)`
      };

    } catch (error: any) {
      console.error('Error importing all Google reviews:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        `Failed to import reviews: ${error.message}`
      );
    }
  });
