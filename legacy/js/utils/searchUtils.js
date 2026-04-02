// Search and bookmark utilities
import { groupTabsByHost } from './tabUtils.js';

/**
 * Searches through tabs and bookmarks
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of search results
 */
export async function searchTabsAndBookmarks(query) {
  const [tabs, bookmarks] = await Promise.all([
    searchTabs(query),
    searchBookmarks(query)
  ]);

  return [...tabs, ...bookmarks];
}

/**
 * Searches through tabs
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of matching tabs
 */
async function searchTabs(query) {
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

  return matchedTabs.map(tab => ({
    type: 'tab',
    id: tab.id,
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl,
    groupId: tab.groupId
  }));
}

/**
 * Searches through bookmarks
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of matching bookmarks with paths
 */
async function searchBookmarks(query) {
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

  return bookmarksWithPath;
}

/**
 * Gets the full path of a bookmark
 * @param {string} bookmarkId - The bookmark ID
 * @returns {Promise<Array>} - Array of folder names in the path
 */
export async function getBookmarkPath(bookmarkId) {
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