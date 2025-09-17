// Service worker for TabGrouper
console.log('TabGrouper background script loading...');

// Configuration constants
const CONFIG = {
  UI: {
    SEARCH_BOX_ID: 'tab-grouper',
    MIN_WIDTH: 600,
    MIN_HEIGHT: 400,
    WIDTH_PERCENTAGE: 40,
    HEIGHT_PERCENTAGE: 50,
    INPUT_FOCUS_DELAY: 0,
    MESSAGE_HIDE_DELAY: 2000
  },
  
  ICONS: [
    "🌟", "🚀", "📚", "🎨", "🎵", "📷", "💼", "🔧", "🔍", "🍀",
    "🔥", "🌈", "⚡", "🌍", "🌙", "☀️", "🌊", "🍎", "🍔", "🎁",
    "🎉", "🎈", "🎯", "🏆", "🏠", "🚗", "✈️", "🛒", "💡"
  ],
  
  STORAGE_KEYS: {
    SUPPORTED_HOSTS: 'supportedHosts'
  },
  
  DEFAULT_ICONS: {
    FOLDER: '📂',
    BOOKMARK: '⭐️',
    SEARCH: '🔍',
    DELETE: '✖'
  }
};

const COMMANDS = {
  OPEN_SEARCH_BOX: 'open-search-box'
};

const ACTIONS = {
  ACTIVATE_TAB: 'activateTab',
  REMOVE_TAB: 'removeTab',
  REFRESH_GROUPED_TABS: 'refreshGroupedTabs',
  SEARCH: 'search'
};

// Utility functions
async function getSupportedHosts() {
  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS);
    return result[CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS] || {};
  } catch (error) {
    console.error('Error getting supported hosts:', error);
    return {};
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
  return new Promise((resolve) => {
    chrome.tabs.query({}, resolve);
  });
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
      resolve(tabs.length > 0 ? tabs[0] : null);
    });
  });
}

function getBookmarkTree() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree(resolve);
  });
}

function activateTab(tabId) {
  chrome.tabs.update(tabId, { active: true });
}

function removeTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => {
      resolve(true);
    });
  });
}

