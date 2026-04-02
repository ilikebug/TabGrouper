// UI Components module - Standalone for content script injection
// This file will be dynamically imported in content script context

// Configuration constants - duplicated to avoid import issues in content scripts
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

const ACTIONS = {
  ACTIVATE_TAB: 'activateTab',
  REMOVE_TAB: 'removeTab',
  REFRESH_GROUPED_TABS: 'refreshGroupedTabs',
  SEARCH: 'search'
};

// Utility functions - duplicated to avoid import issues
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

function createFaviconElement(url, fallbackIcon = CONFIG.DEFAULT_ICONS.SEARCH) {
  const icon = document.createElement('img');
  icon.src = getFaviconUrl(url);
  icon.style.width = '16px';
  icon.style.height = '16px';
  icon.style.marginRight = '5px';
  
  icon.onerror = () => {
    icon.style.display = 'none';
    const fallback = document.createElement('span');
    fallback.textContent = fallbackIcon;
    fallback.style.marginRight = '5px';
    icon.parentNode?.insertBefore(fallback, icon);
  };
  
  return icon;
}

function createDeleteButton(onClickHandler) {
  const button = document.createElement('button');
  button.textContent = CONFIG.DEFAULT_ICONS.DELETE;
  button.title = '关闭标签页';
  
  // Apply styles directly
  button.style.all = 'unset';
  button.style.cursor = 'pointer';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.width = '20px';
  button.style.height = '20px';
  button.style.borderRadius = '50%';
  button.style.backgroundColor = '#f0f0f0';
  button.style.color = '#666';
  button.style.fontSize = '12px';
  button.style.transition = 'all 0.2s';
  
  button.onmouseover = () => {
    button.style.backgroundColor = '#ef4444';
    button.style.color = 'white';
  };
  
  button.onmouseout = () => {
    button.style.backgroundColor = '#f0f0f0';
    button.style.color = '#666';
  };
  
  if (onClickHandler) {
    button.addEventListener('click', onClickHandler);
  }
  
  return button;
}

