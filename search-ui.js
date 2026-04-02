// search-ui.js — Injected search overlay for TabGrouper
// Loaded via importScripts() in background.js.
// Injected into page context via chrome.scripting.executeScript({ function: tabGrouper, args: [...] }).
// Must be self-contained: no imports, no external references.

// Tab grouper main function - will be injected as content script
// This function will be stringified and injected, so it must be self-contained
function tabGrouper(bookmarkTreeNodes, alltabs) {
  try {
    console.log('🚀 tabGrouper function started');
    console.log('🚀 bookmarkTreeNodes:', bookmarkTreeNodes?.length || 0);
    console.log('🚀 alltabs:', alltabs?.length || 0);
    
    // All configuration and utilities must be defined within this function
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
      RECENT_TABS: 'recentTabs'
    },
    DEFAULT_ICONS: { FOLDER: '📂', BOOKMARK: '⭐️', SEARCH: '🔍', DELETE: '✖' }
  };
  
  const ACTIONS = {
    ACTIVATE_TAB: 'activateTab',
    REMOVE_TAB: 'removeTab',
    REFRESH_GROUPED_TABS: 'refreshGroupedTabs',
    SEARCH: 'search',
    OPEN_QUICK_ACCESS_TAB: 'openQuickAccessTab'
  };

  // Bookmark dialog functionality

  function showBookmarkDialogForTab(tab) {
    try {
      createBookmarkDialog(tab);
    } catch (error) {
      console.error('Error showing bookmark dialog for tab:', error);
    }
  }

  function createBookmarkDialog(currentTab) {
    // Remove existing dialog if any
    const existing = document.getElementById('bookmark-dialog-overlay');
    if (existing) {
      existing.remove();
    }

    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'bookmark-dialog-overlay';
    dialogOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      z-index: 100001;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 0;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5);
      width: 520px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: hidden;
      transform: scale(0.9) translateY(20px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    `;

    dialog.innerHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">💾 Save Bookmark</h3>
        <button id="close-bookmark-dialog" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 6px; transition: background-color 0.2s;">✕</button>
      </div>
      
      <div style="padding: 24px;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">📝 Bookmark Name</label>
          <input type="text" id="bookmark-title" placeholder="Enter bookmark name" style="width: 100%; padding: 12px 16px; border: 2px solid transparent; border-radius: 12px; background: rgba(248, 250, 252, 0.8); font-size: 14px; font-weight: 500; color: #1e293b; box-sizing: border-box; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">🔗 Web Address</label>
          <input type="text" id="bookmark-url" readonly style="width: 100%; padding: 12px 16px; border: 2px solid transparent; border-radius: 12px; background: rgba(241, 245, 249, 0.6); font-size: 14px; font-weight: 500; color: #64748b; box-sizing: border-box; cursor: default;">
        </div>
        
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">📁 Select Folder</label>
          <div style="border: 2px solid rgba(226, 232, 240, 0.6); border-radius: 12px; overflow: hidden; background: rgba(248, 250, 252, 0.8);">
            <div id="folder-tree" style="max-height: 200px; overflow-y: auto; padding: 12px 0;">
              <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">Loading folders...</div>
            </div>
            <button id="new-folder-btn" style="width: 100%; padding: 12px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border-top: 1px solid rgba(226, 232, 240, 0.6);">
              <span>+</span>
              <span>New Folder</span>
            </button>
          </div>
        </div>
      </div>
      
      <div style="padding: 20px 24px; background: rgba(248, 250, 252, 0.6); display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancel-bookmark" style="padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); background: rgba(255, 255, 255, 0.8); color: #6b7280; border: 1px solid rgba(209, 213, 219, 0.6);">Cancel</button>
        <button id="save-bookmark" style="padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25); display: flex; align-items: center; gap: 6px;">
          <span>⭐</span>
          <span>Save Bookmark</span>
        </button>
      </div>
    `;
    dialog.querySelector('#bookmark-title').value = currentTab.title || '';
    dialog.querySelector('#bookmark-url').value = currentTab.url || '';

    dialogOverlay.appendChild(dialog);
    document.body.appendChild(dialogOverlay);

    // Show with animation
    requestAnimationFrame(() => {
      dialogOverlay.style.opacity = '1';
      dialog.style.transform = 'scale(1) translateY(0)';
    });

    // Load folder tree
    loadFolderTree(currentTab);

    // Setup event listeners
    setupBookmarkDialogEvents(dialogOverlay, currentTab);

    // Focus on title input
    setTimeout(() => {
      const titleInput = document.getElementById('bookmark-title');
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 100);
  }

  async function loadFolderTree(currentTab) {
    try {
      const folderTree = document.getElementById('folder-tree');
      if (!folderTree) return;

      // Use the bookmarkTreeNodes passed to tabGrouper function
      const folders = extractFolders(bookmarkTreeNodes[0]);
      
      folderTree.innerHTML = '';
      renderFolderTree(folders, folderTree);
      
      // Select bookmarks bar by default
      const bookmarksBar = folderTree.querySelector('.folder-item[data-id="1"]');
      if (bookmarksBar) {
        selectFolder(bookmarksBar);
      }
    } catch (error) {
      console.error('Error loading folder tree:', error);
      const folderTree = document.getElementById('folder-tree');
      if (folderTree) {
        folderTree.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">Loading failed</div>';
      }
    }
  }

  function extractFolders(node, level = 0, path = []) {
    const folders = [];
    
    if (node.children) {
      for (const child of node.children) {
        if (child.children !== undefined) {
          const folder = {
            id: child.id,
            title: child.title || (child.id === '1' ? 'Bookmarks Bar' : child.id === '2' ? 'Other Bookmarks' : 'Mobile Bookmarks'),
            level: level,
            path: [...path, child.title || 'Untitled']
          };
          folders.push(folder);
          
          const subfolders = extractFolders(child, level + 1, folder.path);
          folders.push(...subfolders);
        }
      }
    }
    
    return folders;
  }

  function renderFolderTree(folders, container) {
    folders.forEach(folder => {
      const folderItem = document.createElement('div');
      folderItem.className = 'folder-item';
      folderItem.dataset.id = folder.id;
      folderItem.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 16px;
        cursor: pointer;
        transition: background-color 0.2s;
        font-size: 14px;
        color: #374151;
      `;
      
      for (let i = 0; i < folder.level; i++) {
        const spacer = document.createElement('div');
        spacer.style.cssText = 'width: 20px; flex-shrink: 0;';
        folderItem.appendChild(spacer);
      }
      const folderIcon = document.createElement('span');
      folderIcon.style.cssText = 'margin-right: 8px; font-size: 16px;';
      folderIcon.textContent = '📁';
      folderItem.appendChild(folderIcon);
      const folderLabel = document.createElement('span');
      folderLabel.textContent = folder.title;
      folderItem.appendChild(folderLabel);
      
      folderItem.addEventListener('click', () => selectFolder(folderItem));
      folderItem.addEventListener('mouseover', () => {
        if (!folderItem.classList.contains('selected')) {
          folderItem.style.background = 'rgba(99, 102, 241, 0.05)';
        }
      });
      folderItem.addEventListener('mouseout', () => {
        if (!folderItem.classList.contains('selected')) {
          folderItem.style.background = '';
        }
      });
      
      container.appendChild(folderItem);
    });
  }

  let selectedFolderId = null;

  function selectFolder(folderElement) {
    // Remove previous selection
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('selected');
      item.style.background = '';
      item.style.color = '#374151';
      item.style.fontWeight = '';
    });
    
    // Add selection to clicked folder
    folderElement.classList.add('selected');
    folderElement.style.background = 'rgba(99, 102, 241, 0.1)';
    folderElement.style.color = '#6366f1';
    folderElement.style.fontWeight = '600';
    selectedFolderId = folderElement.dataset.id;
  }

  function setupBookmarkDialogEvents(dialogOverlay, currentTab) {
    const closeBtn = document.getElementById('close-bookmark-dialog');
    const cancelBtn = document.getElementById('cancel-bookmark');
    const saveBtn = document.getElementById('save-bookmark');
    const newFolderBtn = document.getElementById('new-folder-btn');
    const titleInput = document.getElementById('bookmark-title');

    // Close dialog events
    closeBtn?.addEventListener('click', () => hideBookmarkDialog(dialogOverlay));
    cancelBtn?.addEventListener('click', () => hideBookmarkDialog(dialogOverlay));
    
    // Save bookmark
    saveBtn?.addEventListener('click', () => saveBookmark(dialogOverlay, currentTab));
    
    // New folder
    newFolderBtn?.addEventListener('click', () => showNewFolderDialog(currentTab));
    
    // Enter key support
    titleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveBookmark(dialogOverlay, currentTab);
      }
    });

    // Escape key to close
    dialogOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideBookmarkDialog(dialogOverlay);
      }
    });

    // Click overlay to close
    dialogOverlay.addEventListener('click', (e) => {
      if (e.target === dialogOverlay) {
        hideBookmarkDialog(dialogOverlay);
      }
    });
  }

  async function saveBookmark(dialogOverlay, currentTab) {
    try {
      const titleInput = document.getElementById('bookmark-title');
      const title = titleInput?.value.trim() || currentTab?.title || 'Untitled';
      const url = currentTab?.url;
      const parentId = selectedFolderId || '1';

      if (!url) {
        showMessage('Unable to get page address', 'error');
        return;
      }

      // Use message passing to save bookmark (background script will handle duplication check)
      chrome.runtime.sendMessage({
        action: 'createBookmark',
        parentId: parentId,
        title: title,
        url: url
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          showMessage('Failed to save bookmark', 'error');
          return;
        }
        
        if (response && response.success) {
          showMessage('Bookmark saved successfully!', 'success');
          
          // Close current interface and refresh like bookmark deletion
          const searchBox = document.getElementById(CONFIG.UI.SEARCH_BOX_ID);
          if (searchBox) {
            if (searchBox._cleanup) searchBox._cleanup();
            searchBox.remove();
          }
          chrome.runtime.sendMessage({ action: ACTIONS.REFRESH_GROUPED_TABS });
          
          // Hide dialog after refresh to avoid timing issues
          hideBookmarkDialog(dialogOverlay);
        } else {
          showMessage(response?.error || 'Failed to save bookmark', 'error');
        }
      });
      
    } catch (error) {
      console.error('Error saving bookmark:', error);
      if (error.message.includes('duplicate')) {
        showMessage('This page is already bookmarked', 'error');
      } else {
        showMessage('Failed to save bookmark', 'error');
      }
    }
  }

  function hideBookmarkDialog(dialogOverlay) {
    const dialog = dialogOverlay.querySelector('div');
    dialogOverlay.style.opacity = '0';
    if (dialog) {
      dialog.style.transform = 'scale(0.9) translateY(20px)';
    }
    
    setTimeout(() => {
      dialogOverlay?.remove();
      selectedFolderId = null;
    }, 300);
  }

  function showNewFolderDialog(currentTab) {
    const parentFolderName = getSelectedFolderName();
    
    // Remove existing folder dialog if any
    const existing = document.getElementById('folder-dialog-overlay');
    if (existing) {
      existing.remove();
    }

    const folderDialogOverlay = document.createElement('div');
    folderDialogOverlay.id = 'folder-dialog-overlay';
    folderDialogOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 100002;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    const folderDialog = document.createElement('div');
    folderDialog.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 0;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.5);
      width: 420px;
      max-width: 90vw;
      overflow: hidden;
      transform: scale(0.9) translateY(20px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    `;

    folderDialog.innerHTML = `
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">📁 New Folder</h3>
        <button id="close-folder-dialog" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 6px; transition: background-color 0.2s;">✕</button>
      </div>
      
      <div style="padding: 24px;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">📝 Folder Name</label>
          <input type="text" id="folder-name" placeholder="Enter folder name" autocomplete="off" style="width: 100%; padding: 12px 16px; border: 2px solid transparent; border-radius: 12px; background: rgba(248, 250, 252, 0.8); font-size: 14px; font-weight: 500; color: #1e293b; box-sizing: border-box; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
        </div>
        
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">📂 Create Location</label>
          <div id="folder-location-display" style="background: rgba(99, 102, 241, 0.1); color: #6366f1; padding: 12px 16px; border-radius: 10px; font-size: 14px; font-weight: 500; border: 1px solid rgba(99, 102, 241, 0.2);"></div>
        </div>
      </div>
      
      <div style="padding: 20px 24px; background: rgba(248, 250, 252, 0.6); display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancel-folder" style="padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); background: rgba(255, 255, 255, 0.8); color: #6b7280; border: 1px solid rgba(209, 213, 219, 0.6);">Cancel</button>
        <button id="create-folder" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);">
          <span>+</span>
          <span>Create</span>
        </button>
      </div>
    `;
    folderDialog.querySelector('#folder-location-display').textContent = `Create under "${parentFolderName}"`;

    folderDialogOverlay.appendChild(folderDialog);
    document.body.appendChild(folderDialogOverlay);

    // Show with animation
    requestAnimationFrame(() => {
      folderDialogOverlay.style.opacity = '1';
      folderDialog.style.transform = 'scale(1) translateY(0)';
    });

    // Setup events
    setupFolderDialogEvents(folderDialogOverlay, currentTab);

    // Focus on folder name input
    setTimeout(() => {
      const folderNameInput = document.getElementById('folder-name');
      if (folderNameInput) {
        folderNameInput.focus();
      }
    }, 100);
  }

  function getSelectedFolderName() {
    const selectedFolder = document.querySelector('.folder-item.selected span:last-child');
    return selectedFolder?.textContent || 'Bookmarks Bar';
  }

  function setupFolderDialogEvents(folderDialogOverlay, currentTab) {
    const closeBtn = document.getElementById('close-folder-dialog');
    const cancelBtn = document.getElementById('cancel-folder');
    const createBtn = document.getElementById('create-folder');
    const folderNameInput = document.getElementById('folder-name');

    // Close dialog events
    closeBtn?.addEventListener('click', () => hideFolderDialog(folderDialogOverlay));
    cancelBtn?.addEventListener('click', () => hideFolderDialog(folderDialogOverlay));
    
    // Create folder
    createBtn?.addEventListener('click', () => createNewFolder(folderDialogOverlay, currentTab));
    
    // Enter key support
    folderNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        createNewFolder(folderDialogOverlay, currentTab);
      }
    });

    // Escape key to close
    folderDialogOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideFolderDialog(folderDialogOverlay);
      }
    });

    // Click overlay to close
    folderDialogOverlay.addEventListener('click', (e) => {
      if (e.target === folderDialogOverlay) {
        hideFolderDialog(folderDialogOverlay);
      }
    });
  }

  function hideFolderDialog(folderDialogOverlay) {
    const dialog = folderDialogOverlay.querySelector('div');
    folderDialogOverlay.style.opacity = '0';
    if (dialog) {
      dialog.style.transform = 'scale(0.9) translateY(20px)';
    }
    
    setTimeout(() => {
      folderDialogOverlay?.remove();
    }, 300);
  }

  async function createNewFolder(folderDialogOverlay, currentTab) {
    try {
      const folderNameInput = document.getElementById('folder-name');
      const folderName = folderNameInput?.value.trim();
      
      if (!folderName) {
        folderNameInput?.focus();
        return;
      }

      const parentId = selectedFolderId || '1';
      
      const newFolder = await chrome.bookmarks.create({
        parentId: parentId,
        title: folderName
      });

      hideFolderDialog(folderDialogOverlay);
      await loadFolderTree(currentTab);
      
      // Select the newly created folder
      const newFolderElement = document.querySelector(`.folder-item[data-id="${newFolder.id}"]`);
      if (newFolderElement) {
        selectFolder(newFolderElement);
        newFolderElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
    } catch (error) {
      console.error('Error creating folder:', error);
      showMessage('Failed to create folder', 'error');
    }
  }

  function showMessage(message, type = 'success') {
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 12px;
      color: white;
      font-weight: 600;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(8px);
      transform: translateX(100%);
      transition: transform 0.3s ease-out;
    `;
    
    if (type === 'success') {
      messageElement.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      messageElement.textContent = `✅ ${message}`;
    } else {
      messageElement.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      messageElement.textContent = `❌ ${message}`;
    }
    
    document.body.appendChild(messageElement);
    
    requestAnimationFrame(() => {
      messageElement.style.transform = 'translateX(0)';
    });
    
    setTimeout(() => {
      messageElement.style.transform = 'translateX(100%)';
      setTimeout(() => {
        messageElement.remove();
      }, 300);
    }, 2000);
  }

  // Utility functions - must be defined inline
  function isValidUrl(string) {
    // Check if it's a domain pattern (like example.com, google.com)
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}(\/.*)?$/;
    
    // Check if it's already a full URL
    const urlPattern = /^https?:\/\//i;
    
    // Check if it's localhost or IP
    const localhostPattern = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.).*$/;
    
    return urlPattern.test(string) || domainPattern.test(string) || localhostPattern.test(string);
  }
  
  function normalizeUrl(string) {
    const trimmed = string.trim();
    
    // If it already has a protocol, return as is
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    
    // Add https:// for everything else
    return 'https://' + trimmed;
  }
  
  function highlightText(text, query) {
    const sourceText = String(text || '');
    const safeText = escapeHtml(sourceText);
    if (!query || !sourceText) return safeText;

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return safeText.replace(regex, '<mark style="background: rgba(16, 185, 129, 0.3); padding: 1px 2px; border-radius: 2px; font-weight: 600;">$1</mark>');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }





  function getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
    } catch (error) {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23ccc"/></svg>';
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

  // Helper functions for tab grouping
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

  // Recent tabs functions - internal to tabGrouper
  async function getRecentTabs() {
    try {
      const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.RECENT_TABS);
      const allTabs = result[CONFIG.STORAGE_KEYS.RECENT_TABS] || [];
      
      // Filter out tabs older than 24 hours
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      const validTabs = allTabs.filter(tab => tab.timestamp > twentyFourHoursAgo);
      
      // Update storage if we filtered out expired tabs
      if (validTabs.length !== allTabs.length) {
        await chrome.storage.local.set({
          [CONFIG.STORAGE_KEYS.RECENT_TABS]: validTabs
        });
      }
      
      return validTabs;
    } catch (error) {
      console.error('Error getting recent tabs:', error);
      return [];
    }
  }

  async function addToRecentTabs(tab) {
    try {
      const recentTabs = await getRecentTabs();
      
      // Remove existing entry if present (by URL instead of ID)
      const filteredTabs = recentTabs.filter(item => item.url !== tab.url);
      
      // Add to front with timestamp
      const newEntry = {
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favicon: tab.favIconUrl,
        timestamp: Date.now()
      };
      
      filteredTabs.unshift(newEntry);
      
      // No limit on count - rely on 24h expiry for cleanup
      await chrome.storage.local.set({
        [CONFIG.STORAGE_KEYS.RECENT_TABS]: filteredTabs
      });
      console.log('Internal addToRecentTabs: added', tab.title, 'total count:', filteredTabs.length);
    } catch (error) {
      console.error('Error adding to recent tabs:', error);
    }
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
        padding: 20px;
      }
      
      .interface-wrapper {
        display: flex;
        align-items: center;
        gap: 4px;
        max-width: 95vw;
        height: 80vh;
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
        width: 750px;
        height: 100%;
        max-height: 750px;
        min-height: 500px;
        display: flex;
        flex-direction: column;
        animation: slideIn 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        will-change: transform, opacity;
        transform: translateZ(0);
      }
      
      .sidebar {
        position: relative;
        width: 320px;
        height: 100%;
        max-height: 750px;
        min-height: 500px;
        background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 20px;
        padding: 20px;
        box-shadow: 
          0 20px 60px rgba(0,0,0,0.12),
          0 8px 32px rgba(0,0,0,0.06),
          inset 0 1px 0 rgba(255,255,255,0.9);
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow: hidden;
        z-index: 100000;
        animation: slideInRight 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        will-change: transform, opacity;
      }
      
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      .sidebar-title {
        font-size: 12px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 8px;
        padding: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(248, 250, 252, 0.8);
        border-radius: 8px;
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
        flex-direction: column;
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
        gap: 4px;
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
        font-size: 12px;
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
        font-size: 12px;
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
        padding: 8px 12px;
        font-weight: 600;
        font-size: 12px;
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
        font-size: 12px;
      }
      
      .bookmark-link {
        display: flex !important;
        align-items: center !important;
        padding: 6px 12px !important;
        color: #374151 !important;
        text-decoration: none !important;
        border: none !important;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
        border-bottom: 1px solid rgba(226, 232, 240, 0.2) !important;
      }
      
      .bookmark-link:hover {
        color: #059669 !important;
        background: linear-gradient(135deg, rgba(5, 150, 105, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%);
      }
      
      .bookmark-path {
        font-size: 10px;
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
      
      /* Enhanced scrollbar for sidebar */
      .sidebar-recent-list::-webkit-scrollbar {
        width: 8px;
      }
      
      .sidebar-recent-list::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        margin: 4px;
      }
      
      .sidebar-recent-list::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.5);
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .sidebar-recent-list::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.7);
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
      
      /* Sidebar Recent Tabs Styles */
      .sidebar-recent-list {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 4px;
        margin: 0;
        list-style: none;
        max-height: calc(100% - 60px); /* Leave space for title */
        display: block;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 6px;
        border: 1px solid rgba(226, 232, 240, 0.4);
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
      }
      
      .sidebar-recent-item {
        margin: 0 0 2px 0;
        padding: 0;
        border-radius: 8px;
        overflow: hidden;
        display: block;
        width: 100%;
      }
      
      .sidebar-recent-link {
        display: flex !important;
        align-items: center !important;
        padding: 6px 10px !important;
        text-decoration: none !important;
        border: none !important;
        color: #374151 !important;
        transition: all 0.2s ease;
        border-radius: 8px;
        font-size: 12px;
        background: rgba(255, 255, 255, 0.5);
        width: 100%;
        box-sizing: border-box;
        min-height: 28px;
      }
      
      .sidebar-recent-link:hover {
        background: rgba(255, 255, 255, 0.9);
        color: #059669 !important;
        transform: translateX(2px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        cursor: pointer;
      }
      
      .sidebar-recent-link:active {
        transform: translateX(1px);
        background: rgba(5, 150, 105, 0.1);
      }
      
      .sidebar-favicon {
        flex-shrink: 0;
      }
      
      .sidebar-title-text {
        flex: 1;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.2;
      }
      
      .sidebar-time {
        font-size: 11px;
        color: rgba(100, 116, 139, 0.7);
        font-weight: 400;
        margin-left: 4px;
        flex-shrink: 0;
      }
      
      .sidebar-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: rgba(100, 116, 139, 0.5);
        font-size: 12px;
        text-align: center;
      }
      
      .sidebar-empty-icon {
        font-size: 24px;
        margin-bottom: 8px;
        opacity: 0.6;
      }
      
      /* Keyboard navigation selection style */
      .keyboard-selected {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%) !important;
        border: 2px solid rgba(99, 102, 241, 0.4) !important;
        border-radius: 8px !important;
        transform: translateX(4px) !important;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2) !important;
      }
      
      /* Active area style */
      .section-active {
        background: rgba(99, 102, 241, 0.05) !important;
        border-radius: 12px !important;
        border: 1px solid rgba(99, 102, 241, 0.2) !important;
        transition: all 0.3s ease !important;
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
    input.placeholder = '🔍 Search tabs, bookmarks, hosts, or enter URL...';

    const listsContainer = document.createElement('div');
    listsContainer.id = 'lists';

    // Create main sections
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
        // Search in tabs and bookmarks
        chrome.runtime.sendMessage({ action: ACTIONS.SEARCH, query: query }, async (results) => {
          const tabs = results.filter(item => item.type === 'tab');
          const bookmarks = results.filter(item => item.type === 'bookmark');
          
          // Also search in Quick Access
          const recentTabs = await getRecentTabs();
          const filteredRecentTabs = recentTabs.filter(tab => {
            const title = (tab.title || '').toLowerCase();
            const url = (tab.url || '').toLowerCase();
            return title.includes(query) || url.includes(query);
          });
          
          updateSearchResults({ tabs, bookmarks }, bookmarkList, tabList);
          displaySidebarRecentTabs(recentTabsList, filteredRecentTabs, query);
          
          // Reset keyboard selection state
          currentSection = 0;
          selectedIndex = -1;
          
          // Update sidebar title with search results count
          if (filteredRecentTabs.length > 0) {
            searchBox._sidebarTitle.innerHTML = `⚡ Quick Access (${filteredRecentTabs.length} found)`;
          } else {
            searchBox._sidebarTitle.innerHTML = '⚡ Quick Access (no matches)';
          }
        });
      } else {
        const groupedTabs = await groupTabsByHost(alltabs);
        displayGroupedTabs(groupedTabs, tabList);
        
        displayBookmarks(bookmarkTreeNodes[0]?.children || [], bookmarkList);
        displaySidebarRecentTabs(recentTabsList);
        
        // Reset keyboard selection state
        currentSection = 0;
        selectedIndex = -1;
        
        // Reset sidebar title when not searching
        searchBox._sidebarTitle.innerHTML = '⚡ Quick Access';
      }
    }, 300);

    input.addEventListener('input', (e) => {
      e.stopPropagation();
      
      const value = e.target.value.trim();
      
      // Check if it looks like a URL and update styling
      if (value && isValidUrl(value)) {
        input.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        input.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1), 0 8px 24px rgba(0,0,0,0.08)';
      } else {
        input.style.borderColor = '';
        input.style.boxShadow = '';
      }
      
      debouncedSearch(value.toLowerCase());
    });


    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';

    const sidebarTitle = document.createElement('div');
    sidebarTitle.className = 'sidebar-title';
    sidebarTitle.innerHTML = '⚡ Quick Access';
    
    // Store reference for updating search results count
    searchBox._sidebarTitle = sidebarTitle;

    const recentTabsList = document.createElement('ul');
    recentTabsList.className = 'sidebar-recent-list';

    // Display initial data
    displayBookmarks(bookmarkTreeNodes[0]?.children || [], bookmarkList);
    displaySidebarRecentTabs(recentTabsList);

    // Assemble main interface
    listsContainer.appendChild(bookmarkSection);
    listsContainer.appendChild(tabSection);
    container.appendChild(closeHint);
    container.appendChild(header);
    container.appendChild(input);
    container.appendChild(listsContainer);

    // Assemble sidebar
    sidebar.appendChild(sidebarTitle);
    sidebar.appendChild(recentTabsList);

    // Create wrapper for both interfaces
    const wrapper = document.createElement('div');
    wrapper.className = 'interface-wrapper';
    wrapper.appendChild(container);
    wrapper.appendChild(sidebar);
    
    overlay.appendChild(wrapper);
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
      
      // Prevent input blur to maintain focus (but allow dialogs to take focus)
      input.addEventListener('blur', (e) => {
        e.stopPropagation();
        setTimeout(() => {
          // Only refocus if no dialog is open
          const hasDialog = document.getElementById('bookmark-dialog-overlay') || 
                           document.getElementById('folder-dialog-overlay');
          
          if (document.getElementById(CONFIG.UI.SEARCH_BOX_ID) && !hasDialog) {
            input.focus();
          }
        }, 0);
      });
    }, 0);

    // Current selected area and index
    let currentSection = 0; // 0: bookmarks, 1: tabs, 2: sidebar
    let selectedIndex = -1;
    
    const getSections = () => {
      return [
        {
          name: 'bookmarks',
          items: Array.from(bookmarkList.querySelectorAll('.bookmark-link')),
          container: bookmarkSection
        },
        {
          name: 'tabs', 
          items: Array.from(tabList.querySelectorAll('.tab-link')),
          container: tabSection
        },
        {
          name: 'sidebar',
          items: Array.from(recentTabsList.querySelectorAll('.sidebar-recent-link')),
          container: sidebar
        }
      ];
    };
    
    const updateSelection = (sectionIndex, itemIndex, sections) => {
      
      // Remove all selection styles
      sections.forEach(section => {
        section.items.forEach(item => item.classList.remove('keyboard-selected'));
        section.container.classList.remove('section-active');
      });
      
      if (sectionIndex >= 0 && sectionIndex < sections.length) {
        const section = sections[sectionIndex];
        
        if (itemIndex >= 0 && itemIndex < section.items.length) {
          currentSection = sectionIndex;
          selectedIndex = itemIndex;
          
          const selectedItem = section.items[selectedIndex];
          selectedItem.classList.add('keyboard-selected');
          selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          
          // Highlight current active area
          section.container.classList.add('section-active');
        } else if (section.items.length > 0) {
          // If index is out of bounds but area has items, select first or last
          const newIndex = itemIndex < 0 ? 0 : section.items.length - 1;
          updateSelection(sectionIndex, newIndex, sections);
        }
      } else {
        currentSection = 0;
        selectedIndex = -1;
      }
    };
    
    const switchToSection = (direction, sections) => {
      let newSection = currentSection;
      
      if (direction > 0) {
        // Tab: Next area
        do {
          newSection = (newSection + 1) % sections.length;
        } while (sections[newSection].items.length === 0 && newSection !== currentSection);
      } else {
        // Shift+Tab: Previous area
        do {
          newSection = newSection === 0 ? sections.length - 1 : newSection - 1;
        } while (sections[newSection].items.length === 0 && newSection !== currentSection);
      }
      
      if (sections[newSection].items.length > 0) {
        updateSelection(newSection, 0, sections);
      }
    };

    // Handle specific keyboard events for the input
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      const sections = getSections();
      
      if (event.key === 'Tab') {
        event.preventDefault();
        const direction = event.shiftKey ? -1 : 1;
        switchToSection(direction, sections);
        return;
      }
      
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (selectedIndex === -1) {
          // No item selected, select first item in first area with content
          for (let i = 0; i < sections.length; i++) {
            if (sections[i].items.length > 0) {
              updateSelection(i, 0, sections);
              break;
            }
          }
        } else {
          // Navigate down within current area
          const currentSectionItems = sections[currentSection].items;
          const newIndex = selectedIndex < currentSectionItems.length - 1 ? selectedIndex + 1 : 0;
          updateSelection(currentSection, newIndex, sections);
        }
        return;
      }
      
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (selectedIndex === -1) {
          // No item selected, select last item in first area with content
          for (let i = 0; i < sections.length; i++) {
            if (sections[i].items.length > 0) {
              updateSelection(i, sections[i].items.length - 1, sections);
              break;
            }
          }
        } else {
          // Navigate up within current area
          const currentSectionItems = sections[currentSection].items;
          const newIndex = selectedIndex > 0 ? selectedIndex - 1 : currentSectionItems.length - 1;
          updateSelection(currentSection, newIndex, sections);
        }
        return;
      }
      
      if (event.key === 'Enter' && selectedIndex >= 0) {
        event.preventDefault();
        const currentSectionItems = sections[currentSection].items;
        if (currentSectionItems[selectedIndex]) {
          currentSectionItems[selectedIndex].click();
          return;
        }
      }
      
      if (event.key === 'Escape') {
        // Properly blur the input before removal
        event.target.blur();
        
        if (searchBox._cleanup) searchBox._cleanup();
        searchBox.remove();
        
        // Restore focus to document body to prevent cursor blinking
        document.body.focus();
        
        // Re-enable page scrolling
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        return;
      }
      
      // Handle Enter key
      if (event.key === 'Enter') {
        event.preventDefault();
        
        const inputValue = event.target.value.trim();
        if (inputValue) {
          // Check if input looks like a URL
          if (isValidUrl(inputValue)) {
            const normalizedUrl = normalizeUrl(inputValue);
            console.log('🌐 Opening URL from input:', normalizedUrl);
            
            // Open URL in new tab
            chrome.runtime.sendMessage({
              action: 'openQuickAccessTab',
              url: normalizedUrl,
              clickId: Date.now() + Math.random()
            });
            
            // Close the interface
            if (searchBox._cleanup) searchBox._cleanup();
            searchBox.remove();
            
            // Restore focus to document body
            document.body.focus();
            
            // Re-enable page scrolling
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            return;
          } else {
            // Not a URL, treat as search query
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(inputValue)}`;
            console.log('🔍 Searching for:', inputValue);
            
            // Open search in new tab
            chrome.runtime.sendMessage({
              action: 'openQuickAccessTab',
              url: searchUrl,
              clickId: Date.now() + Math.random()
            });
            
            // Close the interface
            if (searchBox._cleanup) searchBox._cleanup();
            searchBox.remove();
            
            // Restore focus to document body
            document.body.focus();
            
            // Re-enable page scrolling
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            return;
          }
        }
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
        // Properly blur any focused elements before removal
        const activeElement = document.activeElement;
        if (activeElement && searchBox.contains(activeElement)) {
          activeElement.blur();
        }
        
        if (searchBox._cleanup) searchBox._cleanup();
        searchBox.remove();
        
        // Restore focus to document body to prevent cursor blinking
        document.body.focus();
        
        // Re-enable page scrolling
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
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

          // Create actions container for bookmark and delete buttons
          const actionsContainer = document.createElement('div');
          actionsContainer.style.cssText = `
            display: flex;
            gap: 4px;
            margin-left: 8px;
            margin-right: 4px;
          `;

          // Create bookmark button
          const bookmarkButton = document.createElement('button');
          bookmarkButton.textContent = '⭐';
          bookmarkButton.title = 'Bookmark this page';
          bookmarkButton.style.cssText = `
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
          `;

          bookmarkButton.addEventListener('mouseover', () => {
            bookmarkButton.style.backgroundColor = '#fbbf24';
            bookmarkButton.style.color = 'white';
            bookmarkButton.style.transform = 'scale(1.1)';
          });

          bookmarkButton.addEventListener('mouseout', () => {
            bookmarkButton.style.backgroundColor = 'rgba(248, 250, 252, 0.8)';
            bookmarkButton.style.color = '#6b7280';
            bookmarkButton.style.transform = 'scale(1)';
          });

          bookmarkButton.addEventListener('click', (event) => {
            event.stopPropagation();
            showBookmarkDialogForTab(tab);
          });

          const deleteButton = document.createElement('button');
          deleteButton.className = 'tab-delete';
          deleteButton.textContent = CONFIG.DEFAULT_ICONS.DELETE;
          deleteButton.title = 'Close tab';
          deleteButton.style.cssText = `
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
          `;

          deleteButton.addEventListener('mouseover', () => {
            deleteButton.style.backgroundColor = '#ef4444';
            deleteButton.style.color = 'white';
          });

          deleteButton.addEventListener('mouseout', () => {
            deleteButton.style.backgroundColor = 'rgba(248, 250, 252, 0.8)';
            deleteButton.style.color = '#6b7280';
          });

          deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            chrome.runtime.sendMessage({ action: ACTIONS.REMOVE_TAB, tabId: tab.id }, () => {
              if (searchBox._cleanup) searchBox._cleanup();
              searchBox.remove();
              chrome.runtime.sendMessage({ action: ACTIONS.REFRESH_GROUPED_TABS });
            });
          });

          actionsContainer.appendChild(bookmarkButton);
          actionsContainer.appendChild(deleteButton);

          const link = document.createElement('a');
          link.className = 'tab-link';
          link.href = tab.url;
          link.textContent = tab.title || 'Untitled Tab';

          const icon = document.createElement('img');
          icon.className = 'favicon';
          icon.src = tab.favIconUrl || getFaviconUrl(tab.url);
          icon.onerror = () => {
            icon.style.display = 'none';
            const fallback = document.createElement('span');
            fallback.textContent = CONFIG.DEFAULT_ICONS.SEARCH;
            fallback.style.marginRight = '8px';
            link.prepend(fallback);
          };
          link.prepend(icon);

          link.addEventListener('click', async (event) => {
            event.preventDefault();
            
            // Add to recent tabs before activating
            await addToRecentTabs(tab);
            
            chrome.runtime.sendMessage({ action: ACTIONS.ACTIVATE_TAB, tabId: tab.id });
            if (searchBox._cleanup) searchBox._cleanup();
            searchBox.remove();
          });

          tabItem.appendChild(actionsContainer);
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

    async function displaySidebarRecentTabs(parentElement, filteredTabs = null, searchQuery = null) {
      parentElement.innerHTML = '';
      
      // Use filtered tabs if provided, otherwise get all recent tabs
      const recentTabs = filteredTabs || await getRecentTabs();
      
      if (recentTabs.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'sidebar-empty';
        
        if (searchQuery) {
          // Show search-specific empty state
          emptyState.innerHTML = `
            <div class="sidebar-empty-icon">🔍</div>
            <div>No matches found<br>Try a different search term</div>
          `;
        } else {
          // Show default empty state
          emptyState.innerHTML = `
            <div class="sidebar-empty-icon">⚡</div>
            <div>No recent pages yet<br>Browse some sites to see them here</div>
          `;
        }
        
        parentElement.appendChild(emptyState);
        return;
      }

      recentTabs.slice(0, 100).forEach((tab, index) => {
        
        const listItem = document.createElement('li');
        listItem.className = 'sidebar-recent-item';
        
        const link = document.createElement('a');
        link.href = tab.url;
        link.className = 'sidebar-recent-link';
        link.title = tab.url; // Show full URL on hover
        
        // Create favicon with fallback handling
        const faviconContainer = document.createElement('span');
        faviconContainer.className = 'sidebar-favicon';
        faviconContainer.style.display = 'inline-flex';
        faviconContainer.style.alignItems = 'center';
        faviconContainer.style.justifyContent = 'center';
        faviconContainer.style.width = '14px';
        faviconContainer.style.height = '14px';
        faviconContainer.style.marginRight = '8px';
        
        // Try to use favicon, but fallback to emoji
        const favicon = document.createElement('img');
        favicon.src = tab.favicon || getFaviconUrl(tab.url);
        favicon.alt = '';
        favicon.style.width = '14px';
        favicon.style.height = '14px';
        favicon.style.borderRadius = '3px';
        
        // Fallback to emoji if image fails
        favicon.onerror = () => {
          faviconContainer.innerHTML = '🌐';
          faviconContainer.style.fontSize = '12px';
        };
        
        faviconContainer.appendChild(favicon);
        
        const titleText = document.createElement('span');
        titleText.className = 'sidebar-title-text';
        
        // Apply search highlighting if there's a search query
        const displayTitle = tab.title || tab.url;
        if (searchQuery) {
          titleText.innerHTML = highlightText(displayTitle, searchQuery);
        } else {
          titleText.textContent = displayTitle;
        }
        
        const timeText = document.createElement('span');
        timeText.className = 'sidebar-time';
        const timeAgo = Math.floor((Date.now() - tab.timestamp) / 1000 / 60);
        timeText.textContent = timeAgo < 1 ? 'now' : timeAgo < 60 ? `${timeAgo}m` : `${Math.floor(timeAgo/60)}h`;
        
        link.appendChild(faviconContainer);
        link.appendChild(titleText);
        link.appendChild(timeText);
        
        link.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const clickId = Date.now() + Math.random();
          console.log('🔗 Clicking on Quick Access item:', tab.url, 'ID:', clickId);
          
          // Send message to background script to handle tab operations
          try {
            chrome.runtime.sendMessage({
              action: 'openQuickAccessTab',
              url: tab.url,
              clickId: clickId
            });
            
            // Properly close the interface with focus cleanup
            const activeElement = document.activeElement;
            if (activeElement && searchBox.contains(activeElement)) {
              activeElement.blur();
            }
            
            if (searchBox._cleanup) searchBox._cleanup();
            searchBox.remove();
            
            // Restore focus to document body
            document.body.focus();
            
            // Re-enable page scrolling
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            
          } catch (error) {
            console.error('Error sending message to background script:', error);
          }
        });
        
        listItem.appendChild(link);
        parentElement.appendChild(listItem);
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
          
          let isExpanded = level <= 0; // Expand root and first level by default
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
          // Create container for bookmark item with delete button
          const bookmarkContainer = document.createElement('div');
          bookmarkContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
          `;

          // Create delete button
          const deleteButton = document.createElement('button');
          deleteButton.textContent = CONFIG.DEFAULT_ICONS.DELETE;
          deleteButton.title = 'Delete bookmark';
          deleteButton.style.cssText = `
            all: unset;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: rgba(248, 250, 252, 0.8);
            color: #6b7280;
            font-size: 10px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(226, 232, 240, 0.6);
            margin-right: 4px;
          `;

          deleteButton.addEventListener('mouseover', () => {
            deleteButton.style.backgroundColor = '#ef4444';
            deleteButton.style.color = 'white';
          });

          deleteButton.addEventListener('mouseout', () => {
            deleteButton.style.backgroundColor = 'rgba(248, 250, 252, 0.8)';
            deleteButton.style.color = '#6b7280';
          });

          deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            
            try {
              // Send message to background script to delete bookmark
              const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                  action: 'deleteBookmark',
                  bookmarkId: node.id
                }, resolve);
              });
              
              if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
                showMessage('Failed to delete bookmark', 'error');
                return;
              }
              
              if (response && response.success) {
                showMessage('Bookmark deleted successfully!', 'success');
                
                // Close current interface and refresh like tab deletion
                if (searchBox._cleanup) searchBox._cleanup();
                searchBox.remove();
                chrome.runtime.sendMessage({ action: ACTIONS.REFRESH_GROUPED_TABS });
              } else {
                console.error('Error deleting bookmark:', response?.error || 'Unknown error');
                showMessage('Failed to delete bookmark', 'error');
              }
            } catch (error) {
              console.error('Error in delete bookmark operation:', error);
              showMessage('Failed to delete bookmark', 'error');
            }
          });

          const link = document.createElement('a');
          link.className = 'bookmark-link';
          link.href = node.url;
          link.textContent = node.title || 'Untitled Bookmark';
          link.style.flex = '1';

          const icon = document.createElement('img');
          icon.className = 'favicon';
          icon.src = node.favIconUrl || getFaviconUrl(node.url);
          icon.onerror = () => {
            icon.style.display = 'none';
            const fallback = document.createElement('span');
            fallback.textContent = CONFIG.DEFAULT_ICONS.SEARCH;
            fallback.style.marginRight = '8px';
            link.prepend(fallback);
          };
          link.prepend(icon);

          bookmarkContainer.appendChild(deleteButton);
          bookmarkContainer.appendChild(link);

          link.addEventListener('click', (event) => {
            event.preventDefault();
            window.open(link.href, '_blank');
            if (searchBox._cleanup) searchBox._cleanup();
            searchBox.remove();
          });

          listItem.appendChild(bookmarkContainer);
        }
        parentElement.appendChild(listItem);
      });
    }
  }

  // Main execution
  const existingBox = document.getElementById(CONFIG.UI.SEARCH_BOX_ID);
  if (existingBox) {
    // Properly blur any focused elements before removal
    const activeElement = document.activeElement;
    if (activeElement && existingBox.contains(activeElement)) {
      activeElement.blur();
    }
    
    // Remove the interface
    existingBox.remove();
    
    // Restore focus to document body to prevent cursor blinking
    document.body.focus();
    
    // Re-enable page scrolling
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  } else {
    createSearchBox(bookmarkTreeNodes, alltabs);
  }
  
  } catch (error) {
    console.error('🚨 Error in tabGrouper function:', error);
    console.error('🚨 Stack trace:', error.stack);
  }
}