async function searchTabsAndBookmarks(query) {
  // Search tabs
  const tabs = await chrome.tabs.query({});
  const lowerQuery = query.toLowerCase();
  
  const matchedTabs = tabs.filter(tab =>
    tab.title.toLowerCase().includes(lowerQuery) ||
    tab.url.toLowerCase().includes(lowerQuery)
  );

  // Also search by host names
  const groupedTabs = await groupTabsByHost(tabs);
  for (const [host, hostTabs] of Object.entries(groupedTabs)) {
    if (host.toLowerCase().includes(lowerQuery)) {
      const isHostInMatchedTabs = matchedTabs.some(tab =>
        tab.title.toLowerCase().includes(lowerQuery) ||
        tab.url.toLowerCase().includes(lowerQuery)
      );
      
      if (!isHostInMatchedTabs) {
        matchedTabs.push(...hostTabs);
      }
    }
  }

  // Search bookmarks
  const bookmarks = await chrome.bookmarks.search(query);
  const bookmarksWithPath = await Promise.all(
    bookmarks.map(async bookmark => {
      const path = await getBookmarkPath(bookmark.id);
      return {
        type: 'bookmark',
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        path: path
      };
    })
  );

  const results = [
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

  return results;
}

async function getBookmarkPath(bookmarkId) {
  const getNode = async (id) => {
    const nodes = await chrome.bookmarks.get(id);
    return nodes[0];
  };

  const path = [];
  let currentNode = await getNode(bookmarkId);

  while (currentNode.parentId) {
    currentNode = await getNode(currentNode.parentId);
    if (currentNode.title) {
      path.unshift(currentNode.title);
    }
  }

  return path;
}

// Tab grouper main function - will be injected as content script
// This function will be stringified and injected, so it must be self-contained
function tabGrouper(bookmarkTreeNodes, alltabs) {
  console.log('tabGrouper function started');
  
  // All configuration and utilities must be defined within this function
  const CONFIG = {
    UI: {
      SEARCH_BOX_ID: 'tab-grouper',
      MIN_WIDTH: 600,
      MIN_HEIGHT: 400,
      WIDTH_PERCENTAGE: 40,
      HEIGHT_PERCENTAGE: 50,
      INPUT_FOCUS_DELAY: 0
    },
    ICONS: [
      "🌟", "🚀", "📚", "🎨", "🎵", "📷", "💼", "🔧", "🔍", "🍀",
      "🔥", "🌈", "⚡", "🌍", "🌙", "☀️", "🌊", "🍎", "🍔", "🎁",
      "🎉", "🎈", "🎯", "🏆", "🏠", "🚗", "✈️", "🛒", "💡"
    ],
    STORAGE_KEYS: { SUPPORTED_HOSTS: 'supportedHosts' },
    DEFAULT_ICONS: { FOLDER: '📂', BOOKMARK: '⭐️', SEARCH: '🔍', DELETE: '✖' }
  };
  
  const ACTIONS = {
    ACTIVATE_TAB: 'activateTab',
    REMOVE_TAB: 'removeTab',
    REFRESH_GROUPED_TABS: 'refreshGroupedTabs',
    SEARCH: 'search'
  };

  // Utility functions - must be defined inline
  async function getSupportedHosts() {
    try {
      const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS);
      return result[CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS] || {};
    } catch (error) {
      console.error('Error getting supported hosts:', error);
      return {};
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

  function getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.origin}/favicon.ico`;
    } catch (e) {
      try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}`;
      } catch (error) {
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23ccc"/></svg>';
      }
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Create search box function
  async function createSearchBox(bookmarkTreeNodes, alltabs) {
    const searchBox = document.createElement('div');
    searchBox.id = CONFIG.UI.SEARCH_BOX_ID;
    const shadow = searchBox.attachShadow({ mode: 'open' });

    // Create overlay for complete isolation
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    // Create modern styles
    const style = document.createElement('style');
    style.textContent = `
      * {
        margin: 0; padding: 0; box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      
      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 99999;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        will-change: opacity;
        transform: translateZ(0);
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      #container {
        position: relative;
        z-index: 100000;
        background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 
          0 20px 60px rgba(0,0,0,0.15),
          0 8px 32px rgba(0,0,0,0.08),
          inset 0 1px 0 rgba(255,255,255,0.9);
        width: 75vw;
        max-width: 900px;
        min-width: 650px;
        height: 70vh;
        max-height: 650px;
        min-height: 500px;
        display: flex;
        flex-direction: column;
        animation: slideIn 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        will-change: transform, opacity;
        transform: translateZ(0);
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .header {
        display: flex;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.6);
      }
      
      .logo {
        font-size: 20px;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-right: 12px;
      }
      
      .subtitle {
        font-size: 14px;
        color: rgba(100, 116, 139, 0.8);
        font-weight: 500;
      }
      
      input {
        width: 100%;
        padding: 16px 20px;
        border: 2px solid transparent;
        border-radius: 16px;
        background: rgba(248, 250, 252, 0.8);
        font-size: 16px !important;
        font-weight: 500;
        outline: none;
        color: #1e293b !important;
        -webkit-text-fill-color: #1e293b !important;
        opacity: 1 !important;
        margin-bottom: 20px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 
          0 4px 12px rgba(0,0,0,0.05),
          inset 0 1px 0 rgba(255,255,255,0.9);
      }
      
      input::placeholder {
        color: rgba(100, 116, 139, 0.6) !important;
        -webkit-text-fill-color: rgba(100, 116, 139, 0.6) !important;
        opacity: 1 !important;
      }
      
      input:focus {
        border-color: rgba(99, 102, 241, 0.4);
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 
          0 0 0 4px rgba(99, 102, 241, 0.1),
          0 8px 24px rgba(0,0,0,0.08);
        transform: translateY(-1px);
      }
      
      #lists {
        display: flex;
        flex: 1;
        gap: 24px;
        overflow: hidden;
      }
      
      .section {
        display: flex;
        flex-direction: column;
        background: rgba(255, 255, 255, 0.6);
        border-radius: 16px;
        padding: 16px;
        border: 1px solid rgba(226, 232, 240, 0.6);
        backdrop-filter: blur(8px);
      }
      
      .bookmark-section {
        flex: 0.35;
        min-width: 280px;
      }
      
      .tab-section {
        flex: 0.65;
        min-width: 400px;
      }
      
      .section-title {
        font-size: 14px;
        font-weight: 700;
        color: #475569;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      ul {
        list-style: none !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      
      .host-group {
        background: rgba(255, 255, 255, 0.8);
        border-radius: 12px;
        margin-bottom: 8px;
        border: 1px solid rgba(226, 232, 240, 0.4);
        overflow: hidden;
        transition: all 0.2s ease;
      }
      
      .host-group:hover {
        background: rgba(255, 255, 255, 0.95);
        border-color: rgba(99, 102, 241, 0.2);
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }
      
      .host-title {
        padding: 12px 16px;
        font-weight: 600;
        font-size: 15px;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: #374151;
        border-bottom: 1px solid rgba(226, 232, 240, 0.3);
        transition: all 0.2s ease;
        user-select: none;
      }
      
      .host-title:hover {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
      }
      
      .host-icon {
        margin-right: 10px;
        font-size: 16px;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
      }
      
      .host-tabs {
        padding: 0;
        background: rgba(248, 250, 252, 0.5);
      }
      
      .tab-item {
        display: flex;
        align-items: center;
        padding: 0;
        margin: 0;
        border-bottom: 1px solid rgba(226, 232, 240, 0.2);
        transition: all 0.2s ease;
      }
      
      .tab-item:last-child {
        border-bottom: none;
      }
      
      .tab-item:hover {
        background: rgba(255, 255, 255, 0.8);
      }
      
      .tab-delete {
        all: unset;
        cursor: pointer;
        padding: 12px;
        color: rgba(239, 68, 68, 0.6);
        font-size: 14px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        margin: 4px;
        width: 32px;
        height: 32px;
      }
      
      .tab-delete:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        transform: scale(1.1);
      }
      
      .tab-link {
        display: flex !important;
        align-items: center !important;
        padding: 12px 16px 12px 8px !important;
        color: #374151 !important;
        text-decoration: none !important;
        border: none !important;
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .tab-link:hover {
        color: #6366f1 !important;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%);
      }
      
      .favicon {
        width: 18px !important;
        height: 18px !important;
        margin-right: 12px !important;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      
      .bookmark-folder {
        background: rgba(255, 255, 255, 0.7);
        border-radius: 10px;
        margin-bottom: 4px;
        border: 1px solid rgba(226, 232, 240, 0.3);
        overflow: hidden;
        transition: all 0.2s ease;
      }
      
      .bookmark-folder:hover {
        background: rgba(255, 255, 255, 0.9);
        border-color: rgba(59, 130, 246, 0.2);
      }
      
      .folder-title {
        padding: 10px 14px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: #1e40af;
        transition: all 0.2s ease;
        user-select: none;
      }
      
      .folder-title:hover {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%);
      }
      
      .folder-icon {
        margin-right: 8px;
        font-size: 14px;
      }
      
      .bookmark-link {
        display: flex !important;
        align-items: center !important;
        padding: 8px 14px !important;
        color: #374151 !important;
        text-decoration: none !important;
        border: none !important;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s ease;
        border-bottom: 1px solid rgba(226, 232, 240, 0.2) !important;
      }
      
      .bookmark-link:hover {
        color: #059669 !important;
        background: linear-gradient(135deg, rgba(5, 150, 105, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%);
      }
      
      .bookmark-path {
        font-size: 11px;
        color: rgba(100, 116, 139, 0.7);
        margin-bottom: 4px;
        padding: 0 14px;
        font-weight: 500;
      }
      
      .no-results {
        text-align: center;
        padding: 40px 20px;
        color: rgba(100, 116, 139, 0.6);
        font-size: 15px;
        font-weight: 500;
      }
      
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(100, 116, 139, 0.6);
      }
      
      .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      
      ::-webkit-scrollbar {
        width: 6px;
      }
      
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      
      ::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.4);
        border-radius: 3px;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.6);
      }
      
      .close-hint {
        position: absolute;
        top: 16px;
        right: 20px;
        font-size: 12px;
        color: rgba(100, 116, 139, 0.5);
        font-weight: 500;
        background: rgba(248, 250, 252, 0.8);
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid rgba(226, 232, 240, 0.4);
      }
    `;

    const container = document.createElement('div');
    container.id = 'container';

    // Create header
    const header = document.createElement('div');
    header.className = 'header';
    
    const logo = document.createElement('div');
    logo.className = 'logo';
    logo.textContent = '🚀 TabGrouper';
    
    const subtitle = document.createElement('div');
    subtitle.className = 'subtitle';
    subtitle.textContent = 'Search tabs and bookmarks instantly';
    
    header.appendChild(logo);
    header.appendChild(subtitle);

    // Close hint
    const closeHint = document.createElement('div');
    closeHint.className = 'close-hint';
    closeHint.textContent = 'Press ESC to close';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '🔍 Search tabs, bookmarks, or hosts...';

    const listsContainer = document.createElement('div');
    listsContainer.id = 'lists';

    // Create sections with titles
    const bookmarkSection = document.createElement('div');
    bookmarkSection.className = 'section bookmark-section';
    const bookmarkTitle = document.createElement('div');
    bookmarkTitle.className = 'section-title';
    bookmarkTitle.textContent = '📚 Bookmarks';
    const bookmarkList = document.createElement('ul');
    bookmarkSection.appendChild(bookmarkTitle);
    bookmarkSection.appendChild(bookmarkList);

    const tabSection = document.createElement('div');
    tabSection.className = 'section tab-section';
    const tabTitle = document.createElement('div');
    tabTitle.className = 'section-title';
    tabTitle.textContent = '🗂️ Tabs';
    const tabList = document.createElement('ul');
    tabSection.appendChild(tabTitle);
    tabSection.appendChild(tabList);

    // Display initial grouped tabs
    const groupedTabs = await groupTabsByHost(alltabs);
    displayGroupedTabs(groupedTabs, tabList);

    // Search functionality
    const debouncedSearch = debounce(async (query) => {
      if (query) {
        chrome.runtime.sendMessage({ action: ACTIONS.SEARCH, query: query }, (results) => {
          const tabs = results.filter(item => item.type === 'tab');
          const bookmarks = results.filter(item => item.type === 'bookmark');
          updateSearchResults({ tabs, bookmarks }, bookmarkList, tabList);
        });
      } else {
        const groupedTabs = await groupTabsByHost(alltabs);
        displayGroupedTabs(groupedTabs, tabList);
        displayBookmarks(bookmarkTreeNodes, bookmarkList);
      }
    }, 300);

    input.addEventListener('input', (e) => {
      e.stopPropagation();
      debouncedSearch(e.target.value.toLowerCase());
    });

    // Display initial bookmarks
    displayBookmarks(bookmarkTreeNodes, bookmarkList);

    // Assemble UI
    listsContainer.appendChild(bookmarkSection);
    listsContainer.appendChild(tabSection);
    container.appendChild(closeHint);
    container.appendChild(header);
    container.appendChild(input);
    container.appendChild(listsContainer);
    
    overlay.appendChild(container);
    shadow.appendChild(style);
    shadow.appendChild(overlay);
    document.body.appendChild(searchBox);

    // Prevent page scrolling and other interactions while search box is open
    const originalOverflow = document.body.style.overflow;
    const originalPointerEvents = document.body.style.pointerEvents;
    
    document.body.style.overflow = 'hidden';
    
    // Store cleanup function
    searchBox._cleanup = () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.pointerEvents = originalPointerEvents;
    };

    // Prevent all event bubbling from the search box
    searchBox.addEventListener('keydown', (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();
    });

    searchBox.addEventListener('keyup', (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();
    });

    searchBox.addEventListener('keypress', (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();
    });

    // Focus input and handle keyboard
    setTimeout(() => {
      input.focus();
      
      // Prevent input blur to maintain focus
      input.addEventListener('blur', (e) => {
        e.stopPropagation();
        setTimeout(() => {
          if (document.getElementById(CONFIG.UI.SEARCH_BOX_ID)) {
            input.focus();
          }
        }, 0);
      });
    }, 0);

    // Handle specific keyboard events for the input
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      if (event.key === 'Escape') {
        if (searchBox._cleanup) searchBox._cleanup();
        searchBox.remove();
        return;
      }
      
      // Prevent other keys from affecting the page
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    });

    input.addEventListener('keyup', (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();
    });

    input.addEventListener('keypress', (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();
    });

    // Prevent clicks from bubbling to the page
    container.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    // Handle clicking on overlay to close
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        if (searchBox._cleanup) searchBox._cleanup();
        searchBox.remove();
      }
      event.stopPropagation();
    });

    async function updateSearchResults(results, bookmarkList, tabList) {
      const groupedTabs = await groupTabsByHost(results.tabs);
      displayGroupedTabs(groupedTabs, tabList);
      bookmarkList.innerHTML = '';
      displayBookmarks(results.bookmarks, bookmarkList, true);
    }

    function displayGroupedTabs(groupedTabs, parentElement) {
      parentElement.innerHTML = '';
      
      if (Object.keys(groupedTabs).length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
          <div class="empty-icon">🗂️</div>
          <div>No matching tabs found</div>
        `;
        parentElement.appendChild(emptyState);
        return;
      }

      Object.keys(groupedTabs).forEach(host => {
        const hostGroup = document.createElement('div');
        hostGroup.className = 'host-group';
        
        const hostTitle = document.createElement('div');
        hostTitle.className = 'host-title';
        const randomIcon = CONFIG.ICONS[Math.floor(Math.random() * CONFIG.ICONS.length)];
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'host-icon';
        iconSpan.textContent = randomIcon;
        
        const textSpan = document.createElement('span');
        textSpan.textContent = host;
        
        hostTitle.appendChild(iconSpan);
        hostTitle.appendChild(textSpan);

        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'host-tabs';
        
        let isExpanded = true;
        hostTitle.addEventListener('click', () => {
          isExpanded = !isExpanded;
          tabsContainer.style.display = isExpanded ? 'block' : 'none';
        });

        groupedTabs[host].forEach(tab => {
          const tabItem = document.createElement('div');
          tabItem.className = 'tab-item';

          const deleteButton = document.createElement('button');
          deleteButton.className = 'tab-delete';
          deleteButton.textContent = CONFIG.DEFAULT_ICONS.DELETE;
          deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            chrome.runtime.sendMessage({ action: ACTIONS.REMOVE_TAB, tabId: tab.id }, () => {
              if (searchBox._cleanup) searchBox._cleanup();
              searchBox.remove();
              chrome.runtime.sendMessage({ action: ACTIONS.REFRESH_GROUPED_TABS });
            });
          });

          const link = document.createElement('a');
          link.className = 'tab-link';
          link.href = tab.url;
          link.textContent = tab.title || 'Untitled Tab';

          const icon = document.createElement('img');
          icon.className = 'favicon';
          icon.src = getFaviconUrl(tab.url);
          icon.onerror = () => {
            icon.style.display = 'none';
            const fallback = document.createElement('span');
            fallback.textContent = CONFIG.DEFAULT_ICONS.SEARCH;
            fallback.style.marginRight = '8px';
            link.prepend(fallback);
          };
          link.prepend(icon);

          link.addEventListener('click', (event) => {
            event.preventDefault();
            chrome.runtime.sendMessage({ action: ACTIONS.ACTIVATE_TAB, tabId: tab.id });
            if (searchBox._cleanup) searchBox._cleanup();
            searchBox.remove();
          });

          tabItem.appendChild(deleteButton);
          tabItem.appendChild(link);
          tabsContainer.appendChild(tabItem);
        });

        hostGroup.appendChild(hostTitle);
        hostGroup.appendChild(tabsContainer);
        
        const hostLi = document.createElement('li');
        hostLi.appendChild(hostGroup);
        parentElement.appendChild(hostLi);
      });
    }

    function displayBookmarks(nodes, parentElement, isSearchResult = false, level = 0) {
      parentElement.innerHTML = '';

      if (nodes.length === 0 || (nodes[0].children && nodes[0].children.length === 0)) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
          <div class="empty-icon">📚</div>
          <div>No bookmarks found</div>
        `;
        parentElement.appendChild(emptyState);
        return;
      }

      nodes.forEach(node => {
        const listItem = document.createElement('li');
        listItem.style.marginLeft = `${level * 12}px`;

        if (isSearchResult && node.path) {
          const pathElement = document.createElement('div');
          pathElement.className = 'bookmark-path';
          pathElement.textContent = `${CONFIG.DEFAULT_ICONS.FOLDER} ${node.path.join(' > ')}`;
          listItem.appendChild(pathElement);
        }

        if (node.children) {
          const bookmarkFolder = document.createElement('div');
          bookmarkFolder.className = 'bookmark-folder';

          const folderTitle = document.createElement('div');
          folderTitle.className = 'folder-title';

          const folderIcon = document.createElement('span');
          folderIcon.className = 'folder-icon';
          folderIcon.textContent = CONFIG.DEFAULT_ICONS.FOLDER;

          const folderText = document.createElement('span');
          folderText.textContent = node.title || '⭐️ Bookmarks Tools';

          folderTitle.appendChild(folderIcon);
          folderTitle.appendChild(folderText);

          const subList = document.createElement('ul');
          subList.style.paddingLeft = '0';
          
          let isExpanded = level === 0; // Only expand root level by default
          subList.style.display = isExpanded ? 'block' : 'none';

          folderTitle.addEventListener('click', () => {
            isExpanded = !isExpanded;
            subList.style.display = isExpanded ? 'block' : 'none';
          });

          displayBookmarks(node.children, subList, false, level + 1);

          bookmarkFolder.appendChild(folderTitle);
          if (node.children.length > 0) {
            bookmarkFolder.appendChild(subList);
          }
          listItem.appendChild(bookmarkFolder);
        } else {
          const link = document.createElement('a');
          link.className = 'bookmark-link';
          link.href = node.url;
          link.textContent = node.title || 'Untitled Bookmark';

          const icon = document.createElement('img');
          icon.className = 'favicon';
          icon.src = getFaviconUrl(node.url);
          icon.onerror = () => {
            icon.style.display = 'none';
            const fallback = document.createElement('span');
            fallback.textContent = CONFIG.DEFAULT_ICONS.BOOKMARK;
            fallback.style.marginRight = '8px';
            link.prepend(fallback);
          };
          link.prepend(icon);

          link.addEventListener('click', (event) => {
            event.preventDefault();
            window.open(link.href, '_blank');
            if (searchBox._cleanup) searchBox._cleanup();
            searchBox.remove();
          });

          listItem.appendChild(link);
        }
        parentElement.appendChild(listItem);
      });
    }
  }

  // Main execution
  const existingBox = document.getElementById(CONFIG.UI.SEARCH_BOX_ID);
  if (existingBox) {
    existingBox.remove();
  } else {
    createSearchBox(bookmarkTreeNodes, alltabs);
  }
}