function createBookmarkButton(onClickHandler) {
  const button = document.createElement('button');
  button.textContent = '⭐';
  button.title = '收藏此页面';
  
  // Apply styles directly
  button.style.all = 'unset';
  button.style.cursor = 'pointer';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.width = '20px';
  button.style.height = '20px';
  button.style.borderRadius = '50%';
  button.style.backgroundColor = '#f0f0f0';
  button.style.color = '#666';
  button.style.fontSize = '12px';
  button.style.transition = 'all 0.2s';
  
  button.onmouseover = () => {
    button.style.backgroundColor = '#fbbf24';
    button.style.color = 'white';
    button.style.transform = 'scale(1.1)';
  };
  
  button.onmouseout = () => {
    button.style.backgroundColor = '#f0f0f0';
    button.style.color = '#666';
    button.style.transform = 'scale(1)';
  };
  
  if (onClickHandler) {
    button.addEventListener('click', onClickHandler);
  }
  
  return button;
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

/**
 * Creates the main search box UI
 * @param {Array} bookmarkTreeNodes - The bookmark tree
 * @param {Array} alltabs - All available tabs
 */
export async function createSearchBox(bookmarkTreeNodes, alltabs) {
  const searchBox = document.createElement('div');
  searchBox.id = CONFIG.UI.SEARCH_BOX_ID;
  const shadow = searchBox.attachShadow({ mode: 'open' });

  const style = createSearchBoxStyles();
  const container = createContainer();
  const header = createSearchHeader();
  const input = createSearchInput();
  const listsContainer = createListsContainer();
  const [bookmarkList, tabList] = createLists();

  // Display initial grouped tabs
  const groupedTabs = await groupTabsByHost(alltabs);
  displayGroupedTabs(groupedTabs, tabList);

  // Set up search functionality with debouncing
  const debouncedSearch = debounce(async (query) => {
    if (query) {
      const results = await performSearch(query);
      updateSearchResults(results, bookmarkList, tabList);
    } else {
      await resetToDefault(bookmarkTreeNodes, alltabs, bookmarkList, tabList);
    }
  }, 300);

  input.addEventListener('input', (e) => {
    debouncedSearch(e.target.value.toLowerCase());
  });

  // Display initial bookmarks
  displayBookmarks(bookmarkTreeNodes, bookmarkList);

  // Assemble UI
  listsContainer.appendChild(bookmarkList);
  listsContainer.appendChild(tabList);
  container.appendChild(header);
  container.appendChild(input);
  container.appendChild(listsContainer);
  shadow.appendChild(style);
  shadow.appendChild(container);
  document.body.appendChild(searchBox);

  // Set up input focus and keyboard handling
  setupInputHandling(input, searchBox);
}

/**
 * Creates the styles for the search box
 */
function createSearchBoxStyles() {
  const style = document.createElement('style');
  style.textContent = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #333;
    }
    
    #container {
      position: fixed;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 20px;
      padding: 0;
      box-shadow: 
        0 20px 40px rgba(0, 0, 0, 0.1),
        0 0 0 1px rgba(255, 255, 255, 0.5);
      width: ${CONFIG.UI.WIDTH_PERCENTAGE}%;
      min-width: ${CONFIG.UI.MIN_WIDTH}px;
      height: ${CONFIG.UI.HEIGHT_PERCENTAGE}%;
      min-height: ${CONFIG.UI.MIN_HEIGHT}px;
      display: flex;
      flex-direction: column;
      font-size: 14px !important;
      line-height: 1.4 !important;
      overflow: hidden;
    }

    .search-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .search-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 18px;
    }

    .search-title .icon {
      font-size: 20px;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .bookmark-btn {
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 8px 16px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .bookmark-btn:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .bookmark-btn .icon {
      font-size: 14px;
    }

    .bookmark-btn .shortcut {
      font-size: 11px;
      opacity: 0.8;
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 4px;
    }
    
    input {
      width: 100%;
      padding: 12px 20px;
      border: none;
      border-bottom: 1px solid rgba(226, 232, 240, 0.6);
      border-radius: 0;
      box-sizing: border-box;
      background-color: transparent !important;
      margin: 0;
      font-size: 14px !important;
      outline: none;
      color: #1e293b !important;
      -webkit-text-fill-color: #1e293b !important;
      opacity: 1 !important;
      flex-shrink: 0;
    }
    
    input::placeholder {
      color: #999999 !important;
      -webkit-text-fill-color: #999999 !important;
      opacity: 1 !important;
    }
    
    input:focus {
      border-bottom-color: rgba(99, 102, 241, 0.6);
      box-shadow: 0 1px 0 rgba(99, 102, 241, 0.6);
      color: #1e293b !important;
      -webkit-text-fill-color: #1e293b !important;
    }
    
    #lists {
      display: flex;
      flex-direction: row;
      flex: 1;
      overflow: auto;
      gap: 20px;
      padding: 20px;
    }
    
    ul {
      list-style-type: none !important;
      padding: 0 !important;
      margin: 0 !important;
      max-height: 100%;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    a {
      display: flex !important;
      align-items: center !important;
      padding: 8px 0 !important;
      color: #333 !important;
      text-decoration: none !important;
      border-bottom: 1px solid #ddd !important;
      font-size: 14px !important;
      min-height: 32px !important;
    }
    
    a:hover {
      background-color: rgba(74, 144, 226, 0.1);
    }
    
    img {
      width: 16px !important;
      height: 16px !important;
      margin-right: 5px !important;
      flex-shrink: 0 !important;
    }
    
    button {
      all: unset;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: rgba(248, 250, 252, 0.8);
      color: #6b7280;
      font-size: 12px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(226, 232, 240, 0.6);
    }
    
    button:hover {
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #999;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  return style;
}

function createContainer() {
  const container = document.createElement('div');
  container.id = 'container';
  return container;
}

function createSearchHeader() {
  const header = document.createElement('div');
  header.className = 'search-header';
  
  // Detect platform for correct shortcut display
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcutKey = isMac ? 'Cmd+S' : 'Ctrl+S';
  const shortcutTitle = isMac ? '保存当前页面为书签 (Cmd+S)' : '保存当前页面为书签 (Ctrl+S)';
  
  header.innerHTML = `
    <div class="search-title">
      <span class="icon">🚀</span>
      <span class="title">TabGrouper</span>
    </div>
    <div class="header-actions">
      <button class="bookmark-btn" id="bookmark-current-tab" title="${shortcutTitle}">
        <span class="icon">⭐</span>
        <span class="text">保存书签</span>
        <span class="shortcut">${shortcutKey}</span>
      </button>
    </div>
  `;

  // Setup bookmark button event
  const bookmarkBtn = header.querySelector('#bookmark-current-tab');
  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', async () => {
      try {
        // Dynamic import to avoid circular dependencies
        const { BookmarkManager } = await import('./bookmarkManager.js');
        const bookmarkManager = new BookmarkManager();
        await bookmarkManager.showBookmarkDialog();
      } catch (error) {
        console.error('Error loading bookmark manager:', error);
      }
    });
  }

  return header;
}

