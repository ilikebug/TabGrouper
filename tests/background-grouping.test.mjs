import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeEvent() {
  const listeners = [];
  return {
    addListener(listener) {
      listeners.push(listener);
    },
    async emit(...args) {
      await Promise.all(listeners.map(listener => listener(...args)));
    }
  };
}

function makeStorageArea(initialData = {}, onChangedEvent = null, areaName = 'local') {
  const data = { ...initialData };
  const setCalls = [];
  const getCalls = [];

  return {
    data,
    setCalls,
    getCalls,
    async get(key) {
      getCalls.push(key);
      if (Array.isArray(key)) {
        return Object.fromEntries(key.map(k => [k, data[k]]));
      }
      if (typeof key === 'string') {
        return { [key]: data[key] };
      }
      if (key && typeof key === 'object') {
        return Object.fromEntries(Object.keys(key).map(k => [k, data[k] ?? key[k]]));
      }
      return { ...data };
    },
    async set(values) {
      setCalls.push(values);
      const changes = {};
      for (const [key, value] of Object.entries(values)) {
        changes[key] = { oldValue: data[key], newValue: value };
        data[key] = value;
      }
      if (onChangedEvent) {
        await onChangedEvent.emit(changes, areaName);
      }
    }
  };
}

function makeChromeStub(initialStorage = {}) {
  const tabs = {
    query: async () => [],
    update: async () => ({}),
    remove: async () => undefined,
    group: async () => 1,
    get: async () => null,
    create: async () => ({})
  };

  const storageOnChanged = makeEvent();
  const localStorage = makeStorageArea(initialStorage.local, storageOnChanged, 'local');
  const sessionStorage = makeStorageArea(initialStorage.session, storageOnChanged, 'session');

  return {
    alarms: {
      onAlarm: makeEvent(),
      clear: async () => undefined,
      create: async () => undefined,
      get: async () => null
    },
    storage: {
      onChanged: storageOnChanged,
      local: localStorage,
      session: sessionStorage
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

function loadBackground(initialStorage = {}) {
  const filePath = path.join(repoRoot, 'background.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const context = vm.createContext({
    console,
    URL,
    chrome: makeChromeStub(initialStorage),
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

function loadSearchUiRenderHelpers() {
  const filePath = path.join(repoRoot, 'search-ui.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('function limitGroupedTabsForRender(groupedTabs, maxTabs) {');
  const end = source.indexOf('// Tab grouper main function - will be injected as content script');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Unable to locate render helper in search-ui.js');
  }

  const helperSource = source.slice(start, end);
  const context = vm.createContext({});

  vm.runInContext(`${helperSource}\nthis.__renderHelpers__ = { limitGroupedTabsForRender };`, context, {
    filename: 'search-ui.render-helpers.vm'
  });

  return context.__renderHelpers__;
}

function loadPopupManager() {
  const filePath = path.join(repoRoot, 'js/modules/popupManager.js');
  const source = fs.readFileSync(filePath, 'utf8')
    .replace(/^import .*$/mg, '')
    .replace(/^export /mg, '');

  const context = vm.createContext({
    console,
    setTimeout,
    document: {
      getElementById: () => null
    },
    chrome: {
      runtime: {
        sendMessage: async () => undefined
      },
      commands: {
        getAll: async () => []
      }
    },
    CONFIG: {
      CSS_CLASSES: {},
      DEFAULT_ICONS: {},
      UI: {
        MESSAGE_HIDE_DELAY: 0
      }
    },
    ACTIONS: {},
    getSupportedHosts: async () => ({}),
    saveSupportedHosts: async () => undefined
  });

  vm.runInContext(`${source}\nthis.PopupManager = PopupManager;`, context, { filename: 'popupManager.js' });
  return context.PopupManager;
}

const hostUtils = loadHostUtils();
const background = loadBackground();
const searchUiHostHelpers = loadSearchUiHostHelpers();
const teardownSearchBox = loadSearchUiTeardownHelper();
const searchUiRenderHelpers = loadSearchUiRenderHelpers();
const PopupManager = loadPopupManager();

assert.equal(
  PopupManager.prototype.normalizeHost('https://example.com/docs/api?tab=1'),
  'https://example.com/docs/api?tab=1'
);

assert.equal(
  PopupManager.prototype.normalizeHost('  example.com/docs/api  '),
  'example.com/docs/api'
);

assert.equal(
  hostUtils.mapUrlToHost('https://example.com/?next=github.com', { 'github.com': 'GitHub' }),
  'example'
);

assert.equal(
  hostUtils.mapUrlToHost('https://docs.github.com/en', { 'github.com': 'GitHub' }),
  'GitHub'
);

assert.equal(
  hostUtils.mapUrlToHost('https://example.com/docs/page', {
    'example.com': 'Example',
    'example.com/docs': 'Docs'
  }),
  'Docs'
);

assert.equal(
  hostUtils.mapUrlToHost('https://example.com/docs2/page', { 'example.com/docs': 'Docs' }),
  'example'
);

assert.equal(
  hostUtils.mapUrlToHost('https://example.com/app/page', {
    'https://example.com/docs': 'Docs',
    'https://example.com/app': 'App'
  }),
  'App'
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
  background.mapUrlToHost('https://example.com/docs/page', {
    'example.com': 'Example',
    'example.com/docs': 'Docs'
  }),
  'Docs'
);

assert.equal(
  background.mapUrlToHost('https://example.com/docs2/page', { 'example.com/docs': 'Docs' }),
  'example'
);

assert.equal(
  background.mapUrlToHost('https://example.com/app/page', {
    'https://example.com/docs': 'Docs',
    'https://example.com/app': 'App'
  }),
  'App'
);

assert.equal(
  searchUiHostHelpers.mapUrlToHost('https://example.com/?next=github.com', { 'github.com': 'GitHub' }),
  'example'
);

assert.equal(
  searchUiHostHelpers.mapUrlToHost('https://docs.github.com/en', { 'github.com': 'GitHub' }),
  'GitHub'
);

assert.equal(
  searchUiHostHelpers.mapUrlToHost('https://example.com/docs/page', {
    'example.com': 'Example',
    'example.com/docs': 'Docs'
  }),
  'Docs'
);

assert.equal(
  searchUiHostHelpers.mapUrlToHost('https://example.com/docs2/page', { 'example.com/docs': 'Docs' }),
  'example'
);

assert.equal(
  searchUiHostHelpers.mapUrlToHost('https://example.com/app/page', {
    'https://example.com/docs': 'Docs',
    'https://example.com/app': 'App'
  }),
  'App'
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

assert.deepEqual(
  JSON.parse(JSON.stringify(searchUiRenderHelpers.limitGroupedTabsForRender({
    alpha: [{ id: 1 }, { id: 2 }],
    beta: [{ id: 3 }, { id: 4 }],
    gamma: [{ id: 5 }]
  }, 3))),
  {
    groupedTabs: {
      alpha: [{ id: 1 }, { id: 2 }],
      beta: [{ id: 3 }]
    },
    renderedTabs: 3,
    totalTabs: 5,
    truncated: true
  }
);

function makeRecentTab(index, timestamp = Date.now()) {
  return {
    id: index,
    title: `Tab ${index}`,
    url: `https://example.com/page/${index}`,
    favicon: `https://example.com/favicon-${index}.ico`,
    timestamp
  };
}

{
  const manyRecentTabs = Array.from({ length: 250 }, (_, index) => makeRecentTab(index));
  const context = loadBackground({
    local: {
      recentTabs: manyRecentTabs
    }
  });

  await context.addToRecentTabs({
    id: 999,
    title: 'Newest',
    url: 'https://new.example.com/',
    favIconUrl: 'https://new.example.com/favicon.ico'
  });

  assert.equal(context.chrome.storage.local.data.recentTabs.length, 200);
  assert.equal(context.chrome.storage.local.data.recentTabs[0].url, 'https://new.example.com/');
}

{
  const now = Date.now();
  const context = loadBackground({
    local: {
      recentTabs: [
        {
          id: 1,
          title: 'Existing',
          url: 'https://same.example.com/',
          favicon: 'https://same.example.com/favicon.ico',
          timestamp: now
        }
      ]
    }
  });

  await context.addToRecentTabs({
    id: 1,
    title: 'Existing',
    url: 'https://same.example.com/',
    favIconUrl: 'https://same.example.com/favicon.ico'
  });

  const recentTabWrites = context.chrome.storage.local.setCalls
    .filter(call => Object.prototype.hasOwnProperty.call(call, 'recentTabs'));
  assert.equal(recentTabWrites.length, 0);
}

{
  const context = loadBackground();

  await Promise.all([
    context.updateTabActivity(1, 1000),
    context.updateTabActivity(2, 1000),
    context.updateTabActivity(3, 1000)
  ]);

  const activityWrites = context.chrome.storage.local.setCalls
    .filter(call => Object.prototype.hasOwnProperty.call(call, 'tabActivity'));
  assert.equal(activityWrites.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(context.chrome.storage.local.data.tabActivity)), {
    1: 1000,
    2: 1000,
    3: 1000
  });
}

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
