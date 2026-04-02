// Service worker for TabGrouper
importScripts('search-ui.js');
console.log('TabGrouper background script loading...');

// Configuration constants
const CONFIG = {
  UI: {
    SEARCH_BOX_ID: 'tab-grouper'
  },
  
  ICONS: [
    "🌟", "🚀", "📚", "🎨", "🎵", "📷", "💼", "🔧", "🔍", "🍀",
    "🔥", "🌈", "⚡", "🌍", "🌙", "☀️", "🌊", "🍎", "🍔", "🎁",
    "🎉", "🎈", "🎯", "🏆", "🏠", "🚗", "✈️", "🛒", "💡"
  ],
  
  STORAGE_KEYS: {
    SUPPORTED_HOSTS: 'supportedHosts',
    RECENT_TABS: 'recentTabs',
    AUTO_COLLAPSE_SETTINGS: 'autoCollapseSettings',
    TAB_ACTIVITY: 'tabActivity'
  },
  
  AUTO_COLLAPSE: {
    DEFAULT_ENABLED: false,
    DEFAULT_TIMEOUT_MINUTES: 5,
    MIN_TIMEOUT_MINUTES: 1,
    MAX_TIMEOUT_MINUTES: 60
  },
  
  DEFAULT_ICONS: {
    FOLDER: '📂',
    BOOKMARK: '⭐️',
    SEARCH: '🔍',
    DELETE: '✖'
  }
};

const COMMANDS = {
  OPEN_SEARCH_BOX: 'open-search-box',
  COPY_CURRENT_URL: 'copy-current-url'
};

// Extract ACTIONS from CONFIG
const ACTIONS = {
  ACTIVATE_TAB: 'activateTab',
  REMOVE_TAB: 'removeTab', 
  REFRESH_GROUPED_TABS: 'refreshGroupedTabs',
  SEARCH: 'search',
  OPEN_QUICK_ACCESS_TAB: 'openQuickAccessTab',
  GET_AUTO_COLLAPSE_SETTINGS: 'getAutoCollapseSettings',
  UPDATE_AUTO_COLLAPSE_SETTINGS: 'updateAutoCollapseSettings'
};

// Auto-collapse functionality using Chrome Alarms API
// 
// IMPORTANT: Chrome Service Workers can go to sleep, which stops setInterval timers.
// Using chrome.alarms API ensures auto-collapse continues working even when 
// the service worker is dormant. Alarms persist and will wake up the service worker.
//
const AUTO_COLLAPSE_ALARM_NAME = 'autoCollapseCheck';

// Handle alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_COLLAPSE_ALARM_NAME) {
    await checkInactiveTabGroups();
  }
});

// Invalidate in-memory caches when storage is updated externally
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS]) supportedHostsCache = null;
  if (changes[CONFIG.STORAGE_KEYS.TAB_ACTIVITY]) tabActivityCache = null;
  if (changes[CONFIG.STORAGE_KEYS.RECENT_TABS]) recentTabsCache = null;
});

async function getAutoCollapseSettings() {
  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.AUTO_COLLAPSE_SETTINGS);
    return result[CONFIG.STORAGE_KEYS.AUTO_COLLAPSE_SETTINGS] || {
      enabled: CONFIG.AUTO_COLLAPSE.DEFAULT_ENABLED,
      timeoutMinutes: CONFIG.AUTO_COLLAPSE.DEFAULT_TIMEOUT_MINUTES
    };
  } catch (error) {
    console.error('Error getting auto-collapse settings:', error);
    return {
      enabled: CONFIG.AUTO_COLLAPSE.DEFAULT_ENABLED,
      timeoutMinutes: CONFIG.AUTO_COLLAPSE.DEFAULT_TIMEOUT_MINUTES
    };
  }
}

async function saveAutoCollapseSettings(settings) {
  try {
    await chrome.storage.local.set({
      [CONFIG.STORAGE_KEYS.AUTO_COLLAPSE_SETTINGS]: settings
    });
  } catch (error) {
    console.error('Error saving auto-collapse settings:', error);
  }
}

