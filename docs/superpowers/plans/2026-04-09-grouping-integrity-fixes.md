# TabGrouper Grouping Integrity Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two confirmed correctness bugs in TabGrouper: cross-window tab grouping failures and overly broad host matching that misclassifies unrelated URLs.

**Architecture:** Keep the runtime architecture intact. Do not convert the background service worker to modules. Add a lightweight Node regression harness that exercises real logic from `background.js` and `js/utils/hostUtils.js`, then introduce minimal pure helpers for hostname matching and window-scoped group selection, and finally wire those helpers into the existing runtime paths.

**Tech Stack:** Chrome Extension MV3, vanilla JavaScript, Node.js built-in `assert`/`vm`, no build step, no external test framework.

**Worktree Safety:** This repository already has unrelated uncommitted edits. Do not make intermediate commits while executing this plan. Complete the fix, verify it, and only consider a final commit after explicitly reviewing the resulting diff and confirming no unrelated hunks are included.

---

## Files modified

| File | Purpose |
|------|---------|
| `background.js` | Add pure helpers and fix window-scoped grouping logic in runtime paths |
| `js/utils/hostUtils.js` | Tighten host matching semantics used by popup/shared utilities |
| `tests/background-grouping.test.mjs` | Regression tests for host matching and window-scoped grouping behavior |

---

### Task 1: Create regression tests for the two root causes

**Files:**
- Create: `tests/background-grouping.test.mjs`

The repository has no test framework, so use a single Node test file that:
- imports `js/utils/hostUtils.js`
- loads `background.js` into a `vm` context with stubbed `chrome`/`importScripts`
- exposes selected pure functions from `background.js` for direct assertions

- [ ] **Step 1: Write the failing test for precise host matching**

In `tests/background-grouping.test.mjs`, add a case that proves the current `includes()` behavior is wrong:

```js
assert.equal(
  mapUrlToHost('https://example.com/?next=github.com', { 'github.com': 'GitHub' }),
  'example'
);
```

Also add a positive case that real host or subdomain matches still map correctly:

```js
assert.equal(
  mapUrlToHost('https://docs.github.com/en', { 'github.com': 'GitHub' }),
  'GitHub'
);
```

- [ ] **Step 2: Write the failing test for window-scoped group lookup**

In the same file, add a case for a new pure helper from `background.js` named `findExistingGroupInWindow(groups, host, windowId)`:

```js
assert.deepEqual(
  findExistingGroupInWindow(
    [
      { id: 11, title: 'GitHub', windowId: 100 },
      { id: 22, title: 'GitHub', windowId: 200 }
    ],
    'GitHub',
    200
  ),
  { id: 22, title: 'GitHub', windowId: 200 }
);
```

Add a no-match case that proves groups from other windows must not be reused.

- [ ] **Step 3: Write the failing test for startup/install regrouping**

Add a case for a second new helper from `background.js` named `groupTabsByWindowAndHost(tabs, supportedHosts)`:

```js
assert.deepEqual(
  groupTabsByWindowAndHost([
    { id: 1, url: 'https://github.com/a', windowId: 10 },
    { id: 2, url: 'https://github.com/b', windowId: 20 }
  ], {}),
  {
    '10::github': [{ id: 1, url: 'https://github.com/a', windowId: 10 }],
    '20::github': [{ id: 2, url: 'https://github.com/b', windowId: 20 }]
  }
);
```

This test should fail against the current implementation because it groups by host only.

- [ ] **Step 4: Run the test to verify RED**

Run:

```bash
node tests/background-grouping.test.mjs
```

Expected:
- FAIL because new helper exports are missing and/or host matching still uses broad substring logic

- [ ] **Step 5: Leave changes uncommitted**

Do not commit after this task. The worktree is already dirty, and this task intentionally sets up red tests before implementation.

---

### Task 2: Implement minimal pure helpers for exact host matching and window scoping

**Files:**
- Modify: `background.js`
- Modify: `js/utils/hostUtils.js`
- Test: `tests/background-grouping.test.mjs`

Keep the implementation minimal and pure. Do not refactor unrelated background logic.

- [ ] **Step 1: Add a hostname-aware matcher in `js/utils/hostUtils.js`**

Introduce a helper with semantics:
- parse the URL hostname
- normalize to lowercase
- treat a supported host key as a match only when hostname equals the key or ends with `.${key}`

Example implementation shape:

