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
 * Activates a specific tab
 * @param {number} tabId - The ID of the tab to activate
 */
export function activateTab(tabId) {
  chrome.tabs.update(tabId, { active: true });
}

/**
 * Removes a specific tab
 * @param {number} tabId - The ID of the tab to remove
 * @returns {Promise<boolean>} - Success status
 */
export function removeTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => {
      resolve(true);
    });
  });
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