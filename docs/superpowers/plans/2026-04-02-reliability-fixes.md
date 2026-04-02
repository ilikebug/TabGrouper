# TabGrouper Reliability & Safety Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all data-integrity and correctness bugs: incomplete cache invalidation, a race condition in `getTabActivity`, in-memory dedup state lost on service worker dormancy, missed alarm detection, and O(n) bookmark path lookups.

**Architecture:** All changes are in `background.js` only. No new files. No structural changes. Each task is independent and safe to commit separately.

**Tech Stack:** Chrome Extension MV3, vanilla JS, `chrome.storage.session` (Chrome 102+), `chrome.alarms`.

---

## Files modified

| File | Tasks |
|------|-------|
| `background.js` | 1–5 |

---

### Task 1: Complete cache invalidation for tabActivity and recentTabs

**Files:**
- Modify: `background.js` — lines 69–74

`tabActivityCache` and `recentTabsCache` are never invalidated when storage changes externally (e.g. from a second extension context or direct storage write). Only `supportedHostsCache` is. This causes stale data bugs.

- [ ] **Step 1: Replace the `storage.onChanged` listener**

Find this block (lines 69–74):
```js
// Invalidate supportedHostsCache when hosts are updated from the popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS]) {
    supportedHostsCache = null;
  }
});
```

Replace with:
```js
// Invalidate in-memory caches when storage is updated externally
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[CONFIG.STORAGE_KEYS.SUPPORTED_HOSTS]) supportedHostsCache = null;
  if (changes[CONFIG.STORAGE_KEYS.TAB_ACTIVITY]) tabActivityCache = null;
  if (changes[CONFIG.STORAGE_KEYS.RECENT_TABS]) recentTabsCache = null;
});
```

- [ ] **Step 2: Verify**

Confirm all three cache variables are cleared in the single listener. Confirm `area !== 'local'` early return is present (prevents reacting to sync storage).

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "fix: invalidate tabActivityCache and recentTabsCache on storage change"
```

---

### Task 2: Fix getTabActivity race condition with promise deduplication

**Files:**
- Modify: `background.js` — lines 102–115

`getTabActivity` checks `tabActivityCache !== null` and if null, does `await chrome.storage.local.get(...)`. If two callers race before the first `get` resolves (cache miss), both get their own snapshot from storage, both modify it, and one write overwrites the other. Fix: deduplicate concurrent cold-start reads with a shared promise.

- [ ] **Step 1: Replace `tabActivityCache` declaration and `getTabActivity`**

Find this block (lines 102–115):
```js
let tabActivityCache = null;

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
```

Replace with:
```js
let tabActivityCache = null;
let tabActivityLoadPromise = null;

async function getTabActivity() {
  if (tabActivityCache !== null) return tabActivityCache;
  if (!tabActivityLoadPromise) {
    tabActivityLoadPromise = chrome.storage.local.get(CONFIG.STORAGE_KEYS.TAB_ACTIVITY)
      .then(result => {
        tabActivityCache = result[CONFIG.STORAGE_KEYS.TAB_ACTIVITY] || {};
        return tabActivityCache;
      })
      .catch(error => {
        console.error('Error getting tab activity:', error);
        tabActivityCache = {};
        return tabActivityCache;
      })
      .finally(() => { tabActivityLoadPromise = null; });
  }
  return tabActivityLoadPromise;
}
```

- [ ] **Step 2: Verify**

Confirm `tabActivityLoadPromise` is declared before `getTabActivity`. Confirm `.finally(() => { tabActivityLoadPromise = null; })` resets the promise so future cold starts work correctly after Task 1 invalidates the cache.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "fix: deduplicate concurrent getTabActivity cold-start reads"
```

---

### Task 3: Replace in-memory processedClicks with chrome.storage.session

**Files:**
- Modify: `background.js` — lines 3076–3153

`const processedClicks = new Set()` is module-level. When the service worker sleeps and wakes up, the Set is empty — all dedup history is lost. Also, a `setTimeout` inside `handleOpenQuickAccessTab` fires async after `sendResponse`, which races with SW dormancy. Replace with `chrome.storage.session` (persists across SW restarts within the same browser session) and remove the fire-and-forget `setTimeout`.

- [ ] **Step 1: Replace the `processedClicks` Set and beginning of `handleOpenQuickAccessTab`**

Find this block (lines 3076–3097):
```js
// Track processed clicks to prevent duplicates
const processedClicks = new Set();

async function handleOpenQuickAccessTab(request, sender, sendResponse) {
  const normalizeUrl = (url) => url ? url.replace(/\/$/, '').toLowerCase() : '';

  // Check if this click has already been processed
  if (request.clickId && processedClicks.has(request.clickId)) {
    if (sendResponse) {
      sendResponse({ success: false, error: 'Duplicate click' });
    }
    return true;
  }

  // Mark this click as processed
  if (request.clickId) {
    processedClicks.add(request.clickId);
    // Clean up after 5 seconds to prevent memory leak
    setTimeout(() => {
      processedClicks.delete(request.clickId);
    }, 5000);
  }
```

