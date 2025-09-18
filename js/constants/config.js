// Configuration constants
export const CONFIG = {
  UI: {
    SEARCH_BOX_ID: 'tab-grouper',
    MIN_WIDTH: 600,
    MIN_HEIGHT: 400,
    WIDTH_PERCENTAGE: 40,
    HEIGHT_PERCENTAGE: 50,
    INPUT_FOCUS_DELAY: 0,
    MESSAGE_HIDE_DELAY: 2000
  },
  
  ICONS: [
    "🌟", "🚀", "📚", "🎨", "🎵", "📷", "💼", "🔧", "🔍", "🍀",
    "🔥", "🌈", "⚡", "🌍", "🌙", "☀️", "🌊", "🍎", "🍔", "🎁",
    "🎉", "🎈", "🎯", "🏆", "🏠", "🚗", "✈️", "🛒", "💡"
  ],
  
  STORAGE_KEYS: {
    SUPPORTED_HOSTS: 'supportedHosts',
    AUTO_COLLAPSE_SETTINGS: 'autoCollapseSettings',
    TAB_ACTIVITY: 'tabActivity'
  },
  
  AUTO_COLLAPSE: {
    DEFAULT_ENABLED: false,
    DEFAULT_TIMEOUT_MINUTES: 5,
    MIN_TIMEOUT_MINUTES: 1,
    MAX_TIMEOUT_MINUTES: 60
  },
  
  DEFAULT_ICONS: {
    FOLDER: '📂',
    BOOKMARK: '⭐️',
    SEARCH: '🔍',
    DELETE: '✖'
  },
  
  CSS_CLASSES: {
    CATEGORY: 'category',
    TEXT_SPAN: 'text-span',
    HOST_SPAN: 'host-span',
    NAME_SPAN: 'name-span',
    SEPARATOR: 'separator',
    DELETE_BUTTON: 'delete-button'
  }
};

export const COMMANDS = {
  OPEN_SEARCH_BOX: 'open-search-box'
};

export const ACTIONS = {
  ACTIVATE_TAB: 'activateTab',
  REMOVE_TAB: 'removeTab',
  REFRESH_GROUPED_TABS: 'refreshGroupedTabs',
  SEARCH: 'search',
  GET_AUTO_COLLAPSE_SETTINGS: 'getAutoCollapseSettings',
  UPDATE_AUTO_COLLAPSE_SETTINGS: 'updateAutoCollapseSettings'
};