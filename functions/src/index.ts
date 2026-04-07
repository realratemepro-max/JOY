import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as cors from 'cors';

// Initialize Firebase Admin
admin.initializeApp();

// Export Google OAuth functions
export { exchangeGoogleOAuthCode } from './googleOAuth';

// Export Google Reviews import function
export { importGoogleReviews } from './importGoogleReviews';

// Export EuPago payment functions
export { createMbWayPayment } from './createMbWayPayment';
export { createMultibancoPayment } from './createMultibancoPayment';
export { eupagoWebhook } from './eupagoWebhook';
export { getPaymentStatus } from './getPaymentStatus';

// Export Promo Code functions
export { validatePromoCode, applyPromoCode } from './validatePromoCode';

// Export Image Proxy function
export { proxyImage } from './proxyImage';

// Export Review Stats functions (V2.0)
export { onReviewCreated, onReviewUpdated, onReviewDeleted } from './updateReviewStats';

// Export Subscription Management functions
export { sendPaymentConfirmation } from './sendPaymentEmail';
export { checkExpiringSubscriptions } from './checkExpiringSubscriptions';
export { handleExpiredSubscriptions } from './handleExpiredSubscriptions';
export { manualPaymentUpdate } from './manualPaymentUpdate';

// Initialize CORS middleware
const corsHandler = cors.default({ origin: true });

/**
 * Cloud Function to fetch Google Place Reviews
 *
 * This function acts as a secure proxy to the Google Places API,
 * keeping the API key server-side and avoiding CORS issues.
 *
 * Security:
 * - Only authenticated users can call this function
 * - Only verified place owners can import reviews
 * - API key is stored securely in Firebase environment config
 */
export const getGooglePlaceReviews = functions.https.onRequest(async (req, res) => {
  // Handle CORS
  corsHandler(req, res, async () => {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      // Verify authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      // Get request parameters
      const { googlePlaceId, placeId } = req.body;

      if (!googlePlaceId || !placeId) {
        res.status(400).json({ error: 'Missing required parameters: googlePlaceId and placeId' });
        return;
      }

      // Verify the user is the verified owner of the place
      const placeDoc = await admin.firestore().collection('places').doc(placeId).get();

      if (!placeDoc.exists) {
        res.status(404).json({ error: 'Place not found' });
        return;
      }

      const placeData = placeDoc.data();

      // Check if place is claimed and verified
      if (!placeData?.isClaimed || placeData.verificationStatus !== 'verified') {
        res.status(403).json({ error: 'Place must be claimed and verified to import reviews' });
        return;
      }

      // Check if the user owns this place
      // First, find the professional document for this user
      const professionalSnapshot = await admin
        .firestore()
        .collection('professionals')
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (professionalSnapshot.empty) {
        res.status(403).json({ error: 'No professional profile found' });
        return;
      }

      const professionalId = professionalSnapshot.docs[0].id;

      if (placeData.claimedBy !== professionalId) {
        res.status(403).json({ error: 'You do not own this place' });
        return;
      }

      // Get Google Maps API key from environment config
      const apiKey = functions.config().google?.maps_api_key;

      if (!apiKey) {
        console.error('Google Maps API key not configured');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      // Fetch place details with reviews from Google Places API
      const googleApiUrl = `https://maps.googleapis.com/maps/api/place/details/json`;
      const response = await axios.get(googleApiUrl, {
        params: {
          place_id: googlePlaceId,
          fields: 'reviews,rating,user_ratings_total',
          key: apiKey
        },
        timeout: 10000 // 10 second timeout
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        console.error('Google API error:', response.data.status);
        res.status(500).json({
          error: 'Failed to fetch reviews from Google',
          details: response.data.status
        });
        return;
      }

      // Return the reviews
      res.status(200).json({
        reviews: response.data.result?.reviews || [],
        rating: response.data.result?.rating,
        userRatingsTotal: response.data.result?.user_ratings_total
      });

    } catch (error) {
      console.error('Error in getGooglePlaceReviews:', error);

      if (axios.isAxiosError(error)) {
        res.status(500).json({
          error: 'Failed to fetch from Google API',
          message: error.message
        });
      } else if (error instanceof Error) {
        res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      } else {
        res.status(500).json({ error: 'Unknown error occurred' });
      }
    }
  });
});

/**
 * Cloud Function to get place claim statistics
 * Useful for admin dashboard
 */
export const getPlaceClaimStats = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated and is admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    // Get user's custom claims
    const userRecord = await admin.auth().getUser(context.auth.uid);
    const isAdmin = userRecord.customClaims?.role === 'admin';

    if (!isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'User must be an admin');
    }

    // Get statistics
    const claimsSnapshot = await admin.firestore().collection('placeClaims').get();
    const placesSnapshot = await admin.firestore().collection('places').get();

    const stats = {
      totalPlaces: placesSnapshot.size,
      claimedPlaces: placesSnapshot.docs.filter(doc => doc.data().isClaimed).length,
      pendingClaims: claimsSnapshot.docs.filter(doc => doc.data().status === 'pending').length,
      verifiedClaims: claimsSnapshot.docs.filter(doc => doc.data().status === 'verified').length,
      rejectedClaims: claimsSnapshot.docs.filter(doc => doc.data().status === 'rejected').length,
    };

    return stats;
  } catch (error) {
    console.error('Error getting claim stats:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get statistics');
  }
});