Replace with:
```js
async function isClickDuplicate(clickId) {
  try {
    const result = await chrome.storage.session.get('processedClicks');
    const clicks = result.processedClicks || {};
    const now = Date.now();
    for (const [id, ts] of Object.entries(clicks)) {
      if (now - ts > 5000) delete clicks[id];
    }
    if (clicks[clickId]) {
      await chrome.storage.session.set({ processedClicks: clicks });
      return true;
    }
    clicks[clickId] = now;
    await chrome.storage.session.set({ processedClicks: clicks });
    return false;
  } catch (error) {
    console.error('Error checking click dedup:', error);
    return false;
  }
}

async function handleOpenQuickAccessTab(request, sender, sendResponse) {
  const normalizeUrl = (url) => url ? url.replace(/\/$/, '').toLowerCase() : '';

  if (request.clickId && await isClickDuplicate(request.clickId)) {
    if (sendResponse) sendResponse({ success: false, error: 'Duplicate click' });
    return true;
  }
```

- [ ] **Step 2: Remove the fire-and-forget `setTimeout` block**

Inside `handleOpenQuickAccessTab`, find this block (around lines 3120–3139):
```js
      // Add a small delay and check if Chrome created any additional tabs
      setTimeout(async () => {
        try {
          const allTabsAfter = await chrome.tabs.query({});
          const duplicateTabs = allTabsAfter.filter(tab => {
            return normalizeUrl(tab.url) === normalizeUrl(request.url) && tab.id !== newTab.id;
          });
          
          if (duplicateTabs.length > 0) {
            for (const dupTab of duplicateTabs) {
              await safeTabOperation(
                () => chrome.tabs.remove(dupTab.id),
                'remove duplicate tab'
              );
            }
          }
        } catch (error) {
          console.error('Error checking for duplicate tabs:', error);
        }
      }, 1000); // 1 second delay
```

Delete it entirely. The pre-creation duplicate check (`matchingTabs`) already handles the common case. The `isClickDuplicate` guard now prevents double-execution across SW restarts.

- [ ] **Step 3: Verify**

Confirm `const processedClicks = new Set()` is gone. Confirm `isClickDuplicate` is defined before `handleOpenQuickAccessTab`. Confirm the `setTimeout` block inside the function is gone. Confirm the existing `matchingTabs` check (activate-existing-tab logic) is still present.

- [ ] **Step 4: Commit**

```bash
git add background.js
git commit -m "fix: persist click dedup in storage.session; remove fire-and-forget setTimeout"
```

---

### Task 4: Detect and recover from missed auto-collapse alarms

**Files:**
- Modify: `background.js` — `checkInactiveTabGroups`, `ensureAutoCollapseActive`, `onStartup` listener

On low-battery or high-load systems Chrome can delay or skip alarm firings. Currently there is no record of when the alarm last ran, so a missed run is undetectable. Fix: record `alarmLastRun` in `chrome.storage.session` on every run, and check it in `ensureAutoCollapseActive`.

- [ ] **Step 1: Record last-run timestamp in `checkInactiveTabGroups`**

Find the start of `checkInactiveTabGroups` (line 137):
```js
async function checkInactiveTabGroups() {
  try {
    const settings = await getAutoCollapseSettings();
```

Replace with:
```js
async function checkInactiveTabGroups() {
  try {
    await chrome.storage.session.set({ alarmLastRun: Date.now() });
    const settings = await getAutoCollapseSettings();
```

- [ ] **Step 2: Add `recoverMissedAlarm` function before `ensureAutoCollapseActive`**

Find `// Ensure auto-collapse is working whenever the service worker becomes active` (line 301). Immediately before it, insert:
```js
async function recoverMissedAlarm() {
  try {
    const settings = await getAutoCollapseSettings();
    if (!settings.enabled) return;
    const result = await chrome.storage.session.get('alarmLastRun');
    const lastRun = result.alarmLastRun;
    if (!lastRun) return; // No record — first run or fresh browser session
    const intervalMs = settings.timeoutMinutes * 60 * 1000;
    if (Date.now() - lastRun > intervalMs * 2) {
      console.warn('⚠️ Auto-collapse alarm may have been missed — running now');
      await checkInactiveTabGroups();
    }
  } catch (error) {
    console.error('Error in recoverMissedAlarm:', error);
  }
}

```

- [ ] **Step 3: Call `recoverMissedAlarm` from `ensureAutoCollapseActive`**

Find the end of `ensureAutoCollapseActive` (line 327, the closing `}`). Replace that final `}` with:
```js
    await recoverMissedAlarm();
  } catch (error) {
    console.error('❌ Error ensuring auto-collapse is active:', error);
    try {
      await startAutoCollapseChecker();
      console.log('✅ Auto-collapse restarted as fallback');
    } catch (fallbackError) {
      console.error('❌ Failed to restart auto-collapse:', fallbackError);
    }
  }
}
```

