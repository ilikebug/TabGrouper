# TabGrouper Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all dead code files, fix XSS risks in the injected search overlay's dialogs.

**Architecture:** Task 1 deletes unused files. Task 2 fixes innerHTML XSS in `tabGrouper()` inside `background.js` by replacing dynamic template literals in attribute positions with DOM property assignments.

**Tech Stack:** Chrome Extension MV3, vanilla JS, Shadow DOM.

---

## Files modified

| File | Tasks |
|------|-------|
| `js/sidepanel.js` | Delete |
| `js/content-script.js` | Delete |
| `legacy/` directory | Delete |
| `background.js` | Task 2 |

---

### Task 1: Delete dead code files

**Files:**
- Delete: `js/sidepanel.js`
- Delete: `js/content-script.js`
- Delete: `legacy/` (entire directory)

None of these files are referenced in `manifest.json`. `js/sidepanel.js` and `js/content-script.js` contain duplicate definitions of utility functions that live in `background.js`. `legacy/` is an archive of replaced modules.

- [ ] **Step 1: Verify the files are not referenced anywhere**

```bash
grep -r "sidepanel" /Users/y.zhang/work/selfwork/TabGrouper/manifest.json
grep -r "content-script" /Users/y.zhang/work/selfwork/TabGrouper/manifest.json
```

Expected: no matches for either.

- [ ] **Step 2: Delete the files**

```bash
rm /Users/y.zhang/work/selfwork/TabGrouper/js/sidepanel.js
rm /Users/y.zhang/work/selfwork/TabGrouper/js/content-script.js
rm -rf /Users/y.zhang/work/selfwork/TabGrouper/legacy
```

- [ ] **Step 3: Verify deletion**

```bash
ls /Users/y.zhang/work/selfwork/TabGrouper/js/
ls /Users/y.zhang/work/selfwork/TabGrouper/
```

Confirm `sidepanel.js` and `content-script.js` are gone from `js/`. Confirm `legacy/` directory is gone from root.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete unused sidepanel.js, content-script.js, and legacy/ directory"
```

---

### Task 2: Fix innerHTML XSS in tabGrouper dialogs

**Files:**
- Modify: `background.js` — three locations inside `tabGrouper()`

Three places inside `tabGrouper()` use `innerHTML` with template literals that interpolate user-controlled or Chrome-API-derived strings directly into HTML attribute positions. A malicious page that sets `document.title` to contain `"` or `<` can break out of attribute values and inject event handlers into the overlay's dialogs.

**Location A** (line ~641): `dialog.innerHTML` — injects `currentTab.title` and `currentTab.url` into `value="..."` attributes.

**Location B** (line ~769): `folderItem.innerHTML` — injects `folder.title` (bookmark name) into a `<span>` text node.

**Location C** (line ~957): `folderDialog.innerHTML` — injects `parentFolderName` into `Create under "${parentFolderName}"` inside an HTML text node.

---

#### Location A: Save Bookmark dialog — currentTab.title and currentTab.url in input values

- [ ] **Step 1: Find the `dialog.innerHTML` assignment**

It starts with:
```js
    dialog.innerHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">💾 Save Bookmark</h3>
```

- [ ] **Step 2: Remove the dynamic values from the `dialog.innerHTML` template**

Find the two input lines inside `dialog.innerHTML` that interpolate dynamic values:

Line with title:
```js
          <input type="text" id="bookmark-title" value="${currentTab.title || ''}" placeholder="Enter bookmark name" style="width: 100%; padding: 12px 16px; border: 2px solid transparent; border-radius: 12px; background: rgba(248, 250, 252, 0.8); font-size: 14px; font-weight: 500; color: #1e293b; box-sizing: border-box; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
```

Replace with (no interpolation in value):
```js
          <input type="text" id="bookmark-title" placeholder="Enter bookmark name" style="width: 100%; padding: 12px 16px; border: 2px solid transparent; border-radius: 12px; background: rgba(248, 250, 252, 0.8); font-size: 14px; font-weight: 500; color: #1e293b; box-sizing: border-box; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
```

Line with url:
```js
          <input type="text" value="${currentTab.url || ''}" readonly style="width: 100%; padding: 12px 16px; border: 2px solid transparent; border-radius: 12px; background: rgba(241, 245, 249, 0.6); font-size: 14px; font-weight: 500; color: #64748b; box-sizing: border-box; cursor: default;">
```

Replace with (no interpolation in value):
```js
          <input type="text" id="bookmark-url" readonly style="width: 100%; padding: 12px 16px; border: 2px solid transparent; border-radius: 12px; background: rgba(241, 245, 249, 0.6); font-size: 14px; font-weight: 500; color: #64748b; box-sizing: border-box; cursor: default;">
```

