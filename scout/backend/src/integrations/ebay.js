'use strict';

require('dotenv').config();
const axios = require('axios');

const EBAY_FINDING_API = 'https://svcs.ebay.com/services/search/FindingService/v1';
const MAX_RESULTS = 20;

/**
 * Search eBay using the Finding API (findItemsAdvanced).
 *
 * @param {string[]} keywords   - Array of keyword strings
 * @param {number|null} minPrice
 * @param {number|null} maxPrice
 * @returns {Promise<Array>}
 */
async function searchEbay(keywords, minPrice, maxPrice) {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) {
    console.warn('[ebay] EBAY_APP_ID not set — skipping');
    return [];
  }

  const keywordString = Array.isArray(keywords) ? keywords.join(' ') : keywords;

  // Build item filters for price range
  const params = new URLSearchParams({
    'OPERATION-NAME': 'findItemsAdvanced',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'keywords': keywordString,
    'paginationInput.entriesPerPage': String(MAX_RESULTS),
  });

  let filterIndex = 0;

  if (minPrice != null) {
    params.append(`itemFilter(${filterIndex}).name`, 'MinPrice');
    params.append(`itemFilter(${filterIndex}).value`, String(minPrice));
    params.append(`itemFilter(${filterIndex}).paramName`, 'Currency');
    params.append(`itemFilter(${filterIndex}).paramValue`, 'USD');
    filterIndex++;
  }

  if (maxPrice != null) {
    params.append(`itemFilter(${filterIndex}).name`, 'MaxPrice');
    params.append(`itemFilter(${filterIndex}).value`, String(maxPrice));
    params.append(`itemFilter(${filterIndex}).paramName`, 'Currency');
    params.append(`itemFilter(${filterIndex}).paramValue`, 'USD');
    filterIndex++;
  }

  try {
    const response = await axios.get(`${EBAY_FINDING_API}?${params.toString()}`, {
      headers: {
        'X-EBAY-SOA-SECURITY-APPNAME': appId,
        'X-EBAY-SOA-OPERATION-NAME': 'findItemsAdvanced',
      },
      timeout: 10000,
    });

    const root = response.data?.findItemsAdvancedResponse?.[0];
    if (!root || root.ack?.[0] !== 'Success') {
      console.warn('[ebay] API returned non-success ack:', root?.ack);
      return [];
    }

    const items = root.searchResult?.[0]?.item ?? [];

    return items.map((item) => {
      const rawPrice = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? '0');
      const galleryURL = item.galleryURL?.[0] ?? null;
      const viewItemURL = item.viewItemURL?.[0] ?? '';
      const seller = item.sellerInfo?.[0]?.sellerUserName?.[0] ?? null;

      return {
        title: item.title?.[0] ?? 'Unknown',
        price: rawPrice || null,
        url: viewItemURL,
        image_url: galleryURL,
        seller,
        marketplace: 'ebay',
      };
    }).filter((item) => item.url); // drop entries with no URL
  } catch (err) {
    console.error('[ebay] Search failed:', err.message);
    return [];
  }
}

module.exports = { searchEbay };
