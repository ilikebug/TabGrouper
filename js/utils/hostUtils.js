// Host processing utilities
import { CONFIG } from '../constants/config.js';

/**
 * Extracts host name from a URL
 * @param {string} url - The URL to extract host from
 * @returns {string} - The extracted host name
 */
export function extractHostFromUrl(url) {
  try {
    const urlObj = new URL(url);
    let host = urlObj.hostname.split('.')[0];
    if (host === 'www') {
      host = urlObj.hostname.split('.')[1];
    }
    return host;
  } catch (e) {
    console.warn('Invalid URL:', url);
    return 'unknown';
  }
}

/**
 * Maps URL to custom host name based on supported hosts configuration
 * @param {string} url - The URL to check
 * @param {Object} supportedHosts - The supported hosts mapping
 * @returns {string} - The mapped host name or extracted host
 */
export function mapUrlToHost(url, supportedHosts = {}) {
  let host = extractHostFromUrl(url);
  
  if (supportedHosts) {
    for (const [key, value] of Object.entries(supportedHosts)) {
      if (url.includes(key)) {
        host = value;
        break;
      }
    }
  }
  
  return host;
}

/**
 * Gets supported hosts from chrome storage
 * @returns {Promise<Object>} - The supported hosts object
 */
export async function getSupportedHosts() {
  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS);
    return result[CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS] || {};
  } catch (error) {
    console.error('Error getting supported hosts:', error);
    return {};
  }
}

/**
 * Saves supported hosts to chrome storage
 * @param {Object} hosts - The hosts object to save
 */
export async function saveSupportedHosts(hosts) {
  try {
    await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS]: hosts });
  } catch (error) {
    console.error('Error saving supported hosts:', error);
  }
}