## tabio

A lightweight Chrome extension for converting browser tabs into clean, shareable text—and restoring them instantly.

---

## Overview

**tabio** enables fast, bidirectional workflows between browsing sessions and text:

- Export all tabs in a window into a structured text format  
- Paste text containing links and reopen them as tabs  
- Quickly save, share, and restore research sessions  

Designed for speed, simplicity, and minimal friction.

---

## Features

### Export Tabs → Text
- Extract all URLs from the current window  
- Optional formats:
  - Plain URLs  
  - `Title - URL`  
  - Markdown `[Title](URL)`  
- One-click copy to clipboard  

### Import Text → Tabs
- Paste any block of text  
- Automatically detect valid URLs  
- Open all links in the current window  

---

## Use Cases

- Save research sessions for later  
- Share tab collections with others  
- Move links between devices  
- Organize workflows into reusable link sets  

---

## How It Works

### Export Flow
1. Click the extension icon  
2. Select “Export Tabs”  
3. Copy generated text  

### Import Flow
1. Paste text into the input box  
2. Click “Open Tabs”  
3. All detected links open in your browser  

---

## Tech Stack

- Chrome Extensions API (Manifest V3)  
- JavaScript (ES6+)  
- HTML/CSS (Popup UI)  

---

## Incoming Features

tabio is actively being developed. Planned and potential features include:

### Session Management
- Save and name tab sessions  
- Reopen saved sessions later  
- Auto-save last session on browser close  

### Smart Formatting
- Export as JSON (structured data)  
- Custom templates (user-defined formats)  
- Copy as rich text (for Notion, Slack, etc.)  

### Deduplication & Cleaning
- Remove duplicate URLs automatically  
- Normalize tracking parameters (e.g., remove `?utm=`)  
- Sort and group links  

### Tab Organization
- Group tabs by domain  
- Restore tabs into groups  
- Collapse/expand groups before export  

### Controlled Tab Opening
- Batch open tabs (e.g., 5 at a time)  
- Delay between tab opens  
- Limit max tabs per import  

### Preview Before Opening
- Show parsed links before opening  
- Allow selecting/deselecting links  
- Highlight invalid URLs  

### Cross-Device Workflow
- Sync sessions using browser storage  
- Export/import via file (`.txt` / `.json`)  
- Shareable session links  

### Integrations
- Copy directly to Notion-friendly format  
- Export to Google Docs / Markdown editors  
- Webhook/API for automation  

### Power User Features
- Keyboard shortcuts (export/import instantly)  
- Command palette (quick actions)  
- Right-click context menu support  

### Analytics (Local Only)
- Count tabs exported/imported  
- Track most frequent domains  
- Session stats (purely local, no external storage)  

---