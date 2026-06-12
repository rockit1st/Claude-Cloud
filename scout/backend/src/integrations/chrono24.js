'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.chrono24.com/search/index.htm';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Parse a price string like "$1,234" or "1.234 $" into a number.
 * Returns null if parsing fails.
 * @param {string} raw
 * @returns {number|null}
 */
function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Scrape Chrono24 search results.
 *
 * @param {string[]} keywords
 * @param {number|null} minPrice
 * @param {number|null} maxPrice
 * @returns {Promise<Array>}
 */
async function searchChrono24(keywords, minPrice, maxPrice) {
  const keywordString = Array.isArray(keywords) ? keywords.join(' ') : keywords;

  const params = {
    query: keywordString,
    sortorder: '1', // newest first
  };
  if (minPrice != null) params.priceFrom = String(Math.floor(minPrice));
  if (maxPrice != null) params.priceTo = String(Math.ceil(maxPrice));

  try {
    const response = await axios.get(BASE_URL, {
      params,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const results = [];

    // Chrono24 listing cards — selectors may need updating if site structure changes
    $('article.article-item, [class*="article-item"], .js-article-item').each((_, el) => {
      const $el = $(el);

      const title =
        $el.find('[class*="article-title"], .article-title').first().text().trim() ||
        $el.find('h2, h3').first().text().trim();

      const priceRaw =
        $el.find('[class*="price"], .price').first().text().trim();

      const price = parsePrice(priceRaw);

      const relativeHref =
        $el.find('a[href]').first().attr('href') || '';
      const url = relativeHref.startsWith('http')
        ? relativeHref
        : relativeHref
        ? `https://www.chrono24.com${relativeHref}`
        : null;

      const imageEl = $el.find('img').first();
      const image_url =
        imageEl.attr('data-src') ||
        imageEl.attr('src') ||
        null;

      const seller =
        $el.find('[class*="seller"], .seller-name').first().text().trim() || null;

      if (!title || !url) return; // skip incomplete cards

      results.push({
        title,
        price,
        url,
        image_url: image_url && !image_url.startsWith('data:') ? image_url : null,
        seller,
        marketplace: 'chrono24',
      });
    });

    return results;
  } catch (err) {
    console.error('[chrono24] Scraping failed:', err.message);
    return [];
  }
}

module.exports = { searchChrono24 };
