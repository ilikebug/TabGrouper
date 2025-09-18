// Popup management module
import { CONFIG } from '../constants/config.js';
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
}