let tabActivityCache = null;
let tabActivityLoadPromise = null;

async function getTabActivity() {
  if (tabActivityCache !== null) return tabActivityCache;
  if (!tabActivityLoadPromise) {
    tabActivityLoadPromise = chrome.storage.local.get(CONFIG.STORAGE_KEYS.TAB_ACTIVITY)
      .then(result => {
        tabActivityCache = result[CONFIG.STORAGE_KEYS.TAB_ACTIVITY] || {};
        return tabActivityCache;
      })
      .catch(error => {
        console.error('Error getting tab activity:', error);
        tabActivityCache = {};
        return tabActivityCache;
      })
      .finally(() => { tabActivityLoadPromise = null; });
  }
  return tabActivityLoadPromise;
}

async function updateTabActivity(tabId, timestamp = Date.now()) {
  try {
    const tabActivity = await getTabActivity();
    tabActivity[tabId] = timestamp;
    await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.TAB_ACTIVITY]: tabActivity });
  } catch (error) {
    console.error('Error updating tab activity:', error);
  }
}

async function removeTabActivity(tabId) {
  try {
    const tabActivity = await getTabActivity();
    delete tabActivity[tabId];
    await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.TAB_ACTIVITY]: tabActivity });
  } catch (error) {
    console.error('Error removing tab activity:', error);
  }
}

