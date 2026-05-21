'use strict';

/**
 * Facebook Marketplace scraper stub.
 *
 * Facebook actively blocks automated scraping of Marketplace and requires
 * authenticated browser sessions. Any headless or HTTP-based approach is
 * quickly detected and blocked. A production implementation would require
 * either the official Meta Commerce API (restricted access) or a
 * Playwright/Puppeteer flow with a real logged-in session, which carries
 * significant ToS risk.
 *
 * @param {string[]} keywords
 * @param {number|null} minPrice
 * @param {number|null} maxPrice
 * @returns {Promise<Array>}
 */
async function searchFacebook(keywords, minPrice, maxPrice) {
  console.warn(
    '[facebook] Facebook Marketplace scraping is not supported — ' +
    'FB requires authenticated browser sessions and actively blocks automated access. ' +
    'Returning empty result set.'
  );
  return [];
}

module.exports = { searchFacebook };
