// Popup management module
import { CONFIG, ACTIONS } from '../constants/config.js';
import { getSupportedHosts, saveSupportedHosts } from '../utils/hostUtils.js';

/**
 * Manages the popup interface for host configuration
 */
export class PopupManager {
  constructor() {
    this.supportedHosts = {};
    this.init();
  }

  /**
   * Initialize popup functionality
   */
  async init() {
    await this.loadSupportedHosts();
    this.setupEventListeners();
    this.displayHosts();
    await this.loadShortcuts();
    await this.loadAutoCollapseSettings();
  }

  /**
   * Load supported hosts from storage
   */
  async loadSupportedHosts() {
    this.supportedHosts = await getSupportedHosts();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const setHostButton = document.getElementById('set-host');
    if (setHostButton) {
      setHostButton.addEventListener('click', () => this.handleSetHost());
    }

    // Add Enter key support for inputs
    const hostInput = document.getElementById('host-input');
    const nameInput = document.getElementById('name-input');
    
    [hostInput, nameInput].forEach(input => {
      if (input) {
        input.addEventListener('keypress', (event) => {
          if (event.key === 'Enter') {
            this.handleSetHost();
          }
        });
      }
    });

    // Setup shortcuts management
    const manageShortcutsButton = document.getElementById('manage-shortcuts');
    if (manageShortcutsButton) {
      manageShortcutsButton.addEventListener('click', () => this.openShortcutsManager());
    }

    // Setup auto-collapse functionality
    const autoCollapseEnabled = document.getElementById('auto-collapse-enabled');
    const autoCollapseTimeout = document.getElementById('auto-collapse-timeout');
    
    if (autoCollapseEnabled) {
      autoCollapseEnabled.addEventListener('change', () => this.handleAutoCollapseToggle());
    }
    
    if (autoCollapseTimeout) {
      autoCollapseTimeout.addEventListener('change', () => this.handleAutoCollapseTimeoutChange());
      autoCollapseTimeout.addEventListener('input', () => this.validateTimeoutInput());
    }
  }

  /**
   * Handle setting a new host
   */
  async handleSetHost() {
    const hostInput = document.getElementById('host-input');
    const nameInput = document.getElementById('name-input');
    
    if (!hostInput || !nameInput) return;

    const host = hostInput.value.trim();
    const name = nameInput.value.trim();

    if (host && name) {
      this.supportedHosts[host] = name;
      await saveSupportedHosts(this.supportedHosts);
      this.displayHosts();
      this.showSuccessMessage();
      this.clearInputs();
    } else {
      this.showErrorMessage('Please enter both host and name');
    }
  }

  /**
   * Display supported hosts in categorized format
   */
  displayHosts() {
    const hostList = document.getElementById('hosts');
    if (!hostList) return;

    hostList.innerHTML = '';

    const categories = this.categorizeHosts();
    
    if (Object.keys(categories).length === 0) {
      this.showEmptyState(hostList);
      return;
    }

    Object.entries(categories).forEach(([name, hosts]) => {
      const categoryDiv = this.createCategoryElement(name, hosts);
      hostList.appendChild(categoryDiv);
    });
  }

  /**
   * Categorize hosts by their mapped names
   */
  categorizeHosts() {
    const categories = {};
    
    Object.entries(this.supportedHosts).forEach(([host, name]) => {
      if (!categories[name]) {
        categories[name] = [];
      }
      categories[name].push(host);
    });

    return categories;
  }

  /**
   * Create category element with hosts
   */
  createCategoryElement(name, hosts) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = CONFIG.CSS_CLASSES.CATEGORY;

    const categoryTitle = document.createElement('h3');
    categoryTitle.textContent = name;
    categoryDiv.appendChild(categoryTitle);

    const categoryList = document.createElement('ul');
    
    hosts.forEach(host => {
      const listItem = this.createHostListItem(host, name);
      categoryList.appendChild(listItem);
    });