// Event listeners
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  if (command === COMMANDS.OPEN_SEARCH_BOX) {
    console.log('Processing open-search-box command');
    
    try {
      console.log('Getting tabs and bookmarks...');
      const [alltabs, activeTab, bookmarkTreeNodes] = await Promise.all([
        getAllTabs(),
        getActiveTab(),
        getBookmarkTree()
      ]);

      console.log('Active tab:', activeTab ? activeTab.url : 'none');
      console.log('All tabs count:', alltabs.length);
      
      if (activeTab && !activeTab.url.startsWith('chrome://')) {
        console.log('Injecting script into tab:', activeTab.id);
        
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: tabGrouper,
          args: [bookmarkTreeNodes, alltabs]
        });
        
        console.log('Script injection completed');
      } else {
        console.warn('Cannot inject script - invalid tab or chrome:// page');
      }
    } catch (error) {
      console.error('Script execution error:', error);
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
    [ACTIONS.SEARCH]: handleSearch
  };

  const handler = messageHandlers[request.action];
  if (handler) {
    const result = handler(request, sender, sendResponse);
    if (result === true) {
      return true;
    }
  }
});

function handleActivateTab(request) {
  activateTab(request.tabId);
}

function handleRemoveTab(request, sender, sendResponse) {
  removeTab(request.tabId).then(() => {
    sendResponse({ success: true });
  });
  return true;
}