function createSearchInput() {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search...';
  input.style.position = 'relative';
  input.style.zIndex = '10001';
  return input;
}

function createListsContainer() {
  const listsContainer = document.createElement('div');
  listsContainer.id = 'lists';
  return listsContainer;
}

function createLists() {
  const bookmarkList = document.createElement('ul');
  const tabList = document.createElement('ul');
  tabList.style.marginLeft = '20px';
  return [bookmarkList, tabList];
}

function performSearch(query) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: ACTIONS.SEARCH, query: query },
      (results) => {
        const tabs = results.filter(item => item.type === 'tab');
        const bookmarks = results.filter(item => item.type === 'bookmark');
        resolve({ tabs, bookmarks });
      }
    );
  });
}

async function updateSearchResults(results, bookmarkList, tabList) {
  const groupedTabs = await groupTabsByHost(results.tabs);
  displayGroupedTabs(groupedTabs, tabList);
  
  bookmarkList.innerHTML = '';
  displayBookmarks(results.bookmarks, bookmarkList, true);
}

async function resetToDefault(bookmarkTreeNodes, alltabs, bookmarkList, tabList) {
  const groupedTabs = await groupTabsByHost(alltabs);
  displayGroupedTabs(groupedTabs, tabList);
  displayBookmarks(bookmarkTreeNodes, bookmarkList);
}

function setupInputHandling(input, searchBox) {
  setTimeout(() => {
    input.focus();
    input.addEventListener('blur', () => {
      setTimeout(() => input.focus(), 0);
    });
  }, CONFIG.UI.INPUT_FOCUS_DELAY);

  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
      searchBox.remove();
    }
    // Ctrl+S or Cmd+S to save bookmark
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      try {
        const { BookmarkManager } = await import('./bookmarkManager.js');
        const bookmarkManager = new BookmarkManager();
        await bookmarkManager.showBookmarkDialog();
      } catch (error) {
        console.error('Error loading bookmark manager:', error);
      }
    }
    event.stopPropagation();
  });
}

function displayGroupedTabs(groupedTabs, parentElement) {
  parentElement.innerHTML = '';
  
  if (Object.keys(groupedTabs).length === 0) {
    const noResults = document.createElement('li');
    noResults.textContent = 'No matching tab found.';
    noResults.style.padding = '10px';
    noResults.style.color = '#666';
    parentElement.appendChild(noResults);
    return;
  }

  Object.keys(groupedTabs).forEach(host => {
    const hostItem = createHostItem(host, groupedTabs[host]);
    parentElement.appendChild(hostItem);
  });
}

function createHostItem(host, tabs) {
  const hostItem = document.createElement('li');
  const hostTitle = createHostTitle(host);
  const subList = createTabSubList(tabs);

  hostTitle.addEventListener('click', () => {
    subList.style.display = subList.style.display === 'none' ? 'block' : 'none';
  });

  hostItem.appendChild(hostTitle);
  hostItem.appendChild(subList);
  return hostItem;
}

function createHostTitle(host) {
  const hostTitle = document.createElement('span');
  const randomIcon = CONFIG.ICONS[Math.floor(Math.random() * CONFIG.ICONS.length)];
  
  hostTitle.textContent = `${randomIcon} ${host}`;
  hostTitle.style.fontWeight = 'bold';
  hostTitle.style.cursor = 'pointer';
  hostTitle.style.display = 'block';
  hostTitle.style.padding = '5px 0';
  hostTitle.style.borderBottom = '1px solid #ddd';
  hostTitle.style.color = '#FF4500';
  
  return hostTitle;
}

function createTabSubList(tabs) {
  const subList = document.createElement('ul');
  subList.style.listStyleType = 'none';
  subList.style.paddingLeft = '20px';
  subList.style.display = 'block';

  tabs.forEach(tab => {
    const listItem = createTabListItem(tab);
    subList.appendChild(listItem);
  });

  return subList;
}

function createTabListItem(tab) {
  const listItem = document.createElement('li');
  listItem.style.display = 'flex';
  listItem.style.alignItems = 'center';
  listItem.style.gap = '4px';

  const actionsContainer = document.createElement('div');
  actionsContainer.style.display = 'flex';
  actionsContainer.style.gap = '4px';
  actionsContainer.style.marginRight = '8px';

  const bookmarkButton = createBookmarkButton((event) => {
    event.stopPropagation();
    handleTabBookmark(tab);
  });

  const deleteButton = createDeleteButton((event) => {
    event.stopPropagation();
    handleTabDelete(tab.id);
  });

  const link = createTabLink(tab);

  actionsContainer.appendChild(bookmarkButton);
  actionsContainer.appendChild(deleteButton);
  listItem.appendChild(actionsContainer);
  listItem.appendChild(link);
  return listItem;
}

