'use strict';

require('dotenv').config();
const axios = require('axios');

const SUBREDDITS = [
  'watchexchange',
  'hardwareswap',
  'mechmarket',
  'knife_swap',
  'pen_swap',
  'gameswap',
  'AVexchange',
  'Leathergoods',
  'GunAccessoriesForSale',
  'cycling',
  'Flipping',
  'thriftstorehauls',
].join('+');

// Cached OAuth token
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Obtain a Reddit OAuth2 client_credentials token.
 * Caches the token until it expires.
 */
async function getRedditToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT || 'ScoutApp/1.0';

  if (!clientId || !clientSecret) {
    throw new Error('REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET not set');
  }

  const response = await axios.post(
    'https://www.reddit.com/api/v1/access_token',
    'grant_type=client_credentials',
    {
      auth: { username: clientId, password: clientSecret },
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    }
  );

  cachedToken = response.data.access_token;
  // Subtract 30s buffer from expires_in
  tokenExpiry = now + (response.data.expires_in - 30) * 1000;

  return cachedToken;
}

/**
 * Attempt to extract a price (USD) from a Reddit post title.
 * Returns null if no price found.
 * @param {string} title
 * @returns {number|null}
 */
function parsePriceFromTitle(title) {
  // Match patterns like $120, $1,200, $1200.00
  const match = title.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/,/g, ''));
  return isNaN(value) ? null : value;
}

/**
 * Search buy/sell subreddits on Reddit.
 *
 * @param {string[]} keywords
 * @param {number|null} minPrice
 * @param {number|null} maxPrice
 * @returns {Promise<Array>}
 */
async function searchReddit(keywords, minPrice, maxPrice) {
  const clientId = process.env.REDDIT_CLIENT_ID;
  if (!clientId) {
    console.warn('[reddit] REDDIT_CLIENT_ID not set — skipping');
    return [];
  }

  const userAgent = process.env.REDDIT_USER_AGENT || 'ScoutApp/1.0';
  const keywordString = Array.isArray(keywords) ? keywords.join(' ') : keywords;

  try {
    const token = await getRedditToken();

    const response = await axios.get(
      `https://oauth.reddit.com/r/${SUBREDDITS}/search`,
      {
        params: {
          q: keywordString,
          sort: 'new',
          limit: 25,
          restrict_sr: true,
          t: 'day',
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': userAgent,
        },
        timeout: 10000,
      }
    );

    const posts = response.data?.data?.children ?? [];

    const results = [];

    for (const child of posts) {
      const post = child.data;
      const title = post.title ?? '';

      // Only include posts that look like buy/sell (have a $ price)
      if (!title.includes('$')) continue;

      const price = parsePriceFromTitle(title);

      // Apply price bounds filter
      if (minPrice != null && (price == null || price < minPrice)) continue;
      if (maxPrice != null && (price == null || price > maxPrice)) continue;

      // Grab image — prefer preview image, fall back to thumbnail
      let imageUrl = null;
      const preview = post.preview?.images?.[0]?.source?.url;
      if (preview) {
        // Reddit encodes & as &amp; in JSON sometimes
        imageUrl = preview.replace(/&amp;/g, '&');
      } else if (post.thumbnail && post.thumbnail.startsWith('http')) {
        imageUrl = post.thumbnail;
      }

      results.push({
        title,
        price,
        url: `https://www.reddit.com${post.permalink}`,
        image_url: imageUrl,
        seller: post.author ?? null,
        description: post.selftext ? post.selftext.slice(0, 500) : null,
        marketplace: 'reddit',
      });
    }

    return results;
  } catch (err) {
    console.error('[reddit] Search failed:', err.message);
    return [];
  }
}

module.exports = { searchReddit };