async function handleRefreshGroupedTabs() {
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
  } catch (error) {
    console.error('Refresh error:', error);
  }
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

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const alltabs = await getAllTabs();
    const groupedTabs = await groupTabsByHost(alltabs);

    for (const [host, tabs] of Object.entries(groupedTabs)) {
      const tabIds = tabs.map(tab => tab.id);
      
      chrome.tabs.group({ tabIds }, (groupId) => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to create group:', chrome.runtime.lastError);
          return;
        }
        
        chrome.tabGroups.update(groupId, { title: host });
      });
    }
  } catch (error) {
    console.error('Installation setup error:', error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  try {
    const supportedHosts = await getSupportedHosts();
    const host = mapUrlToHost(tab.url, supportedHosts);

    const groups = await chrome.tabGroups.query({});
    const existingGroup = groups.find(group => group.title === host);

    if (existingGroup) {
      chrome.tabs.group({
        tabIds: [tabId],
        groupId: existingGroup.id
      });
    } else {
      chrome.tabs.group({ tabIds: [tabId] }, (groupId) => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to create new group:', chrome.runtime.lastError);
          return;
        }
        
        chrome.tabGroups.update(groupId, { title: host });
      });
    }
  } catch (error) {
    console.error('Tab update error:', error);
  }
});

console.log('TabGrouper background script loaded successfully');