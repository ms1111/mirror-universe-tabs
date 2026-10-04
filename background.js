import { drawGoatee } from "./goatee.js";

const MIRROR_TITLE = /\b(mirror|evil)\b/i;
const SIZE = 32;

/** @type {Map<number, { applied: boolean, originalHref: string | null, pageUrl: string | null, href: string | null }>} */
const tabState = new Map();

function isMirrorTitle(title) {
  return typeof title === "string" && MIRROR_TITLE.test(title);
}

function canInject(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.hostname === "chrome.google.com" && parsed.pathname.startsWith("/webstore")) {
      return false;
    }
    if (parsed.hostname === "chromewebstore.google.com") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function faviconUrlForPage(pageUrl) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(SIZE));
  return url.toString();
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

async function loadFaviconBitmap(pageUrl, favIconUrl) {
  const candidates = [faviconUrlForPage(pageUrl)];
  if (favIconUrl && !favIconUrl.startsWith("data:")) {
    candidates.push(favIconUrl);
  }

  let lastError;
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`Favicon fetch failed: ${response.status}`);
        continue;
      }
      return createImageBitmap(await response.blob());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Favicon fetch failed");
}

async function compositeGoatee(pageUrl, favIconUrl) {
  const bitmap = await loadFaviconBitmap(pageUrl, favIconUrl);
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  bitmap.close();
  drawGoatee(ctx, SIZE);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(blob);
}

/** Runs in the page — works on already-open tabs without a reload. */
function applyFaviconInPage(href) {
  const ATTR = "data-mirror-universe-goatee";
  const head = document.head || document.documentElement;
  for (const link of [...head.querySelectorAll('link[rel*="icon"]')]) {
    link.remove();
  }
  for (const rel of ["icon", "shortcut icon"]) {
    const link = document.createElement("link");
    link.rel = rel;
    link.type = "image/png";
    link.setAttribute(ATTR, "1");
    link.href = href;
    head.appendChild(link);
  }
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
    injectImmediately: true,
  });
}

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await ensureContentScript(tabId);
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function isMirrorTab(tab) {
  if (!tab || tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
    return false;
  }
  try {
    const group = await chrome.tabGroups.get(tab.groupId);
    return isMirrorTitle(group.title);
  } catch {
    return false;
  }
}

async function applyGoateeToTab(tab, { force = false } = {}) {
  if (!tab?.id || !canInject(tab.url)) {
    return;
  }

  const state = tabState.get(tab.id) || {
    applied: false,
    originalHref: null,
    pageUrl: null,
    href: null,
  };

  // Avoid a loop: our data-URL favicon also fires tabs.onUpdated.
  // Toolbar-icon clicks pass force:true to re-apply after beard changes.
  if (
    !force &&
    state.applied &&
    state.pageUrl === tab.url &&
    state.href &&
    tab.favIconUrl &&
    tab.favIconUrl.startsWith("data:")
  ) {
    return;
  }

  if (!state.originalHref || state.pageUrl !== tab.url) {
    const candidate = tab.favIconUrl;
    state.originalHref =
      candidate && !candidate.startsWith("data:")
        ? candidate
        : faviconUrlForPage(tab.url);
  }

  try {
    // Always composite from the page favicon API, not our own data: icon.
    const href = await compositeGoatee(tab.url, state.originalHref);

    // Direct injection updates the tab strip without needing a page reload.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyFaviconInPage,
      args: [href],
      injectImmediately: true,
    });

    // Keep a watcher around so SPAs that reset their icon don't undo us.
    await sendToTab(tab.id, { type: "applyGoatee", href }).catch(() => {});

    state.applied = true;
    state.pageUrl = tab.url;
    state.href = href;
    tabState.set(tab.id, state);
    console.info("Mirror Universe Tabs: applied beard", tab.id, tab.url);
  } catch (error) {
    console.warn("Mirror Universe Tabs: apply failed", tab.id, tab.url, error);
  }
}

async function restoreTab(tab) {
  if (!tab?.id) return;

  const state = tabState.get(tab.id);
  if (!state?.applied) {
    tabState.delete(tab.id);
    return;
  }

  if (canInject(tab.url)) {
    try {
      await sendToTab(tab.id, {
        type: "restoreFavicon",
        originalHref: state.originalHref,
      });
    } catch (error) {
      console.warn("Mirror Universe Tabs: restore failed", tab.id, error);
    }
  }

  tabState.delete(tab.id);
}

async function syncTab(tab, options = {}) {
  if (!tab?.id) return;

  const mirror = await isMirrorTab(tab);
  if (mirror) {
    await applyGoateeToTab(tab, options);
  } else {
    await restoreTab(tab);
  }
}

async function syncTabId(tabId, options = {}) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await syncTab(tab, options);
  } catch {
    tabState.delete(tabId);
  }
}

async function syncGroup(groupId, options = {}) {
  if (groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return;
  const tabs = await chrome.tabs.query({ groupId });
  for (const tab of tabs) {
    await syncTab(tab, options);
  }
}

async function syncAll(options = {}) {
  const groups = await chrome.tabGroups.query({});
  const mirrorGroups = groups.filter((group) => isMirrorTitle(group.title));
  console.info(
    "Mirror Universe Tabs: syncAll",
    { force: Boolean(options.force) },
    mirrorGroups.map((group) => group.title)
  );

  for (const group of mirrorGroups) {
    await syncGroup(group.id, options);
  }

  for (const tabId of [...tabState.keys()]) {
    await syncTabId(tabId, options);
  }
}

chrome.runtime.onInstalled.addListener(() => syncAll({ force: true }));
chrome.runtime.onStartup.addListener(() => syncAll({ force: true }));

chrome.action.onClicked.addListener(async () => {
  console.info("Mirror Universe Tabs: toolbar click — forcing re-apply");
  await syncAll({ force: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "contentReady") {
    return;
  }

  const tabId = sender.tab?.id;
  if (!tabId) {
    sendResponse({});
    return;
  }

  const state = tabState.get(tabId);
  if (state?.applied && state.href) {
    sendResponse({ href: state.href });
    return;
  }

  (async () => {
    const tab = await chrome.tabs.get(tabId);
    if (await isMirrorTab(tab)) {
      await applyGoateeToTab(tab);
      sendResponse({ href: tabState.get(tabId)?.href || null });
    } else {
      sendResponse({});
    }
  })().catch(() => sendResponse({}));

  return true;
});

chrome.tabGroups.onCreated.addListener((group) => {
  if (isMirrorTitle(group.title)) {
    return syncGroup(group.id);
  }
});

chrome.tabGroups.onUpdated.addListener((group) => syncGroup(group.id));

chrome.tabGroups.onRemoved.addListener(() => {
  return Promise.all([...tabState.keys()].map((tabId) => syncTabId(tabId)));
});

chrome.tabs.onCreated.addListener((tab) => syncTab(tab));

chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (
    changeInfo.groupId !== undefined ||
    changeInfo.status === "complete" ||
    changeInfo.favIconUrl !== undefined ||
    changeInfo.url !== undefined
  ) {
    return syncTabId(tabId);
  }
});

void syncAll();