function createTabLink(tab) {
  const link = document.createElement('a');
  link.href = tab.url;
  link.textContent = tab.title || '无标题标签页';
  link.style.flex = '1';
  link.style.display = 'flex';
  link.style.alignItems = 'center';
  link.style.padding = '5px 0';
  link.style.color = '#000';
  link.style.textDecoration = 'none';
  link.style.borderBottom = '1px solid #ddd';

  const icon = createFaviconElement(tab.url);
  link.prepend(icon);

  link.addEventListener('click', (event) => {
    event.preventDefault();
    handleTabActivation(tab.id);
  });

  return link;
}

async function handleTabBookmark(tab) {
  try {
    // Dynamic import to avoid circular dependencies
    const { BookmarkManager } = await import('./bookmarkManager.js');
    const bookmarkManager = new BookmarkManager();
    await bookmarkManager.showBookmarkDialog(tab);
  } catch (error) {
    console.error('Error loading bookmark manager:', error);
  }
}

async function handleBookmarkDelete(bookmarkId) {
  try {
    // Ask for confirmation
    if (confirm('确定要删除这个书签吗？')) {
      await chrome.bookmarks.remove(bookmarkId);
      
      // Show success message
      showBookmarkMessage('书签删除成功！', 'success');
      
      // Refresh the current search/display
      const input = document.querySelector(`#${CONFIG.UI.SEARCH_BOX_ID} input`);
      if (input && input.value.trim()) {
        // If there's a search query, re-run the search
        const results = await performSearch(input.value.toLowerCase());
        const bookmarkList = document.querySelector(`#${CONFIG.UI.SEARCH_BOX_ID} ul:first-child`);
        const tabList = document.querySelector(`#${CONFIG.UI.SEARCH_BOX_ID} ul:last-child`);
        if (bookmarkList && tabList) {
          updateSearchResults(results, bookmarkList, tabList);
        }
      } else {
        // If no search, refresh bookmarks display
        const bookmarkTreeNodes = await chrome.bookmarks.getTree();
        const bookmarkList = document.querySelector(`#${CONFIG.UI.SEARCH_BOX_ID} ul:first-child`);
        if (bookmarkList) {
          displayBookmarks(bookmarkTreeNodes, bookmarkList);
        }
      }
    }
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    showBookmarkMessage('删除书签失败', 'error');
  }
}

function showBookmarkMessage(message, type = 'success') {
  const messageElement = document.createElement('div');
  messageElement.style.position = 'fixed';
  messageElement.style.top = '20px';
  messageElement.style.right = '20px';
  messageElement.style.padding = '12px 20px';
  messageElement.style.borderRadius = '8px';
  messageElement.style.color = 'white';
  messageElement.style.fontWeight = '600';
  messageElement.style.fontSize = '14px';
  messageElement.style.zIndex = '10002';
  messageElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  messageElement.style.animation = 'slideInRight 0.3s ease-out';
  
  if (type === 'success') {
    messageElement.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    messageElement.textContent = `✅ ${message}`;
  } else {
    messageElement.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    messageElement.textContent = `❌ ${message}`;
  }
  
  document.body.appendChild(messageElement);
  
  setTimeout(() => {
    messageElement.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => {
      messageElement.remove();
    }, 300);
  }, 2000);
}

function handleTabDelete(tabId) {
  chrome.runtime.sendMessage({
    action: ACTIONS.REMOVE_TAB,
    tabId: tabId
  }, () => {
    const openBox = document.getElementById(CONFIG.UI.SEARCH_BOX_ID);
    if (openBox) {
      openBox.remove();
    }
    chrome.runtime.sendMessage({ action: ACTIONS.REFRESH_GROUPED_TABS });
  });
}

function handleTabActivation(tabId) {
  chrome.runtime.sendMessage({
    action: ACTIONS.ACTIVATE_TAB,
    tabId: tabId
  });
  const openBox = document.getElementById(CONFIG.UI.SEARCH_BOX_ID);
  if (openBox) {
    openBox.remove();
  }
}

