import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeEvent() {
  return { addListener() {} };
}

function makeChromeStub() {
  const tabs = {
    query: async () => [],
    update: async () => ({}),
    remove: async () => undefined,
    group: async () => 1,
    get: async () => null,
    create: async () => ({})
  };

  const storageArea = {
    get: async () => ({}),
    set: async () => undefined
  };

  return {
    alarms: {
      onAlarm: makeEvent(),
      clear: async () => undefined,
      create: async () => undefined,
      get: async () => null
    },
    storage: {
      onChanged: makeEvent(),
      local: storageArea,
      session: storageArea
    },
    tabs: {
      ...tabs,
      onCreated: makeEvent(),
      onUpdated: makeEvent(),
      onActivated: makeEvent(),
      onRemoved: makeEvent()
    },
    tabGroups: {
      query: async () => [],
      update: async () => undefined,
      get: async () => ({ collapsed: false })
    },
    bookmarks: {
      getTree: async () => [],
      search: async () => [],
      remove: async () => undefined,
      create: async () => ({})
    },
    runtime: {
      onInstalled: makeEvent(),
      onStartup: makeEvent(),
      onMessage: makeEvent()
    },
    commands: {
      onCommand: makeEvent()
    },
    scripting: {
      executeScript: async () => undefined
    },
    windows: {
      update: async () => undefined
    }
  };
}

function loadHostUtils() {
  const filePath = path.join(repoRoot, 'js/utils/hostUtils.js');
  const source = fs.readFileSync(filePath, 'utf8')
    .replace(/^import .*$/mg, '')
    .replace(/^export /mg, '');

  const context = vm.createContext({
    console,
    URL,
    CONFIG: {
      STORAGE_KEYS: {
        SUPPORTED_HOSTS: 'supportedHosts'
      }
    }
  });

  vm.runInContext(source, context, { filename: 'hostUtils.js' });
  return context;
}

function loadBackground() {
  const filePath = path.join(repoRoot, 'background.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const context = vm.createContext({
    console,
    URL,
    chrome: makeChromeStub(),
    importScripts() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Date,
    Math
  });

  vm.runInContext(source, context, { filename: 'background.js' });
  return context;
}

function loadSearchUiHostHelpers() {
  const filePath = path.join(repoRoot, 'search-ui.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('  function extractHostFromUrl(url) {');
  const end = source.indexOf('  async function groupTabsByHost(tabs) {');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Unable to locate host helper block in search-ui.js');
  }

  const helperSource = source.slice(start, end);
  const context = vm.createContext({
    console,
    URL
  });

  vm.runInContext(`${helperSource}\nthis.__hostHelpers__ = { extractHostFromUrl, hostnameMatches, mapUrlToHost };`, context, {
    filename: 'search-ui.host-helpers.vm'
  });

  return context.__hostHelpers__;
}

function loadSearchUiTeardownHelper() {
  const filePath = path.join(repoRoot, 'search-ui.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('function teardownSearchBox(searchBox) {');
  const end = source.indexOf('// Tab grouper main function - will be injected as content script');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Unable to locate teardown helper in search-ui.js');
  }

  const helperSource = source.slice(start, end);
  const context = vm.createContext({
    document: {
      activeElement: null,
      body: {
        focusCalled: false,
        style: { overflow: 'hidden' },
        focus() { this.focusCalled = true; }
      },
      documentElement: {
        style: { overflow: 'hidden' }
      }
    }
  });

  vm.runInContext(`${helperSource}\nthis.__teardownSearchBox__ = teardownSearchBox;`, context, {
    filename: 'search-ui.teardown-helper.vm'
  });

  return context.__teardownSearchBox__;
}

const hostUtils = loadHostUtils();
const background = loadBackground();
const searchUiHostHelpers = loadSearchUiHostHelpers();
const teardownSearchBox = loadSearchUiTeardownHelper();

assert.equal(
  hostUtils.mapUrlToHost('https://example.com/?next=github.com', { 'github.com': 'GitHub' }),
  'example'
);

assert.equal(
  hostUtils.mapUrlToHost('https://docs.github.com/en', { 'github.com': 'GitHub' }),
  'GitHub'
);

assert.equal(
  background.mapUrlToHost('https://example.com/?next=github.com', { 'github.com': 'GitHub' }),
  'example'
);

assert.equal(
  background.mapUrlToHost('https://docs.github.com/en', { 'github.com': 'GitHub' }),
  'GitHub'
);

assert.equal(
  searchUiHostHelpers.mapUrlToHost('https://example.com/?next=github.com', { 'github.com': 'GitHub' }),
  'example'
);

assert.equal(
  searchUiHostHelpers.mapUrlToHost('https://docs.github.com/en', { 'github.com': 'GitHub' }),
  'GitHub'
);

assert.deepEqual(
  JSON.parse(JSON.stringify(background.findExistingGroupInWindow(
    [
      { id: 11, title: 'GitHub', windowId: 100 },
      { id: 22, title: 'GitHub', windowId: 200 }
    ],
    'GitHub',
    200
  ))),
  { id: 22, title: 'GitHub', windowId: 200 }
);

assert.equal(
  background.findExistingGroupInWindow(
    [
      { id: 11, title: 'GitHub', windowId: 100 }
    ],
    'GitHub',
    200
  ),
  null
);

assert.deepEqual(
  JSON.parse(JSON.stringify(background.groupTabsByWindowAndHost([
    { id: 1, url: 'https://github.com/a', windowId: 10 },
    { id: 2, url: 'https://github.com/b', windowId: 20 }
  ], {}))),
  {
    '10::github': [{ id: 1, url: 'https://github.com/a', windowId: 10 }],
    '20::github': [{ id: 2, url: 'https://github.com/b', windowId: 20 }]
  }
);

{
  const activeElement = {
    blurred: false,
    blur() { this.blurred = true; }
  };
  const removedBox = {
    cleanupCalled: false,
    removed: false,
    contains(node) {
      return node === activeElement;
    },
    _cleanup() {
      this.cleanupCalled = true;
    },
    remove() {
      this.removed = true;
    }
  };

  const teardownDocument = {
    activeElement,
    body: {
      focusCalled: false,
      style: { overflow: 'hidden' },
      focus() { this.focusCalled = true; }
    },
    documentElement: {
      style: { overflow: 'hidden' }
    }
  };

  const teardownContext = vm.createContext({ document: teardownDocument });
  const teardown = vm.runInContext(`(${teardownSearchBox.toString()})`, teardownContext);
  teardown(removedBox);

  assert.equal(activeElement.blurred, true);
  assert.equal(removedBox.cleanupCalled, true);
  assert.equal(removedBox.removed, true);
  assert.equal(teardownDocument.body.focusCalled, true);
  assert.equal(teardownDocument.body.style.overflow, '');
  assert.equal(teardownDocument.documentElement.style.overflow, '');
}

console.log('background grouping regressions passed');
