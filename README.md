# Mirror Universe Tabs

A Chrome extension that draws a goatee on every tab icon in a tab group whose name includes **Mirror** or **Evil**.

In the Star Trek mirror universe, people are evil and have goatees. Now your tabs can be too.

## Install (Load unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this repository folder

After pulling code changes, click **Reload** on the extension card, then click the toolbar icon (or reload the tabs) so goatees re-apply.

## Usage

1. Group some tabs (right-click a tab → **Add tab to group**)
2. Name the group something with the word **Mirror** or **Evil**  
   Examples: `Mirror`, `Evil`, `Evil reading`, `Mirror Universe`
3. Favicons in that group get a moustache + beard overlay (site icon stays underneath)
4. Click the extension toolbar icon to force a re-apply on already-open tabs (needed after updating the extension)
5. Rename the group (or move tabs out) to remove the beards

Matching is case-insensitive and uses whole words (`mirror` / `evil`), so titles like `The Mirror Universe` work.

### If nothing changes

1. Reload the extension on `chrome://extensions`
2. Click the Mirror Universe Tabs toolbar icon
3. Reload a tab inside the Evil/Mirror group
4. Open the extension’s service worker **Inspect views** console and look for `Mirror Universe Tabs:` logs
5. Internal pages (`chrome://`, Chrome Web Store, etc.) cannot get custom favicons

## How it works

Chrome has no API to set a tab’s icon directly. This extension:

1. Watches tab groups via the `tabGroups` API
2. Fetches each page’s favicon
3. Composites a goatee onto it
4. Injects a content script that sets the page’s `<link rel="icon">` (and keeps it applied if the site tries to reset it)

## Limits

- Only works on normal `http://` and `https://` pages where script injection is allowed
- Internal pages (`chrome://`, the Chrome Web Store, etc.) cannot be modified
- Some sites fight favicon changes; a MutationObserver covers common cases, but not every site

## Permissions

- **tabGroups** / **tabs** — detect which tabs belong to Mirror/Evil groups
- **scripting** — inject the favicon override
- **favicon** — read page favicons via Chrome’s favicon API
- **Host access** — required to update icons on web pages
