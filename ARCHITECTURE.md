# TabGrouper Architecture

## Active Runtime Path

- `manifest.json`
  - Background service worker: `background.js`
  - Popup UI: `popup/popup.html` -> `popup/popup.js` -> `js/modules/popupManager.js`
- Search UI entry
  - Triggered by command `open-search-box` in `background.js`
  - Injects `tabGrouper` function into active tab via `chrome.scripting.executeScript`
- Auto-collapse
  - Event-driven via `chrome.alarms` + startup/install/message ping initialization

## Supporting Modules In Use

- `js/modules/popupManager.js`
- `js/constants/config.js`
- `js/utils/hostUtils.js`

## Alternate / Legacy Paths (Not wired in manifest today)

- `js/content-script.js`
  - Contains a standalone UI implementation similar to `tabGrouper`
  - Not declared under `content_scripts` in `manifest.json`
- `sidepanel.html` + `js/sidepanel.js` + `css/sidepanel.css`
  - Side panel UI exists in codebase
  - Not declared with a `side_panel` key in `manifest.json`
- `legacy/js/modules/uiComponents.js`, `legacy/js/modules/bookmarkManager.js`, `legacy/js/utils/{tabUtils,searchUtils,domUtils}.js`
  - Additional modular UI/util implementations
  - Archived and not selected as primary runtime path for search UI

## Practical Rule For Future Changes

- If changing search-overlay behavior, update `background.js` (`tabGrouper`) first.
- If changing popup host mapping / auto-collapse settings UI, update `js/modules/popupManager.js`.
- Before enabling side panel or content script paths, decide whether to:
  - fully migrate to one path, or
  - keep both paths and enforce shared constants/utils.
