# Discord Hider

A Manifest V3 Chrome/Edge extension that declutters the Discord web UI — hide
the elements you don't want, trim individual toolbar buttons, and highlight
keywords in chat. All settings sync across your browser profile via
`chrome.storage.sync`; nothing leaves your machine.

## Features

### Hide UI elements

Toggle any of the four main layout regions on or off with one click from the
popup:

| Element        | Default selector                       |
| -------------- | -------------------------------------- |
| Server List    | `nav[aria-label="Servers sidebar"]`    |
| Channel Column | `div[class*="sidebarList"]`            |
| Top Toolbar    | `div[data-window-chrome="true"]`       |
| Chat Bar       | `div[class*="channelTextArea"]`        |

### Toolbar item visibility

Instead of hiding the whole top toolbar, hide individual buttons — **Threads**,
**Notification Settings**, **Pinned Messages**, **Member List**, and the
**Search Bar** — independently.

### Keyword highlighting

Highlight words and phrases in messages as you read. Each keyword gets its own
color and an enable toggle, and you can pick between two visual styles:

- **Background** — fills the matched text with the keyword color
- **Chip** — outlines the match with a colored border and tinted background

Highlighting is case-insensitive, applies to existing and newly-arriving
messages (via a mutation observer), and supports **per-channel keyword sets**
that can either replace or inherit your global keywords.

### Per-channel overrides

Hide or show elements differently per channel, and scope keyword sets to
specific channels — all configured in the Settings page. The current channel
name is detected automatically so overrides are easy to identify.

### Custom selectors

If Discord changes its DOM and a target stops matching, use the **eyedropper**
picker to select the element directly, or edit the selector by hand. Reset any
target back to its default at any time.

## Install

### From a release (recommended)

1. Download `discord-hider-vX.Y.Z.zip` from the
   [latest release](../../releases/latest) and unzip it — you'll get a folder
   containing `manifest.json`.
2. Open `chrome://extensions` (or `edge://extensions`) and enable
   **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Open **discord.com**, click the Discord Hider toolbar icon, and start
   toggling. Pin the icon if you don't see it.

To update, download the newer zip, remove the old entry, and load the new folder.

### From source

1. Clone the repo and `npm install`
2. `npm run build`
3. Open `chrome://extensions`, enable **Developer mode**, click **Load
   unpacked**, and select the `dist/` folder

## Development

```bash
npm run build       # full build (popup + settings + content script)
npm test            # run all tests
npx tsc --noEmit    # type-check (tests do not type-check on their own)
```

CI runs the tests, type-check, and build on every PR and push to `main`.
Pushing a `vX.Y.Z` tag builds and publishes a release zip automatically — see
[`docs/superpowers/specs/2026-06-08-github-actions-release-design.md`](docs/superpowers/specs/2026-06-08-github-actions-release-design.md).

## Stack

Vite 5 · React 18 · TypeScript 5 · Lucide React · Vitest
