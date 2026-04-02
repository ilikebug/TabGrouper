# TabGrouper Optimization Design

**Date:** 2026-04-02  
**Scope:** Performance, code duplication, logic correctness, UI caching

---

## Goals

Fix all identified issues in `background.js` and `js/modules/popupManager.js` without changing the overall architecture (no build step, no file splitting).

---

## Changes

### 1. In-memory cache for `tabActivity` storage reads

**Problem:** `updateTabActivity` and `removeTabActivity` each do a full read-modify-write on `chrome.storage.local`. These are called on every `onCreated`, `onUpdated`, and `onActivated` tab event — multiple times per second under normal use.

**Fix:** Introduce a module-level `tabActivityCache` variable. Populate it on first read, keep it in sync on every write. The cleanup loop in `checkInactiveTabGroups` batches all removals into a single `chrome.storage.local.set` call.

```js
let tabActivityCache = null;

async function getTabActivity() {
  if (tabActivityCache !== null) return tabActivityCache;
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.TAB_ACTIVITY);
  tabActivityCache = result[CONFIG.STORAGE_KEYS.TAB_ACTIVITY] || {};
  return tabActivityCache;
}

async function updateTabActivity(tabId, timestamp = Date.now()) {
  const tabActivity = await getTabActivity();
  tabActivity[tabId] = timestamp;
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.TAB_ACTIVITY]: tabActivity });
}

async function removeTabActivity(tabId) {
  const tabActivity = await getTabActivity();
  delete tabActivity[tabId];
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.TAB_ACTIVITY]: tabActivity });
}
```

Batch cleanup in `checkInactiveTabGroups`:
```js
// Instead of: for (tabId) { await removeTabActivity(tabId); }
const tabActivity = await getTabActivity();
for (const tabId of staleIds) delete tabActivity[tabId];
await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.TAB_ACTIVITY]: tabActivity });
```

**Impact:** Eliminates repeated storage reads; collapses N writes into 1 during cleanup.

---

### 2. Remove duplicate `getFaviconUrl` inside `tabGrouper()`

**Problem:** `getFaviconUrl` is defined at line ~635 and again at line ~1259 inside `tabGrouper()`. The second definition shadows the first.

**Fix:** Delete the first definition (line ~635), keep only the one at ~1259 (which has a proper SVG fallback).

---

### 3. Unify message handler style

**Problem:** `handleDeleteBookmark`, `handleCreateBookmark`, `handleCreateFolder` use an IIFE-wrapping-async pattern inconsistent with other handlers.

**Fix:** Convert to plain `async function`. The existing `isPromiseLike` check in the `onMessage` listener already handles async handlers correctly.

```js
// Before
function handleDeleteBookmark(request, sender, sendResponse) {
  (async () => { ... })();
  return true;
}

// After
async function handleDeleteBookmark(request, sender, sendResponse) {
  ...
  sendResponse({ success: true });
}
```

---

### 4. Remove manual Promise wrappers around native Chrome APIs

**Problem:** `getAllTabs`, `getActiveTab`, `getBookmarkTree` wrap Chrome's callback APIs in Promises, but Chrome already returns Promises from these APIs.

**Fix:**
```js
function getAllTabs() { return chrome.tabs.query({}); }
function getActiveTab() { return chrome.tabs.query({ currentWindow: true, active: true }).then(tabs => tabs[0] ?? null); }
function getBookmarkTree() { return chrome.bookmarks.getTree(); }
```

---

### 5. Limit `ensureAutoCollapseActive` call frequency

**Problem:** `ensureAutoCollapseActive()` is called at the top of every `onMessage` handler, doing a storage read on every single message (including ping).

**Fix:** Remove the call from `onMessage`. Keep it only in:
- `onInstalled`
- `onStartup`
- `handlePing` (one explicit call)
- `handleUpdateAutoCollapseSettings` (after settings change)

---

### 6. Fix `searchTabsAndBookmarks` redundant data fetch

**Problem:** The function queries all tabs, then calls `groupTabsByHost(tabs)` which internally calls `getSupportedHosts()` from storage and re-iterates all tabs.

**Fix:** Call `getSupportedHosts()` once upfront, use results directly for both grouping and host-name matching:

```js
async function searchTabsAndBookmarks(query) {
  const [tabs, supportedHosts] = await Promise.all([
    chrome.tabs.query({}),
    getSupportedHosts()
  ]);
  const lowerQuery = query.toLowerCase();
  // use supportedHosts directly for matching, no second groupTabsByHost call
  ...
}
```

---

### 7. Cache DOM references in PopupManager

**Problem:** Methods like `handleAutoCollapseToggle`, `handleAutoCollapseTimeoutChange`, `loadAutoCollapseSettings` each call `document.getElementById(...)` for the same elements.

**Fix:** Cache all elements in `init()`:
```js
async init() {
  this.els = {
    hostInput: document.getElementById('host-input'),
    nameInput: document.getElementById('name-input'),
    autoCollapseEnabled: document.getElementById('auto-collapse-enabled'),
    autoCollapseTimeout: document.getElementById('auto-collapse-timeout'),
    autoCollapseSettings: document.getElementById('auto-collapse-settings'),
    message: document.getElementById('message'),
    hosts: document.getElementById('hosts'),
  };
  ...
}
```

Replace all `document.getElementById(...)` calls in methods with `this.els.*`.

---

### 8. Fix deprecated `navigator.platform`

**Problem:** `loadShortcuts` uses `navigator.platform` which is deprecated.

**Fix:**
```js
const isMac = navigator.userAgentData?.platform === 'macOS'
  || navigator.platform.toUpperCase().includes('MAC');
```

---

### 9. Remove retry boilerplate from storage functions

**Problem:** `getAutoCollapseSettings`, `getTabActivity`, `updateTabActivity`, `removeTabActivity` all have identical retry logic for "No SW" errors. `chrome.storage.local` does not actually throw "No SW" errors — this is dead code copied between functions.

**Fix:** Remove the retry blocks. Keep only the try/catch with fallback return values.

---

## What is NOT changing

- Overall file structure (no splitting of `background.js`)
- `tabGrouper()` self-contained injection pattern (required by Chrome scripting API)
- Retry logic for tab drag operations (genuinely needed)
- The duplicate utility functions inside `tabGrouper()` (required — injected functions cannot import)

---

## Files modified

| File | Changes |
|------|---------|
| `background.js` | Items 1–6, 9 |
| `js/modules/popupManager.js` | Items 7, 8 |
