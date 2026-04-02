// Bookmark management module with enhanced UI
import { CONFIG } from '../constants/config.js';

/**
 * Enhanced bookmark manager with beautiful dialog and folder management
 */
export class BookmarkManager {
  constructor() {
    this.currentTab = null;
    this.selectedFolderId = null;
    this.bookmarkDialog = null;
    this.folderDialog = null;
  }

  /**
   * Show bookmark creation dialog for current tab
   */
  async showBookmarkDialog(tab = null) {
    try {
      this.currentTab = tab || await this.getCurrentTab();
      if (!this.currentTab) {
        console.error('No active tab found');
        return;
      }

      this.createBookmarkDialog();
      this.showDialog(this.bookmarkDialog);
      await this.loadFolderTree();
      
      // Focus on title input and select text
      const titleInput = this.bookmarkDialog.querySelector('#bookmark-title');
      if (titleInput) {
        setTimeout(() => {
          titleInput.focus();
          titleInput.select();
        }, 100);
      }
    } catch (error) {
      console.error('Error showing bookmark dialog:', error);
    }
  }

  /**
   * Create the main bookmark dialog
   */
  createBookmarkDialog() {
    if (this.bookmarkDialog) {
      this.bookmarkDialog.remove();
    }

    this.bookmarkDialog = document.createElement('div');
    this.bookmarkDialog.className = 'bookmark-dialog-overlay';
    this.bookmarkDialog.innerHTML = `
      <div class="bookmark-dialog">
        <div class="bookmark-dialog-header">
          <h3>💾 保存书签</h3>
          <button class="close-btn" id="close-bookmark-dialog">✕</button>
        </div>
        
        <div class="bookmark-form">
          <div class="form-group">
            <label for="bookmark-title">📝 书签名称</label>
            <input type="text" id="bookmark-title" value="${this.currentTab?.title || ''}" placeholder="输入书签名称">
          </div>
          
          <div class="form-group">
            <label for="bookmark-url">🔗 网页地址</label>
            <input type="text" id="bookmark-url" value="${this.currentTab?.url || ''}" readonly>
          </div>
          
          <div class="form-group">
            <label for="bookmark-folder">📁 选择文件夹</label>
            <div class="folder-section">
              <div class="folder-tree" id="folder-tree">
                <div class="loading">加载文件夹...</div>
              </div>
              <button class="new-folder-btn" id="new-folder-btn">
                <span class="icon">+</span>
                <span class="text">新建文件夹</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="bookmark-dialog-footer">
          <button class="cancel-btn" id="cancel-bookmark">取消</button>
          <button class="save-btn" id="save-bookmark">
            <span class="icon">⭐</span>
            <span class="text">保存书签</span>
          </button>
        </div>
      </div>
    `;

    this.attachBookmarkDialogStyles();
    this.setupBookmarkDialogEvents();
    document.body.appendChild(this.bookmarkDialog);
  }

