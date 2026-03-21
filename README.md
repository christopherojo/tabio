# tabio

A lightweight Chrome extension for converting browser tabs into clean, shareable text — and restoring them instantly.

---

## Overview

**tabio** enables fast, bidirectional workflows between browsing sessions and text:

- Export all tabs in a window into a structured text format
- Paste text containing links and reopen them as tabs
- Save, name, and restore browsing sessions
- Track usage stats locally with zero data leaving your machine

Designed for speed, simplicity, and minimal friction.

---

## Features

### Export Tabs → Text
- Export tabs from the current window, all windows, or a custom selection
- Five output formats: Plain URLs, Title + URL, Markdown, JSON, Notion
- Cleaning options: deduplicate, strip UTM/tracking params, sort, group by domain
- One-click copy to clipboard or download as `.txt` / `.json`
- Save current tabs directly as a named session

### Import Text → Tabs
- Paste any block of text — URLs, Markdown links, or `Title: URL` format
- Auto-detects and previews all valid URLs before opening
- Select or deselect individual links before opening
- Load from a `.txt` or `.json` file
- Batch opening: open N tabs at a time with optional delay between batches
- Options: open in new window, close existing tabs

### Sessions
- Save and name tab sessions at any time
- Restore sessions into the current window or a new one
- Export any session as `.json` or `.txt`
- Search across saved sessions
- Per-session domain summary and tab count

### Analytics (Local Only)
- Tabs exported and imported over time
- Sessions saved
- Top domains by frequency
- Recent activity feed
- All data stored locally via `chrome.storage` — nothing leaves your machine

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

## Use Cases

- Save and restore research sessions across work sessions
- Share a set of links with a teammate by copying the text output
- Clean up tracked URLs before sharing (strip UTM params)
- Batch-open a large reading list without freezing the browser
- Keep a library of named sessions for recurring workflows

---

## How It Works

### Export Flow
1. Click the extension icon
2. Choose scope: This Window, All Windows, or Pick Tabs
3. Choose a format and any cleaning options
4. Click Generate, then Copy or Save

### Import Flow
1. Paste text (or load a file) into the Import tab
2. Review the detected URLs — deselect any you don't want
3. Set batch size and delay if needed
4. Click Open Tabs

### Sessions Flow
1. Go to the Sessions tab
2. Click "Save current tabs" and give the session a name
3. Restore any session later with one click

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
│   ├── export.css        # Export panel styles
│   ├── import.css        # Import panel styles
│   ├── sessions.css      # Sessions panel styles
│   └── analytics.css     # Stats panel styles
└── js/
    ├── main.js           # Entry point, nav wiring, keyboard shortcuts
    ├── ui.js             # Toast, mode switching, toggle/chip helpers
    ├── tabs.js           # Chrome tabs/windows API wrappers
    ├── storage.js        # chrome.storage.local wrapper
    ├── cleaner.js        # Dedupe, UTM stripping, sort, group by domain
    ├── sessions.js       # Session save, restore, delete, export
    ├── analytics.js      # Local usage stats and rendering
    ├── export.js         # Tabs → text logic, all formats
    └── import.js         # Text → tabs logic, URL parsing, batch open
```

---

## Tech Stack

- Chrome Extensions API (Manifest V3)
- JavaScript (ES6+, no frameworks)
- HTML / CSS (Popup UI)
- `chrome.storage.local` for persistent sessions and stats

---

## Installation (Dev)

1. Clone or download this repo
2. Go to `chrome://extensions`
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked** and select the `tabio` folder
5. Pin the extension to your toolbar

After any code change, hit the **↺ refresh** button on the extension card. If you change `manifest.json`, remove and re-load unpacked.

---

## Incoming Features

### Tab Organization
- Restore tabs into Chrome tab groups
- Collapse/expand groups before export

### Cross-Device Workflow
- Sync sessions via `chrome.storage.sync`
- Shareable session links

### Integrations
- Webhook / API trigger for automation

### Power User
- Command palette
- Right-click context menu support