Wait — first read `ensureAutoCollapseActive` carefully to find where to insert the call. The function ends with the inner fallback try-catch. Insert `await recoverMissedAlarm();` as the last line inside the outer try block (just before the outer catch).

Find this block in `ensureAutoCollapseActive` (lines 315–328):
```js
    } else {
      console.log(`⏰ Auto-collapse alarm is active (next: ${new Date(alarm.scheduledTime).toLocaleTimeString()})`);
    }
  } catch (error) {
    console.error('❌ Error ensuring auto-collapse is active:', error);
    // Try to restart the checker as a fallback
    try {
      await startAutoCollapseChecker();
      console.log('✅ Auto-collapse restarted as fallback');
    } catch (fallbackError) {
      console.error('❌ Failed to restart auto-collapse:', fallbackError);
    }
  }
}
```

Replace with:
```js
    } else {
      console.log(`⏰ Auto-collapse alarm is active (next: ${new Date(alarm.scheduledTime).toLocaleTimeString()})`);
    }
    await recoverMissedAlarm();
  } catch (error) {
    console.error('❌ Error ensuring auto-collapse is active:', error);
    // Try to restart the checker as a fallback
    try {
      await startAutoCollapseChecker();
      console.log('✅ Auto-collapse restarted as fallback');
    } catch (fallbackError) {
      console.error('❌ Failed to restart auto-collapse:', fallbackError);
    }
  }
}
```

- [ ] **Step 4: Verify**

Confirm `recoverMissedAlarm` is defined before `ensureAutoCollapseActive`. Confirm `await recoverMissedAlarm()` is inside the outer try block of `ensureAutoCollapseActive`, before the catch. Confirm `await chrome.storage.session.set({ alarmLastRun: Date.now() })` is the first line inside `checkInactiveTabGroups`'s try block.

- [ ] **Step 5: Commit**

```bash
git add background.js
git commit -m "feat: detect and recover from missed auto-collapse alarms via storage.session"
```

---

### Task 5: Optimize getBookmarkPath — replace per-ancestor API calls with a node map

**Files:**
- Modify: `background.js` — `getBookmarkPath` (lines 492–509), `searchTabsAndBookmarks` (lines 441–490)

`searchTabsAndBookmarks` calls `getBookmarkPath(id)` for each matching bookmark. Each call chains `chrome.bookmarks.get(parentId)` per ancestor level — so 10 bookmarks at depth 4 = 40 API calls. Fix: fetch the full bookmark tree once, build an ID→node map, traverse in memory.

- [ ] **Step 1: Replace `getBookmarkPath` with `buildBookmarkNodeMap` + `getBookmarkPathFromMap`**

Find the entire `getBookmarkPath` function (lines 492–509):
```js
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
```

Replace with:
```js
function buildBookmarkNodeMap(tree) {
  const nodeMap = {};
  const traverse = (nodes) => {
    for (const node of nodes) {
      nodeMap[node.id] = node;
      if (node.children) traverse(node.children);
    }
  };
  traverse(tree);
  return nodeMap;
}

function getBookmarkPathFromMap(bookmarkId, nodeMap) {
  const path = [];
  let node = nodeMap[bookmarkId];
  while (node && node.parentId) {
    node = nodeMap[node.parentId];
    if (node && node.title) path.unshift(node.title);
  }
  return path;
}
```

- [ ] **Step 2: Update `searchTabsAndBookmarks` to use the node map**

Find the `searchTabsAndBookmarks` function (lines 441–490):
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

Replace with:
```js
async function searchTabsAndBookmarks(query) {
  const [tabs, supportedHosts, bookmarks, bookmarkTree] = await Promise.all([
    chrome.tabs.query({}),
    getSupportedHosts(),
    chrome.bookmarks.search(query),
    chrome.bookmarks.getTree()
  ]);

  const nodeMap = buildBookmarkNodeMap(bookmarkTree);
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

  const bookmarksWithPath = bookmarks.map(bookmark => ({
    type: 'bookmark',
    id: bookmark.id,
    title: bookmark.title,
    url: bookmark.url,
    path: getBookmarkPathFromMap(bookmark.id, nodeMap)
  }));

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

- [ ] **Step 3: Verify**

Confirm `buildBookmarkNodeMap` and `getBookmarkPathFromMap` are defined. Confirm `searchTabsAndBookmarks` now uses `chrome.bookmarks.getTree()` (one call) and `getBookmarkPathFromMap` (no async, no API calls). Confirm the old `getBookmarkPath` function no longer exists.

- [ ] **Step 4: Commit**

```bash
git add background.js
git commit -m "perf: replace per-ancestor bookmark API calls with single tree fetch + node map"
```
