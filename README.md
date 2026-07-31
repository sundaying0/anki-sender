[中文](README_CN.md)

# Anki Sender

Send selected text from Obsidian to Anki with one click. Supports single and batch sending, automatic word-root tagging, and pronunciation audio.

## Features

- **Single send**: Select text → right-click → "Send to Anki" (or `Ctrl+Shift+A`)
- **Batch send**: Open a structured vocabulary note → `Ctrl+Shift+B` → select entries → send all at once
- **Auto word-root detection**: Extracts etymology roots from word construction lines, fills Anki tags automatically
- **Pronunciation audio** (optional): Fetches pronunciation from Merriam-Webster API, stores in Anki, renders play buttons
- **Markdown → HTML conversion**: Bold, italic, highlight, tables, lists, wikilinks, and more
- **Auto deck creation**: Creates the target deck if it doesn't exist
- **Duplicate prevention**: Won't add the same card twice

## Requirements

1. **Anki** desktop app running
2. **AnkiConnect** plugin installed in Anki (code: `2055492159`)
3. **Obsidian** desktop (v0.15.0+)

### Installing AnkiConnect

1. Open Anki → Tools → Add-ons → Get Add-ons
2. Enter code: `2055492159`
3. Restart Anki

## Installation

### From Obsidian Community Plugins (recommended)

1. Open Obsidian → Settings → Community plugins → Browse
2. Search for "Anki Sender"
3. Install → Enable

### Manual installation via BRAT

1. Install the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat)
2. BRAT → Add Beta plugin → Enter GitHub URL: `https://github.com/YOUR_USERNAME/anki-sender`

## Usage

### Single send

```
Select text in editor → Right-click → "Send to Anki"
    ↓
Confirm popup: word-root tags (auto-filled) + source (auto-filled)
    ↓
Click "Send" → See "✅ Sent to [Deck Name]"
    ↓
Switch to Anki → Browse cards, or select keywords → Ctrl+U (underline) for active recall
```

### Batch send

```
Open a note with ### N. formatted entries → Press Ctrl+Shift+B
    ↓
Popup lists all entries with checkboxes (default: all selected)
    ↓
Click "Send N entries" → Progress indicator "⏳ Sending 3/27"
    ↓
Done → "✅ Batch complete: 25 sent, 2 duplicates skipped"
```

## Configuration

Settings → Community plugins → Anki Sender → Gear icon

| Setting | Default | Description |
|---------|---------|-------------|
| Deck name | `新思维词汇` | Target Anki deck |
| Model type | `XXHK - 划线` | Anki note template |
| Global tags | (empty) | Tags added to every card |
| Pronunciation | off | Fetch audio from Merriam-Webster |
| Dictionary API Key | (empty) | Required for pronunciation feature |
| AnkiConnect URL | `http://localhost:8765` | AnkiConnect endpoint |

## Keyboard shortcuts

| Action | Default shortcut |
|--------|-----------------|
| Send to Anki | `Ctrl+Shift+A` |
| Batch send to Anki | `Ctrl+Shift+B` |

Customizable in Settings → Hotkeys (search "Anki").

## Network access

This plugin accesses the following services:

- **AnkiConnect** (`localhost:8765`): Local HTTP API to communicate with Anki. No data leaves your machine.
- **Merriam-Webster Dictionary API** (optional): Downloads pronunciation audio for words. Requires a free API key (1000 requests/day). Only accessed when the pronunciation feature is enabled in settings.

## How it works

```
Obsidian Plugin
    │  HTTP POST (JSON)
    │  localhost:8765
    ↓
AnkiConnect (Anki add-on)
    ↓
Anki Database
```

The plugin sends cards to Anki via the AnkiConnect HTTP API running locally. All communication stays on your machine.

## License

[MIT](LICENSE)