function displayBookmarks(nodes, parentElement, isSearchResult = false, level = 0) {
  parentElement.innerHTML = '';

  if (nodes.length === 0 || (nodes[0].children && nodes[0].children.length === 0)) {
    const noResults = document.createElement('li');
    noResults.textContent = 'No matching bookmarks found.';
    noResults.style.padding = '10px';
    noResults.style.color = '#666';
    parentElement.appendChild(noResults);
    return;
  }

  nodes.forEach(node => {
    const listItem = createBookmarkListItem(node, isSearchResult, level);
    parentElement.appendChild(listItem);
  });
}

function createBookmarkListItem(node, isSearchResult, level) {
  const listItem = document.createElement('li');
  listItem.style.marginLeft = `${level * 5}px`;

  if (isSearchResult && node.path) {
    const pathElement = document.createElement('div');
    pathElement.style.fontSize = '12px';
    pathElement.style.color = '#666';
    pathElement.style.marginBottom = '3px';
    pathElement.textContent = `${CONFIG.DEFAULT_ICONS.FOLDER} ${node.path.join(' > ')}`;
    listItem.appendChild(pathElement);
  }

  if (node.children) {
    const folderElements = createBookmarkFolder(node, level);
    folderElements.forEach(element => listItem.appendChild(element));
  } else {
    const bookmarkContainer = createBookmarkContainer(node);
    listItem.appendChild(bookmarkContainer);
  }

  return listItem;
}

function createBookmarkFolder(node, level) {
  const folderTitle = document.createElement('span');
  folderTitle.style.display = 'flex';
  folderTitle.style.alignItems = 'center';

  const folderIcon = document.createElement('span');
  folderIcon.textContent = CONFIG.DEFAULT_ICONS.FOLDER;
  folderIcon.style.marginRight = '5px';

  const folderText = document.createElement('span');
  folderText.textContent = node.title || '⭐️ Bookmarks Tools';
  folderText.style.fontWeight = 'bold';
  folderText.style.cursor = 'pointer';
  folderText.style.display = 'block';
  folderText.style.padding = '5px 0';
  folderText.style.borderBottom = '1px solid #ddd';
  folderText.style.color = 'blue';

  folderTitle.appendChild(folderIcon);
  folderTitle.appendChild(folderText);

  const subList = document.createElement('ul');
  subList.style.listStyleType = 'none';
  subList.style.padding = '0';
  subList.style.display = 'block';

  folderText.addEventListener('click', () => {
    subList.style.display = subList.style.display === 'none' ? 'block' : 'none';
  });

  displayBookmarks(node.children, subList, false, level + 1);

  return [folderTitle, subList];
}

function createBookmarkContainer(node) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '4px';

  const deleteButton = createBookmarkDeleteButton((event) => {
    event.stopPropagation();
    handleBookmarkDelete(node.id);
  });

  const link = createBookmarkLink(node);

  container.appendChild(deleteButton);
  container.appendChild(link);
  return container;
}

function createBookmarkDeleteButton(onClickHandler) {
  const button = document.createElement('button');
  button.textContent = CONFIG.DEFAULT_ICONS.DELETE;
  button.title = '删除书签';
  
  // Apply styles directly
  button.style.all = 'unset';
  button.style.cursor = 'pointer';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.width = '16px';
  button.style.height = '16px';
  button.style.borderRadius = '50%';
  button.style.backgroundColor = '#f0f0f0';
  button.style.color = '#666';
  button.style.fontSize = '10px';
  button.style.transition = 'all 0.2s';
  button.style.marginRight = '4px';
  
  button.onmouseover = () => {
    button.style.backgroundColor = '#ef4444';
    button.style.color = 'white';
  };
  
  button.onmouseout = () => {
    button.style.backgroundColor = '#f0f0f0';
    button.style.color = '#666';
  };
  
  if (onClickHandler) {
    button.addEventListener('click', onClickHandler);
  }
  
  return button;
}

function createBookmarkLink(node) {
  const link = document.createElement('a');
  link.href = node.url;
  link.textContent = node.title || '无标题书签';
  link.style.display = 'flex';
  link.style.alignItems = 'center';
  link.style.padding = '5px 0';
  link.style.color = 'black';
  link.style.textDecoration = 'none';
  link.style.borderBottom = '1px solid #ddd';
  link.style.flex = '1';

  const icon = createFaviconElement(node.url, CONFIG.DEFAULT_ICONS.BOOKMARK);
  link.prepend(icon);

  link.addEventListener('click', (event) => {
    event.preventDefault();
    window.open(link.href, '_blank');
    const openBox = document.getElementById(CONFIG.UI.SEARCH_BOX_ID);
    if (openBox) {
      openBox.remove();
    }
  });

  return link;
}