```js
function hostnameMatches(hostname, supportedHost) {
  const normalizedHostname = hostname.toLowerCase();
  const normalizedSupportedHost = supportedHost.toLowerCase();
  return normalizedHostname === normalizedSupportedHost
    || normalizedHostname.endsWith(`.${normalizedSupportedHost}`);
}
```

Update `mapUrlToHost()` to use hostname matching instead of `url.includes(key)`.

- [ ] **Step 2: Mirror the same semantics inside `background.js`**

Because `background.js` is not a module today, add the same minimal pure helpers there:
- `hostnameMatches(hostname, supportedHost)`
- `findExistingGroupInWindow(groups, host, windowId)`
- `groupTabsByWindowAndHost(tabs, supportedHosts)`

`groupTabsByWindowAndHost()` should return buckets keyed by both window and host so startup/install regrouping never tries to group tabs from different windows together.

- [ ] **Step 3: Run the test to verify GREEN**

Run:

```bash
node tests/background-grouping.test.mjs
```

Expected:
- PASS for all host-matching and helper-level grouping assertions

- [ ] **Step 4: Refactor only if needed**

If helper names or duplicated normalization logic are awkward, do a tiny cleanup while keeping tests green. Do not widen scope beyond these helpers.

- [ ] **Step 5: Leave changes uncommitted**

Do not commit after this task. Keep moving into runtime wiring so the final diff can be reviewed as one scoped change.

---

### Task 3: Wire the helpers into runtime grouping flows

**Files:**
- Modify: `background.js`
- Test: `tests/background-grouping.test.mjs`

Update only the runtime paths that currently violate window boundaries.

- [ ] **Step 1: Fix `syncAllTabGroupsWithTitles()`**

Replace the current host-only regrouping path with `groupTabsByWindowAndHost(alltabs, supportedHosts)`.

For each bucket:
- extract tab IDs
- call `chrome.tabs.group({ tabIds })` only for tabs from the same window
- continue setting the group title to the logical host label

- [ ] **Step 2: Fix `chrome.tabs.onUpdated` grouping**

In the update listener:
- keep `host = mapUrlToHost(tab.url, supportedHosts)`
- query existing groups as today
- choose the candidate with `findExistingGroupInWindow(groups, host, tab.windowId)`
- only reuse a group from the same `windowId`
- otherwise create a new group in the current window and title it with `host`

- [ ] **Step 3: Preserve existing behavior for unsupported URLs and errors**

Do not change:
- recent-tabs tracking behavior
- auto-collapse behavior
- retry behavior in `safeTabOperation`
- current error logging shape, except where a variable rename is needed

- [ ] **Step 4: Run regression tests again**

Run:

```bash
node tests/background-grouping.test.mjs
```

Expected:
- PASS

- [ ] **Step 5: Run syntax verification**

Run:

```bash
node --check background.js
node --check js/utils/hostUtils.js
```

Expected:
- both commands succeed with no output

- [ ] **Step 6: Leave changes uncommitted**

Do not commit after this task. Runtime wiring must be verified together with the regression harness and manual checks.

---

### Task 4: Manual extension verification in Chrome

**Files:**
- No new files

The repository has no integration test harness for Chrome APIs, so finish with explicit manual checks.

- [ ] **Step 1: Reload the unpacked extension**

Use the existing workflow from `CLAUDE.md`:
- open `chrome://extensions/`
- reload the unpacked TabGrouper extension

- [ ] **Step 2: Verify cross-window grouping**

Manual scenario:
1. Open Window A and Window B
2. In both windows, open `github.com` tabs
3. Ensure each window either reuses only its own `GitHub` group or creates a separate `GitHub` group locally
4. Confirm there is no error and no attempt to merge tabs across windows

- [ ] **Step 3: Verify host matching no longer over-matches**

Manual scenario:
1. Add mapping `github.com -> GitHub`
2. Open a URL like `https://example.com/?next=github.com`
3. Confirm it is grouped under `example`, not `GitHub`
4. Open `https://docs.github.com/` and confirm it still maps to `GitHub`

- [ ] **Step 4: Re-run syntax/tests as final gate**

Run:

```bash
node tests/background-grouping.test.mjs
node --check background.js
node --check js/utils/hostUtils.js
```

Expected:
- all commands succeed

- [ ] **Step 5: Review final diff before any commit**

At the end of implementation:
- inspect `git diff -- background.js js/utils/hostUtils.js tests/background-grouping.test.mjs`
- confirm no unrelated hunks were pulled in from the existing dirty worktree
- only then decide whether to commit, and only if the human explicitly wants a commit
