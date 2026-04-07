import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Fetch place photos from Google Places API
 */
async function fetchGooglePlacePhotos(googlePlaceId: string, apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `${GOOGLE_PLACES_API_URL}?place_id=${googlePlaceId}&fields=photos&key=${apiKey}`
    );

    if (!response.ok) {
      console.warn('Failed to fetch photos from Google Places API');
      return [];
    }

    const data: any = await response.json();

    if (data.status !== 'OK' || !data.result?.photos) {
      console.warn('No photos found for place');
      return [];
    }

    // Convert photo references to full URLs
    const photoUrls = data.result.photos
      .slice(0, 5) // Limit to 5 photos
      .map((photo: any) => {
        const photoRef = photo.photo_reference || photo.reference;
        if (photoRef) {
          return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`;
        }
        return null;
      })
      .filter((url: string | null): url is string => url !== null);

    return photoUrls;
  } catch (error) {
    console.error('Error fetching Google Place photos:', error);
    return [];
  }
}

/**
 * Cloud Function to securely exchange OAuth code for access token
 * CRITICAL: Now creates the place AFTER OAuth verification succeeds
 * This prevents orphaned places and ensures ownerId is set correctly
 */
export const exchangeGoogleOAuthCode = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to exchange OAuth code'
    );
  }

  const { code, placeData } = data;

  if (!code) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required parameter: code'
    );
  }

  // Get OAuth credentials from environment variables or Firebase config
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || functions.config().google?.oauth?.client_id;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || functions.config().google?.oauth?.client_secret;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || functions.config().google?.oauth?.redirect_uri;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Google OAuth credentials not configured in Firebase'
    );
  }

  // Debug logging (don't log client secret)
  console.log('OAuth config check:', {
    clientId: clientId?.substring(0, 20) + '...',
    redirectUri,
    hasClientSecret: !!clientSecret,
  });

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Google token exchange failed:', errorData);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to exchange authorization code: ${errorData}`
      );
    }

    const tokens: TokenResponse = await tokenResponse.json() as TokenResponse;

    // Get Google Maps API key for fetching photos
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || 
                            (functions.config().google?.maps?.api_key as string) ||
                            (functions.config().google?.places?.api_key as string);

    // Fetch photos from Google Places API
    let googlePhotos: string[] = [];
    if (googleMapsApiKey && placeData.googlePlaceId) {
      googlePhotos = await fetchGooglePlacePhotos(placeData.googlePlaceId, googleMapsApiKey);
    }

    // Use Google fetched photos if available, otherwise use photos from placeData
    const finalPhotos = googlePhotos.length > 0 ? googlePhotos : (placeData.photos || []);

    // Note: Users now directly own places via their Firebase Auth UID
    // No separate placeOwner profile is required

    // Check if place already exists
    const placesRef = admin.firestore().collection('places');
    const existingPlaceQuery = await placesRef
      .where('googlePlaceId', '==', placeData.googlePlaceId)
      .get();

    let placeId: string;

    if (!existingPlaceQuery.empty) {
      // Place exists - check if it's already claimed
      const existingPlace = existingPlaceQuery.docs[0];
      const existingPlaceData = existingPlace.data();

      if (existingPlaceData.isClaimed) {
        throw new functions.https.HttpsError(
          'already-exists',
          'This place is already claimed by another user'
        );
      }

      // Update existing place with verification
      placeId = existingPlace.id;
      await placesRef.doc(placeId).update({
        isClaimed: true,
        claimedBy: context.auth.uid,
        claimedByType: 'place_owner',
        ownerId: context.auth.uid, // CRITICAL: Set ownerId to Firebase Auth UID
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationStatus: 'verified',
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationMethod: 'google_business_profile',
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || null,
        googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        photos: finalPhotos,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Create new place with verification already set
      const newPlaceData = {
        googlePlaceId: placeData.googlePlaceId,
        name: placeData.name || '',
        address: placeData.address || '',
        location: placeData.location || null,
        category: placeData.category || 'other',
        photos: finalPhotos,
        isClaimed: true,
        claimedBy: context.auth.uid,
        claimedByType: 'place_owner',
        ownerId: context.auth.uid, // CRITICAL: Set ownerId to Firebase Auth UID from the start
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationStatus: 'verified',
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationMethod: 'google_business_profile',
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || null,
        googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        professionalCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await placesRef.add(newPlaceData);
      placeId = docRef.id;
    }

    return {
      success: true,
      verified: true,
      placeId,
    };
  } catch (error: any) {
    console.error('Error in exchangeGoogleOAuthCode:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `Failed to complete Google OAuth flow: ${error.message}`
    );
  }
});
