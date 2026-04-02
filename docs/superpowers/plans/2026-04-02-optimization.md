# TabGrouper Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all performance, duplication, and correctness issues in `background.js` and `js/modules/popupManager.js` without changing the overall architecture.

**Architecture:** All changes are in-place edits to two existing files. No new files, no build step changes. Each task is independent and can be verified by reloading the extension in Chrome and checking DevTools console output.

**Tech Stack:** Chrome Extension MV3, vanilla JS, no test framework — verification is manual via Chrome DevTools.

---

## Files modified

| File | Tasks |
|------|-------|
| `background.js` | 1–7 |
| `js/modules/popupManager.js` | 8–9 |

---

### Task 1: Remove duplicate `getFaviconUrl` inside `tabGrouper()`

**Files:**
- Modify: `background.js:635-642`

The first definition (line 635) returns `''` on error. The second definition (line 1259) returns a proper SVG fallback. Delete the first.

- [ ] **Step 1: Delete the first `getFaviconUrl` definition**

In `background.js`, remove lines 635–642:
```js
  function getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
    } catch (e) {
      return '';
    }
  }
```

The file should now have only one `getFaviconUrl` definition (the one at what was line 1259, now moves up 8 lines).

- [ ] **Step 2: Verify**

Reload the extension. Press `Cmd+H` on any webpage. Confirm the search overlay opens and favicons display correctly. No console errors about `getFaviconUrl`.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "fix: remove duplicate getFaviconUrl in tabGrouper (kept the one with SVG fallback)"
```

---

### Task 2: Remove manual Promise wrappers around Chrome APIs

**Files:**
- Modify: `background.js:441-459`

Chrome's `tabs.query`, `bookmarks.getTree` natively return Promises. The current wrapper adds indirection with no benefit.

- [ ] **Step 1: Replace `getAllTabs`, `getActiveTab`, `getBookmarkTree`**

Replace lines 441–459 with:
```js
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
```

- [ ] **Step 2: Verify**

Reload extension. Press `Cmd+H` — overlay opens with correct tabs. Press `Cmd+Shift+C` — URL copies. No console errors.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "refactor: replace manual Promise wrappers with native Chrome API Promises"
```

---

### Task 3: Remove dead retry boilerplate from `getAutoCollapseSettings`

**Files:**
- Modify: `background.js:69-93`

`chrome.storage.local` does not throw "No SW" errors. The retry block on lines 79–88 is dead code copied from a different context.

- [ ] **Step 1: Simplify `getAutoCollapseSettings`**

Replace lines 69–93 with:
```js
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
```

- [ ] **Step 2: Verify**