  /**
   * Attach styles for bookmark dialog
   */
  attachBookmarkDialogStyles() {
    if (document.getElementById('bookmark-dialog-styles')) return;

    const style = document.createElement('style');
    style.id = 'bookmark-dialog-styles';
    style.textContent = `
      .bookmark-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .bookmark-dialog-overlay.show {
        opacity: 1;
      }

      .bookmark-dialog {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        border-radius: 20px;
        padding: 0;
        box-shadow: 
          0 20px 40px rgba(0, 0, 0, 0.1),
          0 0 0 1px rgba(255, 255, 255, 0.5);
        width: 520px;
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
        transform: scale(0.9) translateY(20px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
      }

      .bookmark-dialog-overlay.show .bookmark-dialog {
        transform: scale(1) translateY(0);
      }

      .bookmark-dialog-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .bookmark-dialog-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: background-color 0.2s;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .bookmark-form {
        padding: 24px;
      }

      .form-group {
        margin-bottom: 20px;
      }

      .form-group:last-child {
        margin-bottom: 0;
      }

      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #374151;
        font-size: 14px;
      }

      .form-group input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid transparent;
        border-radius: 12px;
        background: rgba(248, 250, 252, 0.8);
        font-size: 14px;
        font-weight: 500;
        color: #1e293b;
        box-sizing: border-box;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .form-group input:focus {
        outline: none;
        border-color: rgba(99, 102, 241, 0.4);
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
      }

      .form-group input[readonly] {
        background: rgba(241, 245, 249, 0.6);
        color: #64748b;
        cursor: default;
      }

      .folder-section {
        border: 2px solid rgba(226, 232, 240, 0.6);
        border-radius: 12px;
        overflow: hidden;
        background: rgba(248, 250, 252, 0.8);
      }

      .folder-tree {
        max-height: 200px;
        overflow-y: auto;
        padding: 12px 0;
      }

      .folder-item {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        cursor: pointer;
        transition: background-color 0.2s;
        font-size: 14px;
        color: #374151;
      }

      .folder-item:hover {
        background: rgba(99, 102, 241, 0.05);
      }

      .folder-item.selected {
        background: rgba(99, 102, 241, 0.1);
        color: #6366f1;
        font-weight: 600;
      }

      .folder-item .folder-icon {
        margin-right: 8px;
        font-size: 16px;
      }

      .folder-item .folder-name {
        flex: 1;
      }

      .folder-item .folder-indent {
        width: 20px;
        flex-shrink: 0;
      }

      .new-folder-btn {
        width: 100%;
        padding: 12px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border-top: 1px solid rgba(226, 232, 240, 0.6);
      }

      .new-folder-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .bookmark-dialog-footer {
        padding: 20px 24px;
        background: rgba(248, 250, 252, 0.6);
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .cancel-btn, .save-btn {
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .cancel-btn {
        background: rgba(255, 255, 255, 0.8);
        color: #6b7280;
        border: 1px solid rgba(209, 213, 219, 0.6);
      }

      .cancel-btn:hover {
        background: rgba(255, 255, 255, 0.95);
        color: #374151;
      }

      .save-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
      }

      .save-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.35);
      }

      .loading {
        padding: 20px;
        text-align: center;
        color: #6b7280;
        font-size: 14px;
      }

      /* Scrollbar styles */
      .folder-tree::-webkit-scrollbar {
        width: 6px;
      }

      .folder-tree::-webkit-scrollbar-track {
        background: transparent;
      }

      .folder-tree::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.4);
        border-radius: 3px;
      }

      .folder-tree::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.6);
      }

      /* Animation for success message */
      .success-message {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        z-index: 10001;
        box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
        animation: successPop 2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      @keyframes successPop {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.8);
        }
        20% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.1);
        }
        40% {
          transform: translate(-50%, -50%) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.9);
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Setup event listeners for bookmark dialog
   */
  setupBookmarkDialogEvents() {
    const closeBtn = this.bookmarkDialog.querySelector('#close-bookmark-dialog');
    const cancelBtn = this.bookmarkDialog.querySelector('#cancel-bookmark');
    const saveBtn = this.bookmarkDialog.querySelector('#save-bookmark');
    const newFolderBtn = this.bookmarkDialog.querySelector('#new-folder-btn');
    const titleInput = this.bookmarkDialog.querySelector('#bookmark-title');

    // Close dialog events
    closeBtn?.addEventListener('click', () => this.hideBookmarkDialog());
    cancelBtn?.addEventListener('click', () => this.hideBookmarkDialog());
    
    // Save bookmark
    saveBtn?.addEventListener('click', () => this.saveBookmark());
    
    // New folder
    newFolderBtn?.addEventListener('click', () => this.showNewFolderDialog());
    
    // Enter key support
    titleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveBookmark();
      }
    });

    // Escape key to close
    this.bookmarkDialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideBookmarkDialog();
      }
    });

    // Click overlay to close
    this.bookmarkDialog.addEventListener('click', (e) => {
      if (e.target === this.bookmarkDialog) {
        this.hideBookmarkDialog();
      }
    });
  }

  /**
   * Load and display folder tree
   */
  async loadFolderTree() {
    try {
      const folderTree = this.bookmarkDialog.querySelector('#folder-tree');
      if (!folderTree) return;

      folderTree.innerHTML = '<div class="loading">加载文件夹...</div>';

      const bookmarkTree = await chrome.bookmarks.getTree();
      const folders = this.extractFolders(bookmarkTree[0]);
      
      folderTree.innerHTML = '';
      this.renderFolderTree(folders, folderTree);
      
      // Select bookmarks bar by default
      const bookmarksBar = folderTree.querySelector('.folder-item[data-id="1"]');
      if (bookmarksBar) {
        this.selectFolder(bookmarksBar);
      }
    } catch (error) {
      console.error('Error loading folder tree:', error);
      const folderTree = this.bookmarkDialog.querySelector('#folder-tree');
      if (folderTree) {
        folderTree.innerHTML = '<div class="loading">加载失败</div>';
      }
    }
  }

  /**
   * Extract folders from bookmark tree
   */
  extractFolders(node, level = 0, path = []) {
    const folders = [];
    
    if (node.children) {
      for (const child of node.children) {
        if (child.children !== undefined) { // It's a folder
          const folder = {
            id: child.id,
            title: child.title || (child.id === '1' ? '书签栏' : child.id === '2' ? '其他书签' : '移动设备书签'),
            level: level,
            path: [...path, child.title || '未命名']
          };
          folders.push(folder);
          
          // Recursively get subfolders
          const subfolders = this.extractFolders(child, level + 1, folder.path);
          folders.push(...subfolders);
        }
      }
    }
    
    return folders;
  }

  /**
   * Render folder tree in UI
   */
  renderFolderTree(folders, container) {
    folders.forEach(folder => {
      const folderItem = document.createElement('div');
      folderItem.className = 'folder-item';
      folderItem.dataset.id = folder.id;
      folderItem.innerHTML = `
        ${'<div class="folder-indent"></div>'.repeat(folder.level)}
        <span class="folder-icon">📁</span>
        <span class="folder-name">${folder.title}</span>
      `;
      
      folderItem.addEventListener('click', () => this.selectFolder(folderItem));
      container.appendChild(folderItem);
    });
  }

  /**
   * Select a folder
   */
  selectFolder(folderElement) {
    // Remove previous selection
    this.bookmarkDialog.querySelectorAll('.folder-item.selected').forEach(item => {
      item.classList.remove('selected');
    });
    
    // Add selection to clicked folder
    folderElement.classList.add('selected');
    this.selectedFolderId = folderElement.dataset.id;
  }

  /**
   * Show new folder creation dialog
   */
  showNewFolderDialog() {
    if (this.folderDialog) {
      this.folderDialog.remove();
    }

    const parentFolderName = this.getSelectedFolderName();
    
    this.folderDialog = document.createElement('div');
    this.folderDialog.className = 'folder-dialog-overlay';
    this.folderDialog.innerHTML = `
      <div class="folder-dialog">
        <div class="folder-dialog-header">
          <h3>📁 新建文件夹</h3>
          <button class="close-btn" id="close-folder-dialog">✕</button>
        </div>
        
        <div class="folder-form">
          <div class="form-group">
            <label for="folder-name">📝 文件夹名称</label>
            <input type="text" id="folder-name" placeholder="输入文件夹名称" autocomplete="off">
          </div>
          
          <div class="form-group">
            <label>📂 创建位置</label>
            <div class="parent-folder-info">
              在 "${parentFolderName}" 下创建
            </div>
          </div>
        </div>
        
        <div class="folder-dialog-footer">
          <button class="cancel-btn" id="cancel-folder">取消</button>
          <button class="create-btn" id="create-folder">
            <span class="icon">+</span>
            <span class="text">创建</span>
          </button>
        </div>
      </div>
    `;

    this.attachFolderDialogStyles();
    this.setupFolderDialogEvents();
    document.body.appendChild(this.folderDialog);
    this.showDialog(this.folderDialog);
    
    // Focus on folder name input
    const folderNameInput = this.folderDialog.querySelector('#folder-name');
    if (folderNameInput) {
      setTimeout(() => {
        folderNameInput.focus();
      }, 100);
    }
  }

  /**
   * Attach styles for folder dialog
   */
  attachFolderDialogStyles() {
    if (document.getElementById('folder-dialog-styles')) return;

    const style = document.createElement('style');
    style.id = 'folder-dialog-styles';
    style.textContent = `
      .folder-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .folder-dialog-overlay.show {
        opacity: 1;
      }

      .folder-dialog {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        border-radius: 20px;
        padding: 0;
        box-shadow: 
          0 25px 50px rgba(0, 0, 0, 0.15),
          0 0 0 1px rgba(255, 255, 255, 0.5);
        width: 420px;
        max-width: 90vw;
        overflow: hidden;
        transform: scale(0.9) translateY(20px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
      }

      .folder-dialog-overlay.show .folder-dialog {
        transform: scale(1) translateY(0);
      }

      .folder-dialog-header {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .folder-dialog-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .folder-form {
        padding: 24px;
      }

      .parent-folder-info {
        background: rgba(99, 102, 241, 0.1);
        color: #6366f1;
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        border: 1px solid rgba(99, 102, 241, 0.2);
      }

      .folder-dialog-footer {
        padding: 20px 24px;
        background: rgba(248, 250, 252, 0.6);
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .create-btn {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
      }

      .create-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Setup event listeners for folder dialog
   */
  setupFolderDialogEvents() {
    const closeBtn = this.folderDialog.querySelector('#close-folder-dialog');
    const cancelBtn = this.folderDialog.querySelector('#cancel-folder');
    const createBtn = this.folderDialog.querySelector('#create-folder');
    const folderNameInput = this.folderDialog.querySelector('#folder-name');

    // Close dialog events
    closeBtn?.addEventListener('click', () => this.hideFolderDialog());
    cancelBtn?.addEventListener('click', () => this.hideFolderDialog());
    
    // Create folder
    createBtn?.addEventListener('click', () => this.createNewFolder());
    
    // Enter key support
    folderNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.createNewFolder();
      }
    });

    // Escape key to close
    this.folderDialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideFolderDialog();
      }
    });

    // Click overlay to close
    this.folderDialog.addEventListener('click', (e) => {
      if (e.target === this.folderDialog) {
        this.hideFolderDialog();
      }
    });
  }

  /**
   * Create new folder
   */
  async createNewFolder() {
    try {
      const folderNameInput = this.folderDialog.querySelector('#folder-name');
      const folderName = folderNameInput?.value.trim();
      
      if (!folderName) {
        folderNameInput?.focus();
        return;
      }

      const parentId = this.selectedFolderId || '1'; // Default to bookmarks bar
      
      const newFolder = await chrome.bookmarks.create({
        parentId: parentId,
        title: folderName
      });

      this.hideFolderDialog();
      await this.loadFolderTree();
      
      // Select the newly created folder
      const newFolderElement = this.bookmarkDialog.querySelector(`.folder-item[data-id="${newFolder.id}"]`);
      if (newFolderElement) {
        this.selectFolder(newFolderElement);
        newFolderElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  }

  /**
   * Save bookmark to selected folder
   */
  async saveBookmark() {
    try {
      const titleInput = this.bookmarkDialog.querySelector('#bookmark-title');
      const title = titleInput?.value.trim() || this.currentTab?.title || '无标题';
      const url = this.currentTab?.url;
      const parentId = this.selectedFolderId || '1'; // Default to bookmarks bar

      if (!url) {
        console.error('No URL to bookmark');
        this.showErrorMessage('无法获取页面地址');
        return;
      }

      // Check if bookmark already exists
      const existingBookmarks = await chrome.bookmarks.search({ url: url });
      if (existingBookmarks.length > 0) {
        this.showErrorMessage('该页面已被收藏');
        return;
      }

      await chrome.bookmarks.create({
        parentId: parentId,
        title: title,
        url: url
      });

      this.hideBookmarkDialog();
      this.showSuccessMessage('书签保存成功！');
      
    } catch (error) {
      console.error('Error saving bookmark:', error);
      if (error.message.includes('duplicate')) {
        this.showErrorMessage('该页面已被收藏');
      } else {
        this.showErrorMessage('保存书签失败');
      }
    }
  }

  /**
   * Get selected folder name
   */
  getSelectedFolderName() {
    const selectedFolder = this.bookmarkDialog?.querySelector('.folder-item.selected .folder-name');
    return selectedFolder?.textContent || '书签栏';
  }

  /**
   * Show dialog with animation
   */
  showDialog(dialog) {
    if (!dialog) return;
    
    dialog.style.display = 'flex';
    requestAnimationFrame(() => {
      dialog.classList.add('show');
    });
  }

  /**
   * Hide bookmark dialog
   */
  hideBookmarkDialog() {
    if (!this.bookmarkDialog) return;
    
    this.bookmarkDialog.classList.remove('show');
    setTimeout(() => {
      this.bookmarkDialog?.remove();
      this.bookmarkDialog = null;
      this.selectedFolderId = null; // Reset selection
    }, 300);
  }

  /**
   * Hide folder dialog
   */
  hideFolderDialog() {
    if (!this.folderDialog) return;
    
    this.folderDialog.classList.remove('show');
    setTimeout(() => {
      this.folderDialog?.remove();
      this.folderDialog = null;
    }, 300);
  }

  /**
   * Show success message with animation
   */
  showSuccessMessage(message) {
    this.showMessage(message, 'success');
  }

  /**
   * Show error message
   */
  showErrorMessage(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Show message with consistent styling
   */
  showMessage(message, type = 'success') {
    const messageElement = document.createElement('div');
    messageElement.style.position = 'fixed';
    messageElement.style.top = '20px';
    messageElement.style.right = '20px';
    messageElement.style.padding = '12px 20px';
    messageElement.style.borderRadius = '12px';
    messageElement.style.color = 'white';
    messageElement.style.fontWeight = '600';
    messageElement.style.fontSize = '14px';
    messageElement.style.zIndex = '10002';
    messageElement.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
    messageElement.style.backdropFilter = 'blur(8px)';
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

  /**
   * Get current active tab
   */
  async getCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0] || null;
    } catch (error) {
      console.error('Error getting current tab:', error);
      return null;
    }
  }
}