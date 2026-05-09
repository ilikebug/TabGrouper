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
 * Checks whether a hostname matches a supported host key exactly or as a subdomain.
 * @param {string} hostname - The hostname to check.
 * @param {string} supportedHost - The supported host key.
 * @returns {boolean} - True when the hostname belongs to the supported host.
 */
export function hostnameMatches(hostname, supportedHost) {
  if (!hostname || !supportedHost) {
    return false;
  }

  const normalizedHostname = hostname.toLowerCase();
  const parsedSupportedHost = parseSupportedHostKey(supportedHost);
  if (!parsedSupportedHost) {
    return false;
  }
  const normalizedSupportedHost = parsedSupportedHost.hostname;

  return normalizedHostname === normalizedSupportedHost ||
    normalizedHostname.endsWith(`.${normalizedSupportedHost}`);
}

function normalizePathname(pathname) {
  let normalizedPathname = pathname || '/';
  if (!normalizedPathname.startsWith('/')) {
    normalizedPathname = `/${normalizedPathname}`;
  }

  while (normalizedPathname.length > 1 && normalizedPathname.endsWith('/')) {
    normalizedPathname = normalizedPathname.slice(0, -1);
  }

  return normalizedPathname;
}

function parseSupportedHostKey(supportedHost) {
  const key = String(supportedHost || '').trim();
  if (!key) {
    return null;
  }

  const candidate = key.startsWith('//')
    ? `https:${key}`
    : key.includes('://')
      ? key
      : `https://${key}`;

  try {
    const url = new URL(candidate);
    const pathname = normalizePathname(url.pathname);
    return {
      hostname: url.hostname.toLowerCase(),
      pathname: pathname === '/' ? '' : pathname
    };
  } catch (e) {
    return {
      hostname: key.toLowerCase(),
      pathname: ''
    };
  }
}

function pathnameMatches(pathname, supportedPathname) {
  if (!supportedPathname) {
    return true;
  }

  const normalizedPathname = normalizePathname(pathname);
  return normalizedPathname === supportedPathname ||
    normalizedPathname.startsWith(`${supportedPathname}/`);
}

function hostMappingMatches(urlObj, supportedHost) {
  const parsedSupportedHost = parseSupportedHostKey(supportedHost);
  if (!parsedSupportedHost) {
    return false;
  }

  return hostnameMatches(urlObj.hostname, parsedSupportedHost.hostname) &&
    pathnameMatches(urlObj.pathname, parsedSupportedHost.pathname);
}

function getHostMappingSpecificity(supportedHost) {
  const parsedSupportedHost = parseSupportedHostKey(supportedHost);
  if (!parsedSupportedHost) {
    return 0;
  }

  return parsedSupportedHost.hostname.length + parsedSupportedHost.pathname.length;
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
    let urlObj = null;
    try {
      urlObj = new URL(url);
    } catch (e) {
      urlObj = null;
    }

    if (urlObj) {
      const entries = Object.entries(supportedHosts)
        .sort(([a], [b]) => getHostMappingSpecificity(b) - getHostMappingSpecificity(a));

      for (const [key, value] of entries) {
        if (hostMappingMatches(urlObj, key)) {
          host = value;
          break;
        }
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