Reload extension. Open popup, toggle auto-collapse on/off. Settings save and persist on extension reload. No console errors.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "refactor: remove dead No-SW retry boilerplate from getAutoCollapseSettings"
```

---

### Task 4: Add in-memory cache for `tabActivity` + remove retry + batch cleanup

**Files:**
- Modify: `background.js:105-165` (getTabActivity, updateTabActivity, removeTabActivity)
- Modify: `background.js:299-315` (cleanup loop in checkInactiveTabGroups)

Every `onCreated`/`onUpdated`/`onActivated` event triggers a full storage read. A module-level cache eliminates the redundant reads. The cleanup loop also fires N individual read-modify-write cycles; batch it to one write.

- [ ] **Step 1: Add cache variable above `getTabActivity`**

Immediately above the `getTabActivity` function (before line 105), add:
```js
let tabActivityCache = null;
```

- [ ] **Step 2: Replace `getTabActivity`, `updateTabActivity`, `removeTabActivity`**

Replace lines 105–165 with:
```js
async function getTabActivity() {
  if (tabActivityCache !== null) return tabActivityCache;
  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.TAB_ACTIVITY);
    tabActivityCache = result[CONFIG.STORAGE_KEYS.TAB_ACTIVITY] || {};
    return tabActivityCache;
  } catch (error) {
    console.error('Error getting tab activity:', error);
    tabActivityCache = {};
    return tabActivityCache;
  }
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
```

- [ ] **Step 3: Batch the cleanup loop in `checkInactiveTabGroups`**

Find the cleanup section near the bottom of `checkInactiveTabGroups` (the block starting with `if (Math.random() < 0.1)`). Replace it with:

```js
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
```

- [ ] **Step 4: Verify**

Reload extension. Open multiple tabs, switch between them. Check DevTools → Application → Storage → Local Storage: `tabActivity` key updates correctly. With auto-collapse enabled, wait for the alarm to fire — check that inactive groups collapse.

- [ ] **Step 5: Commit**

```bash
git add background.js
git commit -m "perf: add in-memory cache for tabActivity, batch cleanup writes"
```

---

### Task 5: Convert IIFE handlers to `async function`

**Files:**
- Modify: `background.js:3276-3337` (handleDeleteBookmark, handleCreateBookmark, handleCreateFolder)

The IIFE-wrapping-async pattern is inconsistent and confusing. The `onMessage` listener already handles Promises via `isPromiseLike`, so plain `async function` works correctly.

- [ ] **Step 1: Replace `handleDeleteBookmark`**

Replace the current `handleDeleteBookmark` function with:
```js
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
```

- [ ] **Step 2: Replace `handleCreateBookmark`**

Replace the current `handleCreateBookmark` function with:
```js
async function handleCreateBookmark(request, sender, sendResponse) {
  try {
    const existingBookmarks = await chrome.bookmarks.search({ url: request.url });
    if (existingBookmarks.length > 0) {
      sendResponse({ success: false, error: 'This page is already bookmarked' });
      return;
    }
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
```

- [ ] **Step 3: Replace `handleCreateFolder`**

Replace the current `handleCreateFolder` function with:
```js
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
```

- [ ] **Step 4: Verify**

Reload extension. Press `Cmd+H`, find a tab, click the bookmark star icon. Confirm the bookmark dialog appears, saving works, and deleting a bookmark works. No console errors.

- [ ] **Step 5: Commit**

```bash
git add background.js
git commit -m "refactor: convert IIFE-wrapped async bookmark handlers to plain async functions"
```

---

### Task 6: Remove `ensureAutoCollapseActive` from `onMessage` listener

**Files:**
- Modify: `background.js:3112-3114`

Calling `ensureAutoCollapseActive()` on every message does a storage read per message (including high-frequency events). It's only needed at startup, install, ping, and after settings change.

- [ ] **Step 1: Remove the call from `onMessage`**

In the `onMessage` listener, delete lines 3113–3114:
```js
  // Ensure auto-collapse is active whenever the service worker handles a message
  ensureAutoCollapseActive();
```

The listener should now start directly with:
```js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const messageHandlers = {
```

- [ ] **Step 2: Verify `ensureAutoCollapseActive` is still called in the right places**

Confirm it remains called in:
- `handlePing` (line ~3431)
- `handleUpdateAutoCollapseSettings` — add a call there if missing, after `saveAutoCollapseSettings`:

In `handleUpdateAutoCollapseSettings`, after `await saveAutoCollapseSettings(validatedSettings);`, confirm there is already a call to `startAutoCollapseChecker()` or `stopAutoCollapseChecker()` — there is, so no additional call needed.

- [ ] **Step 3: Verify**

Reload extension. Open popup multiple times, switch tabs rapidly. In DevTools → Service Worker console: no flood of "Auto-collapse alarm" log messages on every message. Auto-collapse still works after enabling it.

- [ ] **Step 4: Commit**

```bash
git add background.js
git commit -m "perf: remove ensureAutoCollapseActive from every onMessage (called at startup/ping only)"
```

---

### Task 7: Fix `searchTabsAndBookmarks` — eliminate redundant data fetch

**Files:**
- Modify: `background.js:499-552`

The function currently: (1) queries all tabs, (2) calls `groupTabsByHost(tabs)` which internally calls `getSupportedHosts()` and re-iterates all tabs. Fix: fetch `supportedHosts` once upfront, use `mapUrlToHost` directly. Also parallelize the bookmark search with the other fetches.

- [ ] **Step 1: Replace `searchTabsAndBookmarks`**

Replace lines 499–552 with:
```js
async function searchTabsAndBookmarks(query) {
  const [tabs, supportedHosts, bookmarks] = await Promise.all([
    chrome.tabs.query({}),
    getSupportedHosts(),
    chrome.bookmarks.search(query)
  ]);

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

  const bookmarksWithPath = await Promise.all(
    bookmarks.map(async bookmark => {
      const path = await getBookmarkPath(bookmark.id);
      return {
        type: 'bookmark',
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        path
      };
    })
  );

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
```

- [ ] **Step 2: Verify**

Reload extension. Press `Cmd+H`, type a search query. Confirm tabs and bookmarks both appear in results. Try typing a custom host name (e.g., "GitHub") — matching tabs appear. No console errors.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "perf: eliminate redundant getSupportedHosts call in searchTabsAndBookmarks, parallelize bookmark fetch"
```

---

### Task 8: Cache DOM references in `PopupManager`

**Files:**
- Modify: `js/modules/popupManager.js:17-26` (init), and all methods that call `document.getElementById`

Multiple methods repeatedly query the same DOM elements. Cache them once in `init()`.

- [ ] **Step 1: Add `this.els` cache to `init()`**

Replace the `async init()` method body to add element caching after `ensureServiceWorkerActive()`:

```js
  async init() {
    await this.ensureServiceWorkerActive();

    this.els = {
      hostInput: document.getElementById('host-input'),
      nameInput: document.getElementById('name-input'),
      hosts: document.getElementById('hosts'),
      message: document.getElementById('message'),
      autoCollapseEnabled: document.getElementById('auto-collapse-enabled'),
      autoCollapseTimeout: document.getElementById('auto-collapse-timeout'),
      autoCollapseSettings: document.getElementById('auto-collapse-settings'),
    };

    await this.loadSupportedHosts();
    this.setupEventListeners();
    this.displayHosts();
    await this.loadShortcuts();
    await this.loadAutoCollapseSettings();
  }
```

- [ ] **Step 2: Update `setupEventListeners` to use `this.els`**

Replace `setupEventListeners()`:
```js
  setupEventListeners() {
    const setHostButton = document.getElementById('set-host');
    if (setHostButton) {
      setHostButton.addEventListener('click', () => this.handleSetHost());
    }

    [this.els.hostInput, this.els.nameInput].forEach(input => {
      if (input) {
        input.addEventListener('keypress', (event) => {
          if (event.key === 'Enter') this.handleSetHost();
        });
      }
    });

    const manageShortcutsButton = document.getElementById('manage-shortcuts');
    if (manageShortcutsButton) {
      manageShortcutsButton.addEventListener('click', () => this.openShortcutsManager());
    }

    if (this.els.autoCollapseEnabled) {
      this.els.autoCollapseEnabled.addEventListener('change', () => this.handleAutoCollapseToggle());
    }

    if (this.els.autoCollapseTimeout) {
      this.els.autoCollapseTimeout.addEventListener('change', () => this.handleAutoCollapseTimeoutChange());
      this.els.autoCollapseTimeout.addEventListener('input', () => this.validateTimeoutInput());
    }
  }
```

- [ ] **Step 3: Update `handleSetHost` to use `this.els`**

Replace `handleSetHost()`:
```js
  async handleSetHost() {
    const host = this.els.hostInput?.value.trim();
    const name = this.els.nameInput?.value.trim();

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
```

- [ ] **Step 4: Update `displayHosts` to use `this.els`**

Replace `displayHosts()`:
```js
  displayHosts() {
    const hostList = this.els.hosts;
    if (!hostList) return;

    hostList.innerHTML = '';
    const categories = this.categorizeHosts();

    if (Object.keys(categories).length === 0) {
      this.showEmptyState(hostList);
      return;
    }

    Object.entries(categories).forEach(([name, hosts]) => {
      hostList.appendChild(this.createCategoryElement(name, hosts));
    });
  }
```

- [ ] **Step 5: Update `clearInputs` to use `this.els`**

Replace `clearInputs()`:
```js
  clearInputs() {
    if (this.els.hostInput) this.els.hostInput.value = '';
    if (this.els.nameInput) this.els.nameInput.value = '';
  }
```

- [ ] **Step 6: Update `showMessage` to use `this.els`**

Replace `showMessage()`:
```js
  showMessage(text, color = 'green') {
    const message = this.els.message;
    if (!message) return;

    message.textContent = text;
    message.style.color = color;
    message.style.display = 'block';

    setTimeout(() => {
      message.style.display = 'none';
    }, CONFIG.UI.MESSAGE_HIDE_DELAY);
  }
```

- [ ] **Step 7: Update `handleAutoCollapseToggle` to use `this.els`**

Replace `handleAutoCollapseToggle()`:
```js
  async handleAutoCollapseToggle() {
    if (!this.els.autoCollapseEnabled || !this.els.autoCollapseTimeout) return;
    const enabled = this.els.autoCollapseEnabled.checked;
    const timeoutMinutes = parseInt(this.els.autoCollapseTimeout.value) || 5;
    this.updateAutoCollapseUI(enabled);
    await this.saveAutoCollapseSettings(enabled, timeoutMinutes);
  }
```

- [ ] **Step 8: Update `handleAutoCollapseTimeoutChange` to use `this.els`**

Replace `handleAutoCollapseTimeoutChange()`:
```js
  async handleAutoCollapseTimeoutChange() {
    if (!this.els.autoCollapseEnabled || !this.els.autoCollapseTimeout) return;
    const enabled = this.els.autoCollapseEnabled.checked;
    const timeoutMinutes = parseInt(this.els.autoCollapseTimeout.value) || 5;
    await this.saveAutoCollapseSettings(enabled, timeoutMinutes);
  }
```

- [ ] **Step 9: Update `validateTimeoutInput` to use `this.els`**

Replace `validateTimeoutInput()`:
```js
  validateTimeoutInput() {
    const input = this.els.autoCollapseTimeout;
    if (!input) return;
    let value = parseInt(input.value);
    if (isNaN(value) || value < 1) value = 1;
    else if (value > 60) value = 60;
    input.value = value;
  }
```

- [ ] **Step 10: Update `updateAutoCollapseUI` to use `this.els`**

Replace `updateAutoCollapseUI()`:
```js
  updateAutoCollapseUI(enabled) {
    const settings = this.els.autoCollapseSettings;
    if (settings) {
      settings.classList.toggle('disabled', !enabled);
    }
  }
```

- [ ] **Step 11: Update `loadAutoCollapseSettings` to use `this.els`**

Replace `loadAutoCollapseSettings()`:
```js
  async loadAutoCollapseSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.GET_AUTO_COLLAPSE_SETTINGS
      });

      const enabled = response ? response.enabled : false;
      const timeoutMinutes = response ? response.timeoutMinutes : 5;

      if (this.els.autoCollapseEnabled) {
        this.els.autoCollapseEnabled.checked = enabled;
        this.updateAutoCollapseUI(enabled);
      }
      if (this.els.autoCollapseTimeout) {
        this.els.autoCollapseTimeout.value = timeoutMinutes;
      }
    } catch (error) {
      console.error('Error loading auto-collapse settings:', error);
      if (this.els.autoCollapseEnabled) {
        this.els.autoCollapseEnabled.checked = false;
        this.updateAutoCollapseUI(false);
      }
      if (this.els.autoCollapseTimeout) {
        this.els.autoCollapseTimeout.value = 5;
      }
    }
  }
```

- [ ] **Step 12: Verify**

Reload extension. Open popup. Add a host mapping, delete it. Toggle auto-collapse. Change timeout. All UI interactions work correctly.

- [ ] **Step 13: Commit**

```bash
git add js/modules/popupManager.js
git commit -m "perf: cache DOM element references in PopupManager.init()"
```

---

### Task 9: Fix deprecated `navigator.platform`

**Files:**
- Modify: `js/modules/popupManager.js:302`

`navigator.platform` is deprecated. Use `navigator.userAgentData` with a fallback.

- [ ] **Step 1: Update the platform check in `loadShortcuts`**

Find this line in `loadShortcuts` (around line 302):
```js
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
```

Replace with:
```js
      const isMac = navigator.userAgentData?.platform === 'macOS'
        || navigator.platform.toUpperCase().includes('MAC');
```

- [ ] **Step 2: Verify**

Reload extension. Open popup on a Mac — shortcuts display as `Cmd+H` and `Cmd+Shift+C`. On non-Mac, display as `Ctrl+H` etc.

- [ ] **Step 3: Commit**

```bash
git add js/modules/popupManager.js
git commit -m "fix: replace deprecated navigator.platform with navigator.userAgentData"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 9 spec items have a corresponding task (items 1–9 map to tasks 1–9)
- [x] **No placeholders:** All steps contain complete code
- [x] **Type consistency:** `tabActivityCache`, `this.els`, function signatures consistent across all tasks
- [x] **Scope:** No file splitting, no build changes, no changes to `tabGrouper()` internals beyond Task 1
