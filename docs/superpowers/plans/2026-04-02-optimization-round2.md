# TabGrouper Optimization Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining performance, dead code, and correctness issues identified after round 1.

**Architecture:** All changes are in-place edits to `background.js` only. No new files. No build step changes.

**Tech Stack:** Chrome Extension MV3, vanilla JS, no test framework.

---

## Files modified

| File | Tasks |
|------|-------|
| `background.js` | 1–8 |

---

### Task 1: Cache `supportedHosts` in memory

**Files:**
- Modify: `background.js` — add cache variable, update `getSupportedHosts`

`getSupportedHosts()` is called on every `onUpdated` tab event (every page load). Like `tabActivity`, it should be cached in memory.

- [ ] **Step 1: Add cache variable and update `getSupportedHosts`**

Find `getSupportedHosts` function (around line 345). Immediately before it, add:
```js
let supportedHostsCache = null;
```

Then replace `getSupportedHosts`:
```js
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
```

- [ ] **Step 2: Invalidate cache when hosts are saved**

Find `saveAutoCollapseSettings` — there's no equivalent `saveSupportedHosts` in background.js (hosts are saved from popup via storage directly). The cache will naturally reset when the service worker restarts. This is acceptable — no extra invalidation needed.

- [ ] **Step 3: Verify**

Confirm `supportedHostsCache` variable is declared before `getSupportedHosts`, and the function checks cache first.

- [ ] **Step 4: Commit**

```bash
git add background.js
git commit -m "perf: add in-memory cache for supportedHosts"
```

---

### Task 2: Cache `recentTabs` in memory

**Files:**
- Modify: `background.js` — add cache, update `getRecentTabs` and `addToRecentTabs`

`addToRecentTabs` calls `getRecentTabs()` which reads storage on every tab activation/update. Add a module-level cache.

- [ ] **Step 1: Add cache variable before `getRecentTabs`**

Find `getRecentTabs` function (around line 540). Immediately before it, add:
```js
let recentTabsCache = null;
```

- [ ] **Step 2: Replace `getRecentTabs`**

```js
async function getRecentTabs() {
  if (recentTabsCache !== null) {
    // Filter expired entries from cache
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
```

- [ ] **Step 3: Replace `addToRecentTabs`**

```js
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
```

- [ ] **Step 4: Commit**

```bash
git add background.js
git commit -m "perf: add in-memory cache for recentTabs"
```

---

### Task 3: Remove "No SW" dead code from `checkInactiveTabGroups`

**Files:**
- Modify: `background.js` — simplify inner try-catch in `checkInactiveTabGroups`

The inner catch block checks `error.message?.includes('No SW')` — `chrome.tabs.query` and `getActiveTab` do not throw this error. The entire fallback branch is dead code.

- [ ] **Step 1: Replace the inner try-catch block**

Find the section in `checkInactiveTabGroups` that looks like:
```js
    let tabActivity, tabs, activeTab;
    
    try {
      [tabActivity, tabs, activeTab] = await Promise.all([
        getTabActivity(),
        getAllTabs(),
        getActiveTab()
      ]);
    } catch (error) {
      console.error('❌ Failed to get required data for check:', error);
      
      // If Service Worker is dead, try to get basic data...
      if (error.message?.includes('No SW')) {
        ...
      } else {
        throw error;
      }
    }
```

Replace with:
```js
    const [tabActivity, tabs, activeTab] = await Promise.all([
      getTabActivity(),
      getAllTabs(),
      getActiveTab()
    ]);
```

(The outer `try/catch` at the function level already handles any errors.)

- [ ] **Step 2: Verify**

