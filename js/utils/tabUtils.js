// Tab utilities
import { mapUrlToHost, getSupportedHosts } from './hostUtils.js';

/**
 * Groups tabs by their host
 * @param {Array} tabs - Array of tab objects
 * @returns {Promise<Object>} - Object with hosts as keys and tab arrays as values
 */
export async function groupTabsByHost(tabs) {
  const groupedTabs = {};
  const supportedHosts = await getSupportedHosts();

  for (const tab of tabs) {
    try {
      const host = mapUrlToHost(tab.url, supportedHosts);
      
      if (!groupedTabs[host]) {
        groupedTabs[host] = [];
      }
      groupedTabs[host].push(tab);
    } catch (e) {
      console.warn('Error processing tab:', tab.url, e);
    }
  }

  return groupedTabs;
}

/**
 * Activates a specific tab with retry logic for drag operations
 * @param {number} tabId - The ID of the tab to activate
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<void>}
 */
export async function activateTab(tabId, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 300;
  
  try {
    await chrome.tabs.update(tabId, { active: true });
    console.log(`✅ Tab ${tabId} activated successfully`);
  } catch (error) {
    if (error.message.includes('user may be dragging') && retryCount < maxRetries) {
      const delay = baseDelay * (retryCount + 1);
      console.log(`⏳ Tab dragging detected, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return activateTab(tabId, retryCount + 1);
    } else {
      console.error(`❌ Failed to activate tab ${tabId}:`, error.message);
      throw error;
    }
  }
}

/**
 * Removes a specific tab with retry logic for drag operations
 * @param {number} tabId - The ID of the tab to remove
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<boolean>} - Success status
 */
export async function removeTab(tabId, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 300;
  
  try {
    await chrome.tabs.remove(tabId);
    console.log(`✅ Tab ${tabId} removed successfully`);
    return true;
  } catch (error) {
    if (error.message.includes('user may be dragging') && retryCount < maxRetries) {
      const delay = baseDelay * (retryCount + 1);
      console.log(`⏳ Tab dragging detected, retrying removal in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return removeTab(tabId, retryCount + 1);
    } else {
      console.error(`❌ Failed to remove tab ${tabId}:`, error.message);
      throw error;
    }
  }
}

/**
 * Gets all tabs in the current window
 * @returns {Promise<Array>} - Array of tab objects
 */
export function getAllTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({}, resolve);
  });
}

/**
 * Gets the active tab in the current window
 * @returns {Promise<Object|null>} - The active tab object or null
 */
export function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
      resolve(tabs.length > 0 ? tabs[0] : null);
    });
  });
}