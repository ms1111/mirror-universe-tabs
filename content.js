(() => {
  const ATTR = "data-mirror-universe-goatee";

  if (window.__mirrorUniverseTabsApi) {
    return;
  }

  let desiredHref = null;
  let observer = null;
  let applying = false;

  function setIconHref(href) {
    applying = true;
    try {
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
    } finally {
      setTimeout(() => {
        applying = false;
      }, 0);
    }
  }

  function applyHref(href) {
    desiredHref = href;
    ensureObserver();
    setIconHref(href);
    return { ok: true };
  }

  function restoreFavicon(originalHref) {
    desiredHref = null;
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    applying = true;
    try {
      for (const link of document.querySelectorAll(`link[${ATTR}]`)) {
        link.remove();
      }
      if (originalHref) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = originalHref;
        (document.head || document.documentElement).appendChild(link);
      }
    } finally {
      setTimeout(() => {
        applying = false;
      }, 0);
    }

    return { ok: true };
  }

  function ensureObserver() {
    if (observer) return;
    const root = document.head || document.documentElement;
    observer = new MutationObserver(() => {
      if (applying || !desiredHref) return;
      const current = document.querySelector(`link[${ATTR}]`);
      if (!current || current.getAttribute("href") !== desiredHref) {
        setIconHref(desiredHref);
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "rel"],
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "applyGoatee" && message.href) {
      sendResponse(applyHref(message.href));
      return;
    }

    if (message?.type === "restoreFavicon") {
      sendResponse(restoreFavicon(message.originalHref || null));
    }
  });

  chrome.runtime.sendMessage({ type: "contentReady" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.href) {
      applyHref(response.href);
    }
  });

  window.__mirrorUniverseTabsApi = { applyHref, restoreFavicon };
})();
