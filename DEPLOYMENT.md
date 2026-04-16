# RealRateMe Deployment Guide

## Prerequisites

1. **Firebase CLI** installed globally:
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Project** created at [Firebase Console](https://console.firebase.google.com/)

3. **Google Maps API Key** with the following APIs enabled:
   - Places API
   - Maps JavaScript API
   - Geocoding API

4. **Anthropic API Key** for AI bio generation

## Initial Setup

### 1. Firebase Login

```bash
firebase login
```

### 2. Initialize Firebase Project

If not already initialized:

```bash
firebase init
```

Select:
- ✅ Firestore
- ✅ Functions
- ✅ Hosting
- ✅ Storage

### 3. Set Firebase Project

```bash
firebase use --add
```

Select your Firebase project and give it an alias (e.g., `production`).

## Cloud Functions Deployment

### 1. Install Function Dependencies

```bash
cd functions
npm install
```

### 2. Configure Google Maps API Key

```bash
firebase functions:config:set google.maps_api_key="YOUR_GOOGLE_MAPS_API_KEY"
```

### 3. Build and Deploy Functions

```bash
npm run build
npm run deploy
```

Or deploy from root:

```bash
firebase deploy --only functions
```

### 4. Get Function URL

After deployment, note the function URL:
```
https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/getGooglePlaceReviews
```

## Frontend Deployment

### 1. Configure Environment Variables

Create `.env.production`:

```env
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_CLOUD_FUNCTION_URL=https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/getGooglePlaceReviews
```

### 2. Build Frontend

```bash
npm run build
```

### 3. Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

## Firestore Setup

### 1. Deploy Firestore Rules

Update `firestore.rules` with your security rules, then:

```bash
firebase deploy --only firestore:rules
```

### 2. Create Indexes

Deploy Firestore indexes:

```bash
firebase deploy --only firestore:indexes
```

### 3. Add Sample Data (Optional)

You can manually add collections in Firebase Console:
- `professionals`
- `places`
- `feedbacks`
- `placeClaims`
- `placeReviews`

## Storage Setup

### 1. Deploy Storage Rules

```bash
firebase deploy --only storage
```

### 2. Configure CORS

If needed, configure CORS for Cloud Storage:

```bash
gsutil cors set cors.json gs://YOUR-PROJECT-ID.appspot.com
```

## Post-Deployment

### 1. Create Admin User

In Firebase Console:
1. Go to Authentication
2. Add a user
3. Get their UID
4. Set custom claim:

```bash
firebase functions:shell
```

Then:

```javascript
admin.auth().setCustomUserClaims('USER_UID', { role: 'admin' })
```

### 2. Test the Deployment

1. Visit your hosting URL
2. Register as a professional
3. Add a workplace
4. Check that the place was created in Firestore
5. Claim a place (if you're a business owner)
6. Upload verification documents
7. As admin, approve the claim
8. Import Google reviews

### 3. Monitor Functions

View logs:

```bash
firebase functions:log
```

Or in Firebase Console:
`https://console.firebase.google.com/project/YOUR-PROJECT/functions/logs`

## Environment-Specific Deployments

### Development

```bash
firebase use development
firebase deploy
```

### Staging

```bash
firebase use staging
firebase deploy
```

### Production

```bash
firebase use production
firebase deploy
```

## Continuous Deployment (Optional)

### Using GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          VITE_GOOGLE_MAPS_API_KEY: ${{ secrets.GOOGLE_MAPS_API_KEY }}
          VITE_CLOUD_FUNCTION_URL: ${{ secrets.CLOUD_FUNCTION_URL }}

      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

Get Firebase token:

```bash
firebase login:ci
```

Add the token to GitHub Secrets as `FIREBASE_TOKEN`.

## Troubleshooting

### Function Not Found

If you get 404 on function calls:
1. Check function is deployed: `firebase functions:list`
2. Verify function name matches in code
3. Check Firebase project ID in URL

### Permission Denied

1. Ensure Firestore rules are deployed
2. Check user is authenticated
3. Verify custom claims are set

### API Key Issues

1. Verify API key is set: `firebase functions:config:get`
2. Check API is enabled in Google Cloud Console
3. Verify billing is enabled

### CORS Errors

1. Cloud Function has CORS enabled by default
2. For Storage, ensure CORS is configured
3. Check browser console for specific errors

## Rollback

To rollback a deployment:

```bash
firebase hosting:rollback
```

For functions, redeploy the previous version or use Firebase Console.

## Costs

Monitor costs in:
- Firebase Console → Usage tab
- Google Cloud Console → Billing

Key cost factors:
- Firebase Hosting: Free tier generous
- Cloud Functions: Pay per invocation
- Firestore: Pay per read/write
- Storage: Pay per GB stored
- Google Places API: Pay per API call

## Support

- Firebase Documentation: https://firebase.google.com/docs
- Firebase Community: https://stackoverflow.com/questions/tagged/firebase
- Google Maps API: https://developers.google.com/maps/documentation