Confirm the dead "No SW" fallback block is gone and the three-way `Promise.all` is now a simple `const` declaration.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "refactor: remove dead No-SW fallback from checkInactiveTabGroups"
```

---

### Task 4: Extract `normalizeUrl` helper in `handleOpenQuickAccessTab`

**Files:**
- Modify: `background.js` — deduplicate `normalizeUrl` inside `handleOpenQuickAccessTab`

The function defines the same inline `normalizeUrl` arrow function twice: once in the filter (line ~3148) and again inside the `setTimeout` callback (line ~3173).

- [ ] **Step 1: Extract to a named helper at the top of the function**

Find `handleOpenQuickAccessTab`. Replace the two inline `normalizeUrl` definitions with a single one declared at the top of the function body:

The function currently starts like:
```js
async function handleOpenQuickAccessTab(request, sender, sendResponse) {
  // Check if this click has already been processed
  if (request.clickId && processedClicks.has(request.clickId)) {
```

Add `normalizeUrl` immediately inside the function, before the duplicate check:
```js
async function handleOpenQuickAccessTab(request, sender, sendResponse) {
  const normalizeUrl = (url) => url ? url.replace(/\/$/, '').toLowerCase() : '';

  // Check if this click has already been processed
  if (request.clickId && processedClicks.has(request.clickId)) {
```

Then remove both inline `const normalizeUrl = (url) => { ... }` definitions from inside the filter callback and inside the setTimeout callback. They both become simple references to the outer `normalizeUrl`.

- [ ] **Step 2: Verify**

Confirm `normalizeUrl` is declared exactly once in `handleOpenQuickAccessTab` and is used in both the filter and the setTimeout without redefinition.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "refactor: extract duplicate normalizeUrl helper in handleOpenQuickAccessTab"
```

---

### Task 5: Remove redundant `return true` from `handleActivateTab` and `handleRemoveTab`

**Files:**
- Modify: `background.js`

These are `async function`s. The `onMessage` listener's `isPromiseLike` check handles keeping the channel open. The `return true` at the end of each is unreachable after `sendResponse` is called.

- [ ] **Step 1: Remove `return true` from `handleActivateTab`**

Find `handleActivateTab`. It ends with:
```js
  return true; // Keep message channel open
```
Delete that line.

- [ ] **Step 2: Remove `return true` from `handleRemoveTab`**

Find `handleRemoveTab`. It ends with:
```js
  return true;
```
Delete that line.

- [ ] **Step 3: Verify**

Confirm neither function has `return true` at the end. Both still have `sendResponse(...)` calls inside try/catch.

- [ ] **Step 4: Commit**

```bash
git add background.js
git commit -m "refactor: remove redundant return true from async message handlers"
```

---

### Task 6: Convert callback-based tab grouping to Promise-based

**Files:**
- Modify: `background.js` — `syncAllTabGroupsWithTitles` and `onUpdated` listener

Both still use `chrome.tabs.group({ tabIds }, (groupId) => { ... })` callback style. MV3 supports Promise-based `chrome.tabs.group`.

- [ ] **Step 1: Replace `syncAllTabGroupsWithTitles`**

Find `syncAllTabGroupsWithTitles` and replace:
```js
async function syncAllTabGroupsWithTitles() {
  const alltabs = await getAllTabs();
  const groupedTabs = await groupTabsByHost(alltabs);

  for (const [host, tabs] of Object.entries(groupedTabs)) {
    const tabIds = tabs
      .map(tab => tab?.id)
      .filter(tabId => typeof tabId === 'number');

    if (tabIds.length === 0) continue;

    try {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, { title: host });
    } catch (error) {
      console.warn(`Failed to sync group title for host "${host}":`, error);
    }
  }
}
```

- [ ] **Step 2: Replace the tab grouping block inside `onUpdated`**

Find the tab grouping block inside the `chrome.tabs.onUpdated.addListener` callback (the third try block). Replace:
```js
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
```

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "refactor: convert tab grouping callbacks to async/await in syncAllTabGroupsWithTitles and onUpdated"
```

---

### Task 7: Remove redundant `if (supportedHosts)` guard in `mapUrlToHost`

**Files:**
- Modify: `background.js`

`mapUrlToHost` has `if (supportedHosts)` but the parameter defaults to `{}`, which is always truthy. The guard is dead code.

- [ ] **Step 1: Simplify `mapUrlToHost`**

Replace:
```js
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
```

With:
```js
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
```

- [ ] **Step 2: Commit**

```bash
git add background.js
git commit -m "refactor: remove redundant if(supportedHosts) guard in mapUrlToHost"
```

---

### Task 8: Remove verbose `console.log` from `trackRecentTab` and `onUpdated`

**Files:**
- Modify: `background.js`

Production code logs on every tab activation/update. These are noise in normal use.

Remove the following log lines:

From `trackRecentTab`:
- `console.log('Skipping: no tab object');`
- `console.log('Skipping: no URL for tab', tab.id);`
- `console.log('Skipping chrome:// or extension URL:', tab.url);`
- `console.log('Skipping blank page');`
- `console.log('✓ Tracking tab:', tab.title || 'No title', tab.url);`

From `onUpdated` listener:
- `console.log(`🔄 Tab updated and time recorded: ${tabId}`);`

Keep all `console.error` and `console.warn` calls — only remove `console.log`.

- [ ] **Step 1: Remove the log lines**

Edit `background.js` to remove each of the 6 lines listed above.

- [ ] **Step 2: Verify**

Confirm `console.error` lines in `trackRecentTab` are still present. Confirm the 6 `console.log` lines are gone.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "chore: remove verbose console.log from trackRecentTab and onUpdated"
```
