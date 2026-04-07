# RealRateMe Cloud Functions

Cloud Functions for the RealRateMe platform, handling secure Google Places API integration.

## Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Google Maps API Key

Set your Google Maps API key in Firebase Functions configuration:

```bash
firebase functions:config:set google.maps_api_key="YOUR_GOOGLE_MAPS_API_KEY"
```

To view current config:

```bash
firebase functions:config:get
```

### 3. Build Functions

```bash
npm run build
```

## Available Functions

### `getGooglePlaceReviews`

HTTP Cloud Function that securely fetches Google Place reviews.

**Security:**
- Requires authentication (Firebase ID token)
- Verifies user owns the place
- Only works for verified place owners
- API key stored server-side

**Endpoint:** POST `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/getGooglePlaceReviews`

**Request Body:**
```json
{
  "placeId": "firestore-place-id",
  "googlePlaceId": "ChIJ..."
}
```

**Headers:**
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

**Response:**
```json
{
  "reviews": [...],
  "rating": 4.5,
  "userRatingsTotal": 120
}
```

### `getPlaceClaimStats`

Callable Cloud Function for admin statistics.

**Usage:**
```typescript
const stats = await firebase.functions().httpsCallable('getPlaceClaimStats')();
```

## Deployment

### Deploy All Functions

```bash
npm run deploy
```

### Deploy Specific Function

```bash
firebase deploy --only functions:getGooglePlaceReviews
```

## Local Development

### Run Functions Emulator

```bash
npm run serve
```

This starts the Firebase emulators for local testing.

### Test Functions Locally

Update your `.env` file to use the local emulator:

```
VITE_CLOUD_FUNCTION_URL=http://localhost:5001/YOUR-PROJECT-ID/us-central1/getGooglePlaceReviews
```

## Environment Variables

The frontend needs to know where to call the Cloud Function:

**Production** (`.env.production`):
```
VITE_CLOUD_FUNCTION_URL=https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/getGooglePlaceReviews
```

**Development** (`.env.local`):
```
VITE_CLOUD_FUNCTION_URL=http://localhost:5001/YOUR-PROJECT-ID/us-central1/getGooglePlaceReviews
```

## Logs

View function logs:

```bash
npm run logs
```

Or in Firebase Console:
`https://console.firebase.google.com/project/YOUR-PROJECT-ID/functions/logs`

## Troubleshooting

### CORS Errors

The function uses `cors({ origin: true })` to allow all origins. For production, you may want to restrict this:

```typescript
const corsHandler = cors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com']
});
```

### API Key Not Found

Make sure you've set the API key in Firebase config:

```bash
firebase functions:config:set google.maps_api_key="YOUR_KEY"
```

Then redeploy:

```bash
npm run deploy
```

### Permission Denied

Ensure:
1. User is authenticated
2. User has a professional profile
3. Place is claimed and verified
4. User is the owner of the place

## Cost Considerations

- Google Places API calls have costs
- Each review import triggers one API call
- Monitor usage in Google Cloud Console
- Consider implementing rate limiting for production
