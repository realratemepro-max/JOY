import * as functions from 'firebase-functions';
import * as cors from 'cors';
import axios from 'axios';

// Initialize CORS middleware - allow all origins for image proxy
const corsHandler = cors.default({ origin: true });

/**
 * Cloud Function to proxy Firebase Storage images with CORS headers
 *
 * This solves the CORS issue when loading images into canvas elements
 * for the QR card designer feature.
 */
export const proxyImage = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // Get image URL from query parameter
      const imageUrl = req.query.url as string;

      if (!imageUrl) {
        res.status(400).json({ error: 'Missing url parameter' });
        return;
      }

      // Verify it's a Firebase Storage URL for security
      if (!imageUrl.includes('firebasestorage.googleapis.com')) {
        res.status(403).json({ error: 'Invalid image URL' });
        return;
      }

      // Fetch the image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'image/*'
        }
      });

      // Get content type from original response
      const contentType = response.headers['content-type'] || 'image/jpeg';

      // Set CORS headers and content type
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=3600');

      // Send the image data
      res.send(Buffer.from(response.data));
    } catch (error) {
      console.error('Error proxying image:', error);
      res.status(500).json({ error: 'Failed to load image' });
    }
  });
});
