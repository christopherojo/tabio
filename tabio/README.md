# tabio

A lightweight Chrome extension for converting browser tabs into clean, shareable text — and restoring them instantly.

---

## Overview

**tabio** enables fast, bidirectional workflows between browsing sessions and text:

- Export tabs from a window, tab groups, or across multiple windows
- Paste text containing links and reopen them as tabs
- Save, name, and restore browsing sessions
- Clean URLs before exporting (dedupe, strip tracking, sort, group)
- Track usage stats locally — nothing leaves your machine

---

## Features

### Export Tabs → Text

**Scope options:**
- **This Window** — all tabs in your current window
- **All Windows** — every open tab across all windows (flat list)
- **Tab Groups** — pick specific Chrome tab groups; each exports with its group name and colour as a header
- **By Window** — exports each window as a labelled section, with tab groups nested inside
- **Pick Tabs** — manually check individual tabs to include

**Output formats:**
- **URLs** — plain `https://…` one per line
- **Markdown** — `[Title](URL)`
- **Title+URL** — `Title: URL`
- **JSON** — `[{ "title": "…", "url": "…" }]`
- **Notion** — `- [Title](URL)` bullet list, pastes directly into Notion as linked list items

**Cleaning (applied per section):**
- **Dedupe** — removes duplicate URLs before output
- **Strip UTM** — removes tracking parameters (`utm_source`, `fbclid`, `gclid`, etc.)
- **Sort** — sorts URLs alphabetically within each section
- **Group** — groups URLs by domain within each section (adds domain subheaders)

Cleaning options combine freely and work correctly inside tab group and window scopes — each section is cleaned independently.

**Output actions:**
- Copy to clipboard
- Download as `.txt`, `.md`, or `.json`
- Save directly as a named session

### Import Text → Tabs

- Paste any text — plain URLs, Markdown, Notion list, `Title: URL`, or JSON
- Supports structured Tabio export text (window headers and group headers are ignored, URLs are extracted)
- Load from a `.txt`, `.json`, or `.md` file
- Live URL detection preview with individual URL select/deselect
- Options: open in new window, close existing tabs
- Batch opening: set how many tabs open at a time, with optional delay between batches

### Sessions

- Save and name tab sessions at any time (from Export panel or Sessions tab)
- Restore into current window or a new window
- Export any session as `.json` or `.txt`
- Search saved sessions
- Per-session domain summary and tab count

### Analytics (Local Only)

- Tabs exported and imported
- Sessions saved
- Unique domains seen
- Top domains by frequency with bar chart
- Recent activity feed
- All data in `chrome.storage.local` — never leaves your machine

---

## Output Format Examples

### Tab Groups scope (URLs format)
```
[BLUE] Research (3 tabs)
https://example.com/article-1
https://example.com/article-2
https://wikipedia.org/wiki/Topic

[RED] Shopping (2 tabs)
https://amazon.com/item
https://shop.example.com/product
```

### By Window scope (Markdown format)
```
── Window 1 (current) · 5 tabs ──
[BLUE] Research (2 tabs)
[Research Article](https://example.com/article)
[Wikipedia](https://wikipedia.org/wiki/Topic)

── Ungrouped ──
[Google](https://google.com)

── Window 2 · 3 tabs ──
[Work Dashboard](https://dashboard.example.com)
[Jira](https://company.atlassian.net)
```

### This Window + Group clean option
```
── example.com (2) ──
https://example.com/page-1
https://example.com/page-2

── github.com (1) ──
https://github.com/user/repo
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+E` | Go to Export |
| `Alt+I` | Go to Import |
| `Alt+S` | Go to Sessions |
| `Alt+A` | Go to Analytics |
| `Alt+G` | Generate output (Export panel) |
| `Alt+C` | Copy to clipboard (Export panel) |
| `Alt+O` | Open tabs (Import panel) |

---

## File Structure

```
tabio/
├── manifest.json
├── popup.html
├── css/
│   ├── base.css          # Design tokens, reset, typography
│   ├── layout.css        # Header, nav, panel shells
│   ├── components.css    # Buttons, chips, toggles, toast, modal
│   ├── export.css        # Export panel + scope pickers
│   ├── import.css        # Import panel styles
│   ├── sessions.css      # Sessions panel styles
│   └── analytics.css     # Stats panel styles
└── js/
    ├── main.js           # Entry point, nav wiring, keyboard shortcuts
    ├── ui.js             # Toast, mode switching, toggle/chip helpers
    ├── tabs.js           # Chrome tabs/windows/tabGroups API wrappers
    ├── storage.js        # chrome.storage.local wrapper
    ├── cleaner.js        # Dedupe, UTM stripping, sort, group by domain
    ├── sessions.js       # Session save, restore, delete, export
    ├── analytics.js      # Local usage stats and rendering
    ├── export.js         # All export logic: scopes, formats, output building
    └── import.js         # URL parsing, preview, batch tab opening
```

---

## Tech Stack

- Chrome Extensions API (Manifest V3)
- JavaScript (ES6+, no frameworks)
- HTML / CSS
- `chrome.storage.local` for sessions and stats
- `chrome.tabGroups` API for tab group awareness

---

## Installation (Dev)

1. Clone or download this repo
2. Go to `chrome://extensions`
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked** → select the `tabio` folder
5. Pin the extension to your toolbar

**After code changes:** hit **↺ refresh** on the extension card.  
**After `manifest.json` changes:** remove and re-load unpacked (needed once for v3 — `tabGroups` permission was added).

---

## Incoming Features

### Tab Organization
- Restore sessions into Chrome tab groups (recreate group structure on import)
- Collapse/expand groups before export

### Cross-Device
- Sync sessions via `chrome.storage.sync`
- Shareable session links

### Integrations
- Webhook / API trigger for automation
