# TabGrouper Extract tabGrouper to search-ui.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 2300-line `tabGrouper()` function out of `background.js` into a dedicated `search-ui.js` file, reducing the service worker to its proper role as a message router and event handler.

**Architecture:** Classic (non-module) service workers support `importScripts()` — this is the no-build-step way to split code across files. `background.js` calls `importScripts('search-ui.js')` at the top, which loads `tabGrouper` into the service worker scope. The injection call (`chrome.scripting.executeScript({ function: tabGrouper, args: [...] })`) continues to work exactly as before because `tabGrouper` is still a function in scope. No changes to manifest.json required.

**Tech Stack:** Chrome Extension MV3, vanilla JS, `importScripts()` (classic service worker only — works because `background.js` has no `"type": "module"` in manifest.json).

---

## Files modified

| File | Tasks |
|------|-------|
| `search-ui.js` (new) | Task 1 |
| `background.js` | Task 2 |

---

### Task 1: Create search-ui.js with the tabGrouper function

**Files:**
- Create: `search-ui.js` (root of extension directory)

Extract lines 559–2860 from `background.js` into `search-ui.js`. The function must remain completely self-contained (no imports, no references to variables outside the function body) — this is already true since it redefines `CONFIG`, `ACTIONS`, and all utilities internally.

- [ ] **Step 1: Identify the exact boundaries of `tabGrouper` in background.js**

The function starts at:
```js
// Tab grouper main function - will be injected as content script
// This function will be stringified and injected, so it must be self-contained
function tabGrouper(bookmarkTreeNodes, alltabs) {
```

The function ends at the closing `}` on its own line, followed by:
```js
// Event listeners
function isInjectableTab(tab) {
```

Read `background.js` around lines 557–2862 to confirm the exact start and end line numbers before proceeding.

- [ ] **Step 2: Create `search-ui.js` with the extracted function**

Create `/Users/y.zhang/work/selfwork/TabGrouper/search-ui.js` containing:
1. A brief header comment
2. The entire `tabGrouper` function, copied verbatim from `background.js`

The file must start with:
```js
// search-ui.js — Injected search overlay for TabGrouper
// This file is loaded via importScripts() in background.js and injected into
// page context via chrome.scripting.executeScript({ function: tabGrouper, args: [...] }).
// The function must be self-contained: no imports, no external references.

function tabGrouper(bookmarkTreeNodes, alltabs) {
  // ... (entire body copied verbatim from background.js lines 560–2859) ...
}
```

Copy the function body exactly — do not modify a single character of the function.

- [ ] **Step 3: Verify search-ui.js is syntactically valid**

```bash
node --check /Users/y.zhang/work/selfwork/TabGrouper/search-ui.js
```

Expected: no output (syntax OK). If there are errors, fix them before proceeding.

- [ ] **Step 4: Confirm search-ui.js contains the complete function**

```bash
grep -c "function tabGrouper" /Users/y.zhang/work/selfwork/TabGrouper/search-ui.js
```

Expected: `1`

```bash
tail -5 /Users/y.zhang/work/selfwork/TabGrouper/search-ui.js
```

Expected: the last line is `}` (closing brace of `tabGrouper`).

- [ ] **Step 5: Commit**

```bash
git add search-ui.js
git commit -m "refactor: extract tabGrouper function to search-ui.js"
```

---

### Task 2: Load search-ui.js via importScripts and remove tabGrouper from background.js

**Files:**
- Modify: `background.js` — add `importScripts` at top, remove `tabGrouper` function body

- [ ] **Step 1: Add `importScripts('search-ui.js')` as the second line of background.js**

Find the first two lines of `background.js`:
```js
// Service worker for TabGrouper
console.log('TabGrouper background script loading...');
```

Replace with:
```js
// Service worker for TabGrouper
importScripts('search-ui.js');
console.log('TabGrouper background script loading...');
```

`importScripts` must be called at the top level of the service worker script (not inside a function or event handler). Placing it on line 2 ensures it runs during the initial script evaluation.

- [ ] **Step 2: Remove the tabGrouper function from background.js**

Find the comment and function declaration:
```js
// Tab grouper main function - will be injected as content script
// This function will be stringified and injected, so it must be self-contained
function tabGrouper(bookmarkTreeNodes, alltabs) {
```

Delete from this comment block all the way through to the closing `}` of `tabGrouper` (the line before `// Event listeners`). This removes approximately 2300 lines.

After deletion, `background.js` should jump from the `addToRecentTabs` function directly to the event listeners section:
```js
// Event listeners
function isInjectableTab(tab) {
```

- [ ] **Step 3: Verify background.js no longer contains tabGrouper**

```bash
grep -n "function tabGrouper" /Users/y.zhang/work/selfwork/TabGrouper/background.js
```

Expected: no output.

- [ ] **Step 4: Verify background.js still references tabGrouper correctly**

```bash
grep -n "tabGrouper" /Users/y.zhang/work/selfwork/TabGrouper/background.js
```

Expected: exactly one result — the line inside `chrome.scripting.executeScript`:
```
          function: tabGrouper,
```

- [ ] **Step 5: Verify background.js line count dropped by ~2300 lines**

```bash
wc -l /Users/y.zhang/work/selfwork/TabGrouper/background.js
```

Expected: approximately 1100–1300 lines (was ~3460).

- [ ] **Step 6: Syntax check both files**

```bash
node --check /Users/y.zhang/work/selfwork/TabGrouper/background.js
node --check /Users/y.zhang/work/selfwork/TabGrouper/search-ui.js
```

Expected: no output from either.

- [ ] **Step 7: Test the extension manually**

1. Open `chrome://extensions/`
2. Click the reload button on the TabGrouper card
3. Open any `https://` page
4. Press `Cmd+H` (Mac) or `Ctrl+H` (Windows)
5. Verify the search overlay appears with bookmarks and tabs
6. Type a search query — verify results filter correctly
7. Press Tab — verify keyboard navigation works between sections
8. Press Escape — verify overlay closes

If the overlay does not appear, open the service worker DevTools (click "Service Worker" in chrome://extensions) and check the console for errors. Common issue: `importScripts` fails if the path is wrong — the path is relative to the extension root, so `'search-ui.js'` is correct if `search-ui.js` is at the extension root alongside `background.js`.

- [ ] **Step 8: Commit**

```bash
git add background.js
git commit -m "refactor: load tabGrouper via importScripts, remove 2300 lines from background.js"
```