- [ ] **Step 3: Set values via DOM after the innerHTML assignment**

Find the line immediately after the closing backtick of `dialog.innerHTML = \`...\``. There will be existing code there (event listeners or DOM queries). Insert these two lines right after the `dialog.innerHTML = \`...\`` assignment ends:

```js
    shadowRoot.getElementById('bookmark-title').value = currentTab.title || '';
    shadowRoot.getElementById('bookmark-url').value = currentTab.url || '';
```

Note: these elements are inside the shadow DOM — use `shadowRoot.getElementById` not `document.getElementById`. Verify what variable holds the shadow root in this function context (it is typically `shadowRoot` or similar).

Actually the dialogs in this function are appended to `document.body`, NOT to the shadow root. Look at the code around the dialog creation to see how elements are queried after `innerHTML` is set. If it uses `document.getElementById`, then set values like:

```js
    document.getElementById('bookmark-title').value = currentTab.title || '';
    document.getElementById('bookmark-url').value = currentTab.url || '';
```

Read the lines immediately following `dialog.innerHTML = \`...\`` to confirm which getElementById pattern is used, then insert accordingly.

- [ ] **Step 4: Verify Location A**

Confirm `dialog.innerHTML` template no longer contains `${currentTab.title}` or `${currentTab.url}`. Confirm the two `getElementById` value assignments are present after the `innerHTML` assignment. Load the extension, press Cmd+H, and try saving a bookmark — verify the title and URL fields are pre-filled.

---

#### Location B: Folder tree — folder.title in span innerHTML

- [ ] **Step 5: Find the `folderItem.innerHTML` assignment (around line 769)**

```js
      folderItem.innerHTML = `
        ${'<div style="width: 20px; flex-shrink: 0;"></div>'.repeat(folder.level)}
        <span style="margin-right: 8px; font-size: 16px;">📁</span>
        <span>${folder.title}</span>
      `;
```

- [ ] **Step 6: Replace with DOM manipulation**

Replace the entire `folderItem.innerHTML = ...` block with:
```js
      // Level indent spacers
      for (let i = 0; i < folder.level; i++) {
        const spacer = document.createElement('div');
        spacer.style.cssText = 'width: 20px; flex-shrink: 0;';
        folderItem.appendChild(spacer);
      }
      const icon = document.createElement('span');
      icon.style.cssText = 'margin-right: 8px; font-size: 16px;';
      icon.textContent = '📁';
      folderItem.appendChild(icon);
      const label = document.createElement('span');
      label.textContent = folder.title;
      folderItem.appendChild(label);
```

- [ ] **Step 7: Verify Location B**

Confirm `folderItem.innerHTML` is gone. Confirm folder tree still renders correctly when saving a bookmark (folders should appear with correct indentation and titles).

---

#### Location C: New Folder dialog — parentFolderName in text

- [ ] **Step 8: Find the `folderDialog.innerHTML` assignment (around line 957)**

Inside the template, find the "Create Location" section:
```js
          <div style="background: rgba(99, 102, 241, 0.1); color: #6366f1; padding: 12px 16px; border-radius: 10px; font-size: 14px; font-weight: 500; border: 1px solid rgba(99, 102, 241, 0.2);">
            Create under "${parentFolderName}"
          </div>
```

- [ ] **Step 9: Replace the dynamic text with a placeholder id**

In the `folderDialog.innerHTML` template, replace that div with:
```js
          <div id="folder-location-display" style="background: rgba(99, 102, 241, 0.1); color: #6366f1; padding: 12px 16px; border-radius: 10px; font-size: 14px; font-weight: 500; border: 1px solid rgba(99, 102, 241, 0.2);">
          </div>
```

- [ ] **Step 10: Set text content via DOM after the `folderDialog.innerHTML` assignment**

Find the line immediately after the closing backtick of `folderDialog.innerHTML = \`...\``. Insert:
```js
    document.getElementById('folder-location-display').textContent = `Create under "${parentFolderName}"`;
```

- [ ] **Step 11: Verify Location C**

Confirm `folderDialog.innerHTML` template no longer contains `${parentFolderName}`. Confirm the "Create under" text is set via `textContent`. Load extension, press Cmd+H, try to save a bookmark and click "New Folder" — verify the location display shows the correct parent folder name.

- [ ] **Step 12: Commit**

```bash
git add background.js
git commit -m "fix: replace innerHTML template interpolation with textContent for XSS safety in dialogs"
```