async function checkInactiveTabGroups() {
  try {
    await chrome.storage.session.set({ alarmLastRun: Date.now() });
    const settings = await getAutoCollapseSettings();
    if (!settings.enabled) {
      console.log('Auto-collapse is disabled, skipping check');
      return;
    }


    const [tabActivity, tabs, activeTab] = await Promise.all([
      getTabActivity(),
      getAllTabs(),
      getActiveTab()
    ]);
    
    const now = Date.now();
    const timeoutMs = settings.timeoutMinutes * 60 * 1000;
    
    // Group tabs by their tab groups, excluding chrome:// pages
    const groupedTabs = {};
    let tabCount = 0;
    
    for (const tab of tabs) {
      if (tab.url.startsWith('chrome://')) {
        continue;
      }
      
      const groupId = tab.groupId;
      // Only process tabs that are in actual groups (groupId > 0)
      if (groupId && groupId > 0) {
        if (!groupedTabs[groupId]) {
          groupedTabs[groupId] = [];
        }
        groupedTabs[groupId].push(tab);
        tabCount++;
      }
    }
    
    const groupCount = Object.keys(groupedTabs).length;
    
    if (groupCount === 0) {
      console.log('📊 No tab groups found for auto-collapse check');
      return;
    }
    
    console.log(`📊 Checking ${groupCount} tab groups for auto-collapse (${tabCount} tabs total)`);
    
    let collapsedCount = 0;
    
    // Check each group for inactivity
    for (const [groupId, groupTabs] of Object.entries(groupedTabs)) {
      // Skip groups containing the active tab
      const hasActiveTab = groupTabs.some(tab => tab.id === activeTab?.id);
      if (hasActiveTab) {
        continue;
      }
      
      // Check if all tabs in the group are inactive
      let allTabsInactive = true;
      let oldestActivity = now;
      
      for (const tab of groupTabs) {
        let lastActivity = tabActivity[tab.id];
        
        // If there's no time record, set current time on this check, can collapse next time
        if (!lastActivity) {
          lastActivity = now;
          try {
            await updateTabActivity(tab.id, now); // Record current time
          } catch (error) {
            console.warn(`⚠️ Failed to update activity for tab ${tab.id}, using current time as fallback`);
            // Continue with current time as fallback
          }
        }
        
        const timeSinceActivity = now - lastActivity;
        
        // If any tab was active within timeout period, don't collapse the entire group
        if (timeSinceActivity <= timeoutMs) {
          allTabsInactive = false;
          console.log(`⏰ Tab ${tab.id} in group ${groupId} is still active (${Math.round(timeSinceActivity / 60000)} min ago)`);
          break;
        }
        
        oldestActivity = Math.min(oldestActivity, lastActivity);
      }
      
      if (allTabsInactive) {
        const timeSinceActivity = now - oldestActivity;
        console.log(`📁 Collapsing inactive group: ${groupId} (inactive for ${Math.round(timeSinceActivity / 60000)} minutes)`);
        
        try {
          // Check if group is already collapsed
          const groupInfo = await chrome.tabGroups.get(parseInt(groupId));
          if (groupInfo.collapsed) {
            console.log(`ℹ️ Group ${groupId} is already collapsed`);
          } else {
            await chrome.tabGroups.update(parseInt(groupId), { collapsed: true });
            console.log(`✅ Successfully collapsed group ${groupId}`);
            collapsedCount++;
          }
        } catch (error) {
          console.error(`❌ Error collapsing tab group ${groupId}:`, error);
        }
      }
    }
    
    console.log(`🎯 Check completed - collapsed ${collapsedCount} groups`);
    
    // Clean up activity tracking for tabs that no longer exist (less frequent)
    if (Math.random() < 0.1) {
      const currentTabIds = new Set(tabs.map(tab => tab.id));
      const tabActivity = await getTabActivity();
      const trackedTabIds = Object.keys(tabActivity).map(id => parseInt(id));

      let cleanedCount = 0;
      for (const tabId of trackedTabIds) {
        if (!currentTabIds.has(tabId)) {
          delete tabActivity[tabId];
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.TAB_ACTIVITY]: tabActivity });
        console.log(`🧹 Cleaned up ${cleanedCount} stale activity records`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking inactive tab groups:', error);
  }
}

async function startAutoCollapseChecker() {
  await chrome.alarms.clear(AUTO_COLLAPSE_ALARM_NAME);
  
  const settings = await getAutoCollapseSettings();
  const checkIntervalMinutes = Math.max(settings.timeoutMinutes, 1);
  
  await chrome.alarms.create(AUTO_COLLAPSE_ALARM_NAME, {
    delayInMinutes: checkIntervalMinutes,
    periodInMinutes: checkIntervalMinutes
  });
}

async function stopAutoCollapseChecker() {
  await chrome.alarms.clear(AUTO_COLLAPSE_ALARM_NAME);
}

async function initializeAutoCollapse() {
  try {
    const settings = await getAutoCollapseSettings();
    
    if (settings.enabled) {
      await startAutoCollapseChecker();
    } else {
      await stopAutoCollapseChecker();
    }
  } catch (error) {
    console.error('Failed to initialize auto-collapse:', error);
  }
}

async function recoverMissedAlarm() {
  try {
    const settings = await getAutoCollapseSettings();
    if (!settings.enabled) return;
    const result = await chrome.storage.session.get('alarmLastRun');
    const lastRun = result.alarmLastRun;
    if (!lastRun) return; // No record — first run or fresh browser session
    const intervalMs = settings.timeoutMinutes * 60 * 1000;
    if (Date.now() - lastRun > intervalMs * 2) {
      console.warn('⚠️ Auto-collapse alarm may have been missed — running now');
      await checkInactiveTabGroups();
    }
  } catch (error) {
    console.error('Error in recoverMissedAlarm:', error);
  }
}

// Ensure auto-collapse is working whenever the service worker becomes active
async function ensureAutoCollapseActive() {
  try {
    const settings = await getAutoCollapseSettings();
    if (!settings.enabled) {
      console.log('⚙️ Auto-collapse is disabled, skipping activation check');
      return;
    }

    const alarm = await chrome.alarms.get(AUTO_COLLAPSE_ALARM_NAME);
    if (!alarm) {
      console.log('⚠️ Auto-collapse alarm not found, restarting...');
      await startAutoCollapseChecker();
      console.log('✅ Auto-collapse alarm restarted successfully');
    } else {
      console.log(`⏰ Auto-collapse alarm is active (next: ${new Date(alarm.scheduledTime).toLocaleTimeString()})`);
    }
    await recoverMissedAlarm();
  } catch (error) {
    console.error('❌ Error ensuring auto-collapse is active:', error);
    // Try to restart the checker as a fallback
    try {
      await startAutoCollapseChecker();
      console.log('✅ Auto-collapse restarted as fallback');
    } catch (fallbackError) {
      console.error('❌ Failed to restart auto-collapse:', fallbackError);
    }
  }
}

// Utility functions
let supportedHostsCache = null;
async function getSupportedHosts() {
  if (supportedHostsCache !== null) return supportedHostsCache;
  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS);
    supportedHostsCache = result[CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS] || {};
    return supportedHostsCache;
  } catch (error) {
    console.error('Error getting supported hosts:', error);
    supportedHostsCache = {};
    return supportedHostsCache;
  }
}

