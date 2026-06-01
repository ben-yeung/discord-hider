import type { ElementKey, ToolbarItemKey } from "../shared/types";

export const ELEMENT_KEYS: readonly ElementKey[] = ["serverList", "channelColumn", "topToolbar", "chatBar"];

export const DEFAULT_SELECTORS: Record<ElementKey, string> = {
  serverList: 'nav[aria-label="Servers sidebar"]',
  channelColumn: 'div[class*="sidebarList"]',
  topToolbar: 'div[data-window-chrome="true"]',
  chatBar: 'div[class*="channelTextArea"]',
};

export const LABELS: Record<ElementKey, string> = {
  serverList: "Server List",
  channelColumn: "Channel Column",
  topToolbar: "Top Toolbar",
  chatBar: "Chat Bar",
};

export const TOOLBAR_ITEM_KEYS: readonly ToolbarItemKey[] = [
  'threads', 'notificationSettings', 'pinnedMessages', 'memberList', 'searchBar',
];

export const TOOLBAR_ITEM_LABELS: Record<ToolbarItemKey, string> = {
  threads: 'Threads',
  notificationSettings: 'Notification Settings',
  pinnedMessages: 'Pinned Messages',
  memberList: 'Member List',
  searchBar: 'Search Bar',
};

// CSS selector used to hide each item when it is not surviving
export const TOOLBAR_ITEM_SELECTORS: Record<ToolbarItemKey, string> = {
  threads: '[aria-label="Threads"]',
  notificationSettings: '[aria-label="Notification Settings"]',
  pinnedMessages: '[aria-label="Pinned Messages"]',
  memberList: '[aria-label="Show Member List"]',
  searchBar: 'div[data-window-chrome="true"] div[class*="search__"]',
};