    categoryDiv.appendChild(categoryList);
    return categoryDiv;
  }

  /**
   * Create individual host list item
   */
  createHostListItem(host, name) {
    const listItem = document.createElement('li');

    const deleteButton = this.createDeleteButton(host);
    const textSpan = this.createTextSpan(host, name);

    listItem.appendChild(deleteButton);
    listItem.appendChild(textSpan);
    
    return listItem;
  }

  /**
   * Create delete button for host
   */
  createDeleteButton(host) {
    const deleteButton = document.createElement('button');
    deleteButton.className = CONFIG.CSS_CLASSES.DELETE_BUTTON;
    deleteButton.textContent = CONFIG.DEFAULT_ICONS.DELETE;

    deleteButton.addEventListener('click', async () => {
      await this.deleteHost(host);
    });

    return deleteButton;
  }

  /**
   * Create text span with host and name display
   */
  createTextSpan(host, name) {
    const textSpan = document.createElement('span');
    textSpan.className = CONFIG.CSS_CLASSES.TEXT_SPAN;

    const hostSpan = document.createElement('span');
    hostSpan.className = CONFIG.CSS_CLASSES.HOST_SPAN;
    hostSpan.textContent = host;

    const separator = document.createElement('span');
    separator.className = CONFIG.CSS_CLASSES.SEPARATOR;
    separator.textContent = '<=>';

    const nameSpan = document.createElement('span');
    nameSpan.className = CONFIG.CSS_CLASSES.NAME_SPAN;
    nameSpan.textContent = name;

    textSpan.appendChild(hostSpan);
    textSpan.appendChild(separator);
    textSpan.appendChild(nameSpan);

    return textSpan;
  }

  /**
   * Delete a host mapping
   */
  async deleteHost(host) {
    delete this.supportedHosts[host];
    await saveSupportedHosts(this.supportedHosts);
    this.displayHosts();
  }

  /**
   * Show empty state when no hosts are configured
   */
  showEmptyState(container) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'No custom hosts configured yet. Add some above!';
    emptyMessage.style.color = '#666';
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.padding = '20px';
    container.appendChild(emptyMessage);
  }

  /**
   * Clear input fields
   */
  clearInputs() {
    const hostInput = document.getElementById('host-input');
    const nameInput = document.getElementById('name-input');
    
    if (hostInput) hostInput.value = '';
    if (nameInput) nameInput.value = '';
  }

  /**
   * Show success message
   */
  showSuccessMessage() {
    this.showMessage('Host and name set successfully!', 'green');
  }

  /**
   * Show error message
   */
  showErrorMessage(text) {
    this.showMessage(text, 'red');
  }

  /**
   * Show message with auto-hide
   */
  showMessage(text, color = 'green') {
    const message = document.getElementById('message');
    if (!message) return;

    message.textContent = text;
    message.style.color = color;
    message.style.display = 'block';

    setTimeout(() => {
      message.style.display = 'none';
    }, CONFIG.UI.MESSAGE_HIDE_DELAY);
  }

  /**
   * Load and display current shortcuts
   */
  async loadShortcuts() {
    try {
      const commands = await chrome.commands.getAll();
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      
      commands.forEach(command => {
        let shortcutElement = null;
        
        if (command.name === 'open-search-box') {
          shortcutElement = document.getElementById('search-shortcut');
        } else if (command.name === 'copy-current-url') {
          shortcutElement = document.getElementById('copy-shortcut');
        }
        
        if (shortcutElement) {
          if (command.shortcut) {
            // Convert shortcuts for display (Windows/Linux use Ctrl, Mac uses Cmd)
            let shortcut = command.shortcut;
            if (isMac) {
              shortcut = shortcut.replace(/Ctrl/g, 'Cmd');
            }
            shortcutElement.textContent = shortcut;
          } else {
            shortcutElement.textContent = 'Not set';
            shortcutElement.style.opacity = '0.5';
          }
        }
      });
    } catch (error) {
      console.error('Error loading shortcuts:', error);
    }
  }

  /**
   * Open Chrome's shortcuts management page
   */
  openShortcutsManager() {
    chrome.tabs.create({
      url: 'chrome://extensions/shortcuts'
    });
  }

  /**
   * Load auto-collapse settings and update UI
   */
  async loadAutoCollapseSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.GET_AUTO_COLLAPSE_SETTINGS
      });
      
      const autoCollapseEnabled = document.getElementById('auto-collapse-enabled');
      const autoCollapseTimeout = document.getElementById('auto-collapse-timeout');
      const autoCollapseSettings = document.getElementById('auto-collapse-settings');
      
      // 使用response或默认值
      const enabled = response ? response.enabled : false;
      const timeoutMinutes = response ? response.timeoutMinutes : 5;
      
      if (autoCollapseEnabled) {
        autoCollapseEnabled.checked = enabled;
        this.updateAutoCollapseUI(enabled);
      }
      
      if (autoCollapseTimeout) {
        autoCollapseTimeout.value = timeoutMinutes;
      }
      
    } catch (error) {
      console.error('Error loading auto-collapse settings:', error);
      
      // 出错时设置默认值
      const autoCollapseEnabled = document.getElementById('auto-collapse-enabled');
      const autoCollapseTimeout = document.getElementById('auto-collapse-timeout');
      
      if (autoCollapseEnabled) {
        autoCollapseEnabled.checked = false;
        this.updateAutoCollapseUI(false);
      }
      
      if (autoCollapseTimeout) {
        autoCollapseTimeout.value = 5;
      }
    }
  }

  /**
   * Handle auto-collapse toggle
   */
  async handleAutoCollapseToggle() {
    const autoCollapseEnabled = document.getElementById('auto-collapse-enabled');
    const autoCollapseTimeout = document.getElementById('auto-collapse-timeout');
    
    if (!autoCollapseEnabled || !autoCollapseTimeout) return;
    
    const enabled = autoCollapseEnabled.checked;
    const timeoutMinutes = parseInt(autoCollapseTimeout.value) || 5;
    
    this.updateAutoCollapseUI(enabled);
    await this.saveAutoCollapseSettings(enabled, timeoutMinutes);
  }

  /**
   * Handle auto-collapse timeout change
   */
  async handleAutoCollapseTimeoutChange() {
    const autoCollapseEnabled = document.getElementById('auto-collapse-enabled');
    const autoCollapseTimeout = document.getElementById('auto-collapse-timeout');
    
    if (!autoCollapseEnabled || !autoCollapseTimeout) return;
    
    const enabled = autoCollapseEnabled.checked;
    const timeoutMinutes = parseInt(autoCollapseTimeout.value) || 5;
    
    await this.saveAutoCollapseSettings(enabled, timeoutMinutes);
  }

  /**
   * Validate timeout input
   */
  validateTimeoutInput() {
    const autoCollapseTimeout = document.getElementById('auto-collapse-timeout');
    if (!autoCollapseTimeout) return;
    
    let value = parseInt(autoCollapseTimeout.value);
    if (isNaN(value) || value < 1) {
      value = 1;
    } else if (value > 60) {
      value = 60;
    }
    
    autoCollapseTimeout.value = value;
  }

  /**
   * Update auto-collapse UI based on enabled state
   */
  updateAutoCollapseUI(enabled) {
    const autoCollapseSettings = document.getElementById('auto-collapse-settings');
    if (autoCollapseSettings) {
      if (enabled) {
        autoCollapseSettings.classList.remove('disabled');
      } else {
        autoCollapseSettings.classList.add('disabled');
      }
    }
  }

  /**
   * Save auto-collapse settings
   */
  async saveAutoCollapseSettings(enabled, timeoutMinutes) {
    try {
      console.log('📨 Popup: Saving auto-collapse settings...', { enabled, timeoutMinutes });
      
      // Add timeout to prevent hanging
      const messagePromise = chrome.runtime.sendMessage({
        action: ACTIONS.UPDATE_AUTO_COLLAPSE_SETTINGS,
        settings: {
          enabled: enabled,
          timeoutMinutes: timeoutMinutes
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Message timeout')), 5000);
      });
      
      const response = await Promise.race([messagePromise, timeoutPromise]);
      
      console.log('📨 Popup: Received response:', response);
      
      if (response && response.success) {
        console.log('✅ Popup: Settings saved successfully');
        this.showSuccessMessage(`Auto-collapse ${enabled ? 'enabled' : 'disabled'} (${timeoutMinutes} min)`);
      } else {
        console.error('❌ Popup: Failed to save settings:', response);
        this.showErrorMessage('Failed to save auto-collapse settings. Try reloading the extension.');
      }
    } catch (error) {
      console.error('❌ Popup: Error saving auto-collapse settings:', error);
      
      // Fallback: try direct storage access
      try {
        console.log('🔄 Popup: Attempting fallback storage...');
        await chrome.storage.local.set({
          'autoCollapseSettings': {
            enabled: enabled,
            timeoutMinutes: timeoutMinutes
          }
        });
        this.showSuccessMessage(`Settings saved (fallback) - Please reload extension`);
        console.log('✅ Popup: Fallback storage successful');
      } catch (fallbackError) {
        console.error('❌ Popup: Fallback also failed:', fallbackError);
        this.showErrorMessage('Failed to save settings. Please reload the extension and try again.');
      }
    }
  }
}