function extractHostFromUrl(url) {
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

function mapUrlToHost(url, supportedHosts = {}) {
  let host = extractHostFromUrl(url);
  for (const [key, value] of Object.entries(supportedHosts)) {
    if (url.includes(key)) {
      host = value;
      break;
    }
  }
  return host;
}

async function groupTabsByHost(tabs) {
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

function getAllTabs() {
  return chrome.tabs.query({});
}

function getActiveTab() {
  return chrome.tabs.query({ currentWindow: true, active: true })
    .then(tabs => tabs[0] ?? null);
}

function getBookmarkTree() {
  return chrome.bookmarks.getTree();
}

// Helper function for safe tab operations with retry logic
async function safeTabOperation(operation, operationName, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 300;
  
  try {
    return await operation();
  } catch (error) {
    if (error.message.includes('user may be dragging') && retryCount < maxRetries) {
      const delay = baseDelay * (retryCount + 1);
      console.log(`⏳ Tab dragging detected during ${operationName}, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return safeTabOperation(operation, operationName, retryCount + 1);
    } else {
      console.error(`❌ Failed to ${operationName}:`, error.message);
      throw error;
    }
  }
}

async function activateTab(tabId) {
  return safeTabOperation(
    () => chrome.tabs.update(tabId, { active: true }),
    'activate tab'
  );
}

async function removeTab(tabId) {
  return safeTabOperation(
    async () => {
      await chrome.tabs.remove(tabId);
      return true;
    },
    'remove tab'
  );
}

async function searchTabsAndBookmarks(query) {
  const [tabs, supportedHosts, bookmarks, bookmarkTree] = await Promise.all([
    chrome.tabs.query({}),
    getSupportedHosts(),
    chrome.bookmarks.search(query),
    chrome.bookmarks.getTree()
  ]);

  const nodeMap = buildBookmarkNodeMap(bookmarkTree);

  const lowerQuery = query.toLowerCase();

  const matchedTabs = tabs.filter(tab =>
    tab.title?.toLowerCase().includes(lowerQuery) ||
    tab.url?.toLowerCase().includes(lowerQuery)
  );

  // Also search by host names using already-fetched supportedHosts
  const matchedTabIds = new Set(matchedTabs.map(t => t.id));
  for (const tab of tabs) {
    if (matchedTabIds.has(tab.id)) continue;
    const host = mapUrlToHost(tab.url, supportedHosts);
    if (host.toLowerCase().includes(lowerQuery)) {
      matchedTabs.push(tab);
      matchedTabIds.add(tab.id);
    }
  }

  const bookmarksWithPath = bookmarks.map(bookmark => ({
    type: 'bookmark',
    id: bookmark.id,
    title: bookmark.title,
    url: bookmark.url,
    path: getBookmarkPathFromMap(bookmark.id, nodeMap)
  }));

  return [
    ...matchedTabs.map(tab => ({
      type: 'tab',
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      groupId: tab.groupId
    })),
    ...bookmarksWithPath
  ];
}

function buildBookmarkNodeMap(tree) {
  const nodeMap = {};
  const traverse = (nodes) => {
    for (const node of nodes) {
      nodeMap[node.id] = node;
      if (node.children) traverse(node.children);
    }
  };
  traverse(tree);
  return nodeMap;
}

function getBookmarkPathFromMap(bookmarkId, nodeMap) {
  const path = [];
  let node = nodeMap[bookmarkId];
  while (node && node.parentId) {
    node = nodeMap[node.parentId];
    if (node && node.title) path.unshift(node.title);
  }
  return path;
}

// Recent tabs functions - truly global scope
let recentTabsCache = null;

async function getRecentTabs() {
  if (recentTabsCache !== null) {
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    recentTabsCache = recentTabsCache.filter(tab => tab.timestamp > twentyFourHoursAgo);
    return recentTabsCache;
  }
  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.RECENT_TABS);
    const allTabs = result[CONFIG.STORAGE_KEYS.RECENT_TABS] || [];
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    recentTabsCache = allTabs.filter(tab => tab.timestamp > twentyFourHoursAgo);
    if (recentTabsCache.length !== allTabs.length) {
      await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.RECENT_TABS]: recentTabsCache });
    }
    return recentTabsCache;
  } catch (error) {
    console.error('Error getting recent tabs:', error);
    recentTabsCache = [];
    return recentTabsCache;
  }
}

async function addToRecentTabs(tab) {
  try {
    const recentTabs = await getRecentTabs();
    const filteredTabs = recentTabs.filter(item => item.url !== tab.url);
    const newEntry = {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl,
      timestamp: Date.now()
    };
    filteredTabs.unshift(newEntry);
    recentTabsCache = filteredTabs;
    await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.RECENT_TABS]: filteredTabs });
  } catch (error) {
    console.error('Error adding to recent tabs:', error);
  }
}
// Event listeners
function isInjectableTab(tab) {
  if (!tab || !tab.url) return false;
  return tab.url.startsWith('http://') || tab.url.startsWith('https://');
}

async function getPreferredInjectionTab(activeTab) {
  if (isInjectableTab(activeTab)) {
    return activeTab;
  }

  const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
  return currentWindowTabs.find(isInjectableTab) || null;
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === COMMANDS.OPEN_SEARCH_BOX) {
    try {
      const [alltabs, activeTab, bookmarkTreeNodes] = await Promise.all([
        getAllTabs(),
        getActiveTab(),
        getBookmarkTree()
      ]);

      const injectionTab = await getPreferredInjectionTab(activeTab);

      if (injectionTab) {
        // If the current active tab is not injectable (e.g. chrome://extensions),
        // switch to an injectable tab first so the overlay can be shown immediately.
        if (!activeTab || activeTab.id !== injectionTab.id) {
          await chrome.tabs.update(injectionTab.id, { active: true });
        }

        await chrome.scripting.executeScript({
          target: { tabId: injectionTab.id },
          function: tabGrouper,
          args: [bookmarkTreeNodes, alltabs]
        });
      } else {
        console.warn('Cannot inject script - no injectable tab found in current window');
      }
    } catch (error) {
      console.error('Script execution error:', error);
    }
  } else if (command === COMMANDS.COPY_CURRENT_URL) {
    
    try {
      const activeTab = await getActiveTab();
      if (activeTab && activeTab.url) {
        // Use a simpler approach without user permission prompts
        if (!activeTab.url.startsWith('chrome://')) {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            function: (urlToCopy) => {
              // Function to copy text without permission prompts
              function copyToClipboard(text) {
                // Method 1: Try the modern clipboard API first (might work silently)
                if (navigator.clipboard && window.isSecureContext) {
                  return navigator.clipboard.writeText(text).catch(() => {
                    // If that fails, use the fallback method
                    return fallbackCopyTextToClipboard(text);
                  });
                } else {
                  return fallbackCopyTextToClipboard(text);
                }
              }
              
              function fallbackCopyTextToClipboard(text) {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                return new Promise((resolve, reject) => {
                  try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (successful) {
                      resolve();
                    } else {
                      reject(new Error('Copy command failed'));
                    }
                  } catch (err) {
                    document.body.removeChild(textArea);
                    reject(err);
                  }
                });
              }
              
              // Copy the URL
              copyToClipboard(urlToCopy).then(() => {
                // Show success notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                  position: fixed;
                  top: 20px;
                  right: 20px;
                  background: rgba(16, 185, 129, 0.95);
                  color: white;
                  padding: 12px 20px;
                  border-radius: 8px;
                  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                  font-size: 14px;
                  font-weight: 600;
                  z-index: 10000;
                  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                  backdrop-filter: blur(8px);
                  animation: slideInFromTop 0.3s ease-out;
                `;
                notification.textContent = '📋 URL copied to clipboard!';
                
                // Add animation styles
                const style = document.createElement('style');
                style.textContent = `
                  @keyframes slideInFromTop {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                  }
                `;
                document.head.appendChild(style);
                document.body.appendChild(notification);
                
                // Remove notification after 2 seconds
                setTimeout(() => {
                  notification.remove();
                  style.remove();
                }, 2000);
              }).catch((err) => {
                console.error('Failed to copy URL:', err);
              });
            },
            args: [activeTab.url]
          });
        } else {
          console.warn('Cannot copy URL from chrome:// pages');
        }
      } else {
        console.warn('No active tab found or invalid URL');
      }
    } catch (error) {
      console.error('Copy URL error:', error);
    }
  } else {
    console.log('Unknown command:', command);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const messageHandlers = {
    [ACTIONS.ACTIVATE_TAB]: handleActivateTab,
    [ACTIONS.REMOVE_TAB]: handleRemoveTab,
    [ACTIONS.REFRESH_GROUPED_TABS]: handleRefreshGroupedTabs,
    [ACTIONS.SEARCH]: handleSearch,
    [ACTIONS.OPEN_QUICK_ACCESS_TAB]: handleOpenQuickAccessTab,
    [ACTIONS.GET_AUTO_COLLAPSE_SETTINGS]: handleGetAutoCollapseSettings,
    [ACTIONS.UPDATE_AUTO_COLLAPSE_SETTINGS]: handleUpdateAutoCollapseSettings,
    'deleteBookmark': handleDeleteBookmark,
    'createBookmark': handleCreateBookmark,
    'createFolder': handleCreateFolder,
    'ping': handlePing
  };

  const handler = messageHandlers[request.action];
  if (handler) {
    try {
      const result = handler(request, sender, sendResponse);
      if (result === true) {
        return true; // Keep message channel open for async response
      }
      if (isPromiseLike(result)) {
        result.catch((error) => {
          console.error('Handler async error:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true; // Promise-based handlers need an open message channel
      }
    } catch (error) {
      console.error('Handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  } else {
    sendResponse({ success: false, error: 'Unknown action: ' + request.action });
  }
  
  return false; // Close message channel immediately if no async operation
});

function isPromiseLike(value) {
  return !!value && typeof value.then === 'function';
}

async function handleActivateTab(request, sender, sendResponse) {
  try {
    await activateTab(request.tabId);

    // Also track this tab activation
    try {
      const tab = await chrome.tabs.get(request.tabId);
      await trackRecentTab(tab);
    } catch (error) {
      console.error('Error tracking activated tab:', error);
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('Error activating tab:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function isClickDuplicate(clickId) {
  try {
    const result = await chrome.storage.session.get('processedClicks');
    const clicks = result.processedClicks || {};
    const now = Date.now();
    for (const [id, ts] of Object.entries(clicks)) {
      if (now - ts > 5000) delete clicks[id];
    }
    if (clicks[clickId]) {
      await chrome.storage.session.set({ processedClicks: clicks });
      return true;
    }
    clicks[clickId] = now;
    await chrome.storage.session.set({ processedClicks: clicks });
    return false;
  } catch (error) {
    console.error('Error checking click dedup:', error);
    return false;
  }
}

async function handleOpenQuickAccessTab(request, sender, sendResponse) {
  const normalizeUrl = (url) => url ? url.replace(/\/$/, '').toLowerCase() : '';

  if (request.clickId && await isClickDuplicate(request.clickId)) {
    if (sendResponse) sendResponse({ success: false, error: 'Duplicate click' });
    return true;
  }

  try {
    // Try to activate existing tab first - use broader search
    const allTabs = await chrome.tabs.query({});
    const matchingTabs = allTabs.filter(tab => {
      // Normalize URLs for comparison
      return normalizeUrl(tab.url) === normalizeUrl(request.url);
    });
    
    
    if (matchingTabs.length > 0) {
      await safeTabOperation(
        () => chrome.tabs.update(matchingTabs[0].id, { active: true }),
        'activate existing tab'
      );
      await chrome.windows.update(matchingTabs[0].windowId, { focused: true });
    } else {
      const newTab = await safeTabOperation(
        () => chrome.tabs.create({ url: request.url }),
        'create new tab'
      );
      
    }
    
    if (sendResponse) {
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('❌ Error handling Quick Access tab open:', error);
    if (sendResponse) {
      sendResponse({ success: false, error: error.message });
    }
  }
  
  return true; // Keep message channel open for async response
}

async function handleRemoveTab(request, sender, sendResponse) {
  try {
    await removeTab(request.tabId);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error removing tab:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleDeleteBookmark(request, sender, sendResponse) {
  try {
    await chrome.bookmarks.remove(request.bookmarkId);
    console.log(`✅ Bookmark ${request.bookmarkId} deleted successfully`);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCreateBookmark(request, sender, sendResponse) {
  try {
    // Check if bookmark already exists
    const existingBookmarks = await chrome.bookmarks.search({ url: request.url });
    if (existingBookmarks.length > 0) {
      sendResponse({ success: false, error: 'This page is already bookmarked' });
      return;
    }

    // Create the bookmark
    const bookmark = await chrome.bookmarks.create({
      parentId: request.parentId,
      title: request.title,
      url: request.url
    });

    console.log(`✅ Bookmark created successfully:`, bookmark);
    sendResponse({ success: true, bookmark: bookmark });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCreateFolder(request, sender, sendResponse) {
  try {
    if (!request.title || !request.title.trim()) {
      sendResponse({ success: false, error: 'Folder name cannot be empty' });
      return;
    }

    const folder = await chrome.bookmarks.create({
      parentId: request.parentId || '1',
      title: request.title.trim()
    });

    sendResponse({ success: true, folder });
  } catch (error) {
    console.error('Error creating folder:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handleRefreshGroupedTabs(request, sender, sendResponse) {
  (async () => {
    try {
      const [alltabs, activeTab, bookmarkTreeNodes] = await Promise.all([
        getAllTabs(),
        getActiveTab(),
        getBookmarkTree()
      ]);

      if (activeTab) {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: tabGrouper,
          args: [bookmarkTreeNodes, alltabs]
        });
      }
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('Refresh error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // Keep message channel open
}

function handleSearch(request, sender, sendResponse) {
  searchTabsAndBookmarks(request.query)
    .then(results => sendResponse(results))
    .catch(error => {
      console.error('Search error:', error);
      sendResponse([]);
    });
  return true;
}

function handleGetAutoCollapseSettings(request, sender, sendResponse) {
  (async () => {
    try {
      const settings = await getAutoCollapseSettings();
      sendResponse(settings);
    } catch (error) {
      console.error('Error getting auto-collapse settings:', error);
      const defaultSettings = {
        enabled: CONFIG.AUTO_COLLAPSE.DEFAULT_ENABLED,
        timeoutMinutes: CONFIG.AUTO_COLLAPSE.DEFAULT_TIMEOUT_MINUTES
      };
      sendResponse(defaultSettings);
    }
  })();
  return true; // Keep message channel open
}

function handleUpdateAutoCollapseSettings(request, sender, sendResponse) {
  (async () => {
    try {
      const { enabled, timeoutMinutes } = request.settings;
      
      // Validate settings
      const validatedSettings = {
        enabled: !!enabled,
        timeoutMinutes: Math.min(
          Math.max(timeoutMinutes || CONFIG.AUTO_COLLAPSE.DEFAULT_TIMEOUT_MINUTES, 
                   CONFIG.AUTO_COLLAPSE.MIN_TIMEOUT_MINUTES),
          CONFIG.AUTO_COLLAPSE.MAX_TIMEOUT_MINUTES
        )
      };
      
      await saveAutoCollapseSettings(validatedSettings);
      
      // Restart or stop the auto-collapse checker based on the new settings
      if (validatedSettings.enabled) {
        await startAutoCollapseChecker();
      } else {
        await stopAutoCollapseChecker();
      }
      
      const response = { success: true, settings: validatedSettings };
      sendResponse(response);
    } catch (error) {
      console.error('Error updating auto-collapse settings:', error);
      const response = { success: false, error: error.message };
      sendResponse(response);
    }
  })();
  return true; // Keep message channel open
}

function handlePing(request, sender, sendResponse) {
  console.log('🏓 Service Worker ping received, responding with pong');
  
  // Ensure auto-collapse is active when we get pinged
  ensureAutoCollapseActive();
  
  sendResponse({ success: true, message: 'pong' });
  return false; // Close message channel immediately
}

async function syncAllTabGroupsWithTitles() {
  const alltabs = await getAllTabs();
  const groupedTabs = await groupTabsByHost(alltabs);

  for (const [host, tabs] of Object.entries(groupedTabs)) {
    const tabIds = tabs
      .map(tab => tab?.id)
      .filter(tabId => typeof tabId === 'number');

    if (tabIds.length === 0) {
      continue;
    }

    try {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, { title: host });
    } catch (error) {
      console.warn(`Failed to sync group title for host "${host}":`, error);
    }
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    console.log('🔧 Extension installed/updated, reason:', details.reason);

    await syncAllTabGroupsWithTitles();

    // Initialize auto-collapse functionality after installation/update
    await initializeAutoCollapse();
    await ensureAutoCollapseActive();
    
    console.log('✅ Extension installation/update completed');
  } catch (error) {
    console.error('❌ Installation setup error:', error);
  }
});

// Initialize auto-collapse on startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    await syncAllTabGroupsWithTitles();
    await initializeAutoCollapse();
    await ensureAutoCollapseActive();
  } catch (error) {
    console.error('Startup auto-collapse initialization error:', error);
  }
});

// Record time when tab is created
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    await updateTabActivity(tab.id);
  } catch (error) {
    console.error('Error recording tab creation time:', error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  // Track recent tab first
  try {
    await trackRecentTab(tab);
  } catch (error) {
    console.error('Error tracking recent tab:', error);
  }

  // Update tab activity when tab is updated
  try {
    await updateTabActivity(tabId);
  } catch (error) {
    console.error('Error updating tab activity on update:', error);
  }

  try {
    const supportedHosts = await getSupportedHosts();
    const host = mapUrlToHost(tab.url, supportedHosts);

    const groups = await chrome.tabGroups.query({});
    const existingGroup = groups.find(group => group.title === host);

    if (existingGroup) {
      await chrome.tabs.group({ tabIds: [tabId], groupId: existingGroup.id });
    } else {
      const groupId = await chrome.tabs.group({ tabIds: [tabId] });
      await chrome.tabGroups.update(groupId, { title: host });
    }
  } catch (error) {
    console.error('Tab update error:', error);
  }
});

// Helper function to track recent tabs - must be defined before listeners
async function trackRecentTab(tab) {
  try {
    if (!tab) {
      return;
    }

    if (!tab.url) {
      return;
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }

    if (tab.url === 'about:blank' || tab.url === '') {
      return;
    }

    // Use the global addToRecentTabs function
    await addToRecentTabs(tab);

  } catch (error) {
    console.error('Error tracking recent tab:', error, tab);
  }
}

// Additional tab activation tracking
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await trackRecentTab(tab);
    // Update tab activity when tab is activated
    await updateTabActivity(activeInfo.tabId);
  } catch (error) {
    console.error('Error tracking tab activation:', error);
  }
});

// Track tab removal for cleanup
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    await removeTabActivity(tabId);
  } catch (error) {
    console.error('Error removing tab activity on removal:', error);
  }
});



console.log('TabGrouper background script loaded successfully');
