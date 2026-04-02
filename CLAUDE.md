# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Setup

This is a Chrome Extension (Manifest V3) with no build step. Load it directly in Chrome:

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. After code changes, click the reload button on the extension card

There are no npm scripts, no build tooling, and no test framework.

## Architecture

### Core Components

**`background.js`** — The service worker (~3600 lines). This is the heart of the extension and handles everything: tab grouping, search, bookmarks, auto-collapse via `chrome.alarms`, recent tab tracking, and the injected search overlay. All significant logic lives here.

**`popup/popup.html` + `js/modules/popupManager.js`** — The settings UI (accessible via clicking the extension icon). Manages host-to-name mappings and auto-collapse configuration. Communicates with the service worker exclusively via `chrome.runtime.sendMessage()`.

**`js/constants/config.js`** — Shared constants: `CONFIG` object (icons, storage keys, timeout limits), and `ACTIONS` object (message action type strings).

**`js/utils/hostUtils.js`** — URL parsing (`extractHostFromUrl`, `mapUrlToHost`) and storage helpers for supported hosts.

### Communication Pattern

All cross-context communication uses `chrome.runtime.sendMessage()` with an `action` field matching strings from the `ACTIONS` constant. The service worker dispatches on these in `chrome.runtime.onMessage`.

### Injected Search Overlay

The `tabGrouper()` function in `background.js` is stringified and injected into the active tab when the user presses `Cmd+H` (`Ctrl+H` on Windows). This self-contained function renders a search UI in the tab's DOM, searches pre-fetched tab/bookmark data, and sends results back to the SW via `chrome.runtime.sendMessage()`.

### Auto-Collapse

Uses `chrome.alarms` (not `setInterval`) because service workers can sleep. Tab activity timestamps are stored in `chrome.storage.local` under the `tabActivity` key. An alarm fires periodically to collapse groups where all tabs exceed the configured inactivity timeout.

### Storage Structure

```
chrome.storage.local:
  supportedHosts: { "github.com": "GitHub", ... }
  autoCollapseSettings: { enabled: bool, timeoutMinutes: number }
  tabActivity: { [tabId]: lastActiveTimestamp }
  recentTabs: [{ id, title, url, favicon, timestamp }, ...]
```

### Inactive / Legacy Files

- `legacy/` — Archived modules that were replaced by inline implementations in `background.js`
- `js/content-script.js` — Not in manifest; superseded by the injected `tabGrouper()` function
- `sidepanel.html` + `js/sidepanel.js` — Not wired into manifest; an alternative UI that was never activated

Do not reference or depend on these files for new features.

## Key Behaviors to Know

- **Tab grouping** extracts the base domain (strips `www.`) and maps it via custom `supportedHosts` mappings.
- **Tab operations use retry logic** (up to 3 attempts, exponential backoff) to handle "user may be dragging" Chrome errors.
- **Recent tabs** auto-purge entries older than 24 hours; `chrome://` URLs are excluded.
- **Stale activity records** are cleaned up probabilistically (10% chance per alarm tick) to avoid unbounded storage growth.
