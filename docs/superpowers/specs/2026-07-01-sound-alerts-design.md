# Per-Channel Sound Alerts - Design Spec

**Date:** 2026-07-01
**Status:** Draft (pending approval)

## Problem

There is no audible signal when a new message arrives.
A user watching a channel has to keep visually scanning it to notice activity.

## Goal

Let a user enable a per-channel sound alert that plays a short sound effect when a new message arrives **in the channel they are currently viewing**.
Sound alerts default to **off** for every channel until explicitly toggled on.

## Summary of behaviour

- A sound plays only when **all** of these hold:
  1. The channel is **open** (its id is the active channel in the tab).
  2. Sound alerts are **enabled** for that channel.
  3. The tab has been **armed** ("Unlock Sound" clicked) and is not muted.
  4. The DOM change is a **genuinely new live message** (not backscroll, not the channel-switch bulk render).
- Tabs load **muted**. Nothing plays until the user arms audio, which also satisfies the browser autoplay gate.
- Rapid bursts are **coalesced**: at most one sound per short window.

---

## Glossary

These are the load-bearing terms this feature introduces.
They should be used consistently in code identifiers, comments, and UI copy.

| Term | Meaning |
|---|---|
| **Open channel** | The channel whose id matches the tab's current URL (`getChannelId()`). Independent of whether the browser tab is focused or visible. |
| **Live message** | A genuinely new message appended to the open channel's message list in real time. The only thing that triggers a sound. |
| **Backscroll** | Older messages loaded by scrolling **up** through history. Added at the **top** of the scroller. Never triggers a sound. |
| **Bulk render** | The burst of message rows Discord renders when you first open or switch into a channel. Never triggers a sound. |
| **Armed** | Runtime state of a tab: the user clicked "Unlock Sound", satisfying the browser autoplay gate. Arming is **tab-wide** and **ephemeral** - it resets to un-armed on every page reload. |
| **Muted** | An armed tab that the user has toggled to silence. Tab-wide. Distinct from a channel having alerts disabled. |
| **Quiet window** | A short interval after a channel navigation during which no sound plays, so the bulk render stays silent. |
| **Bottom-anchored** | A message added at the bottom of the scroller while the view is scrolled near the bottom - the hallmark of a live message versus backscroll. |
| **Last-seen id** | The newest message snowflake id observed for a channel. A candidate message triggers a sound only if its id is strictly greater. |
| **Global default sound** | The sound played for an enabled channel that has not chosen its own sound. |
| **Global volume** | A single volume applied to all alert sounds. |

---

## Decision records

Numbered decisions with the rationale and the alternatives that were rejected, so future changes know what was already considered.

### ADR-1 - Trigger on genuinely-new live messages; fire on own sends in v1

A sound fires only for a **live message** in the open channel.
Backscroll and bulk render are suppressed (see ADR-3).
**Own sent messages are allowed to fire a sound in v1.**
Reliably identifying message authorship from Discord's DOM (grouped messages, no clean "my user id") is brittle, and suppressing own sends was judged not worth that fragility for a first version.
Rejected: post-send quiet window and author-based detection - deferred as possible follow-ups.

### ADR-2 - "Open" means the URL channel, focus-independent

A sound may fire whenever the open channel has alerts enabled, **even if the Discord tab is not focused or visible**.
Rejected: gating on tab focus/visibility - the point of an alert is partly to notify while attention is elsewhere, and focus-gating would defeat that.

### ADR-3 - New-message detection: last-seen snowflake id (primary) + bottom-anchored + quiet window (redundancy)

A candidate DOM node triggers a sound only if it passes a redundant filter:

- **Last-seen id (primary):** the node is a message row whose snowflake id is strictly greater than the channel's last-seen id. Snowflakes are time-ordered, so "strictly newer" cleanly excludes backscroll (older ids) and bulk render (initialised as seen - see below).
- **Bottom-anchored (backup):** the node was added at the bottom while the scroller is near the bottom. Backscroll adds at the top, so this independently rejects it.
- **Quiet window (backup):** a short interval after navigation during which nothing plays, covering the bulk render even if id bookkeeping lags.

On navigation into a channel, the last-seen id is initialised to the newest **currently-rendered** message, so the bulk render is treated as already-seen and never sounds.
Rejected: quiet-window-only (still fires on backscroll) and bottom-anchored-only (fragile against Discord scroll quirks). Redundancy is deliberate.

> **Assumption to validate during implementation:** Discord message rows expose a sortable snowflake id in the DOM (e.g. `id="chat-messages-<channelId>-<messageId>"`). If the attribute shape differs, the extraction helper changes but the algorithm stands.

### ADR-4 - Autoplay handled by explicit tab-wide arming; tabs load muted; arming is ephemeral

Browsers block `audio.play()` until the page receives a user gesture.
Tabs therefore load **muted**.
The user arms audio by clicking an injected **"Unlock Sound"** control; that click is the required page gesture and arms the **whole tab** until reload.
Arming/mute state is **runtime state in the content script**, not persisted to `chrome.storage.sync` - a reload should return to the muted, safe default.
The unlock gesture also `resume()`s the Web Audio `AudioContext` (ADR-11), which browsers suspend until a gesture.
Rejected: best-effort silent play (surprising and unreliable) and auto-priming on any gesture (plays before the user opted in).

### ADR-5 - Unlock control in the channel header, with a popup backup

The "Unlock Sound" control is injected into the channel **header** (the `div[data-window-chrome="true"]` region that hosts search / threads / member-list), reusing the existing element-region conventions.
It is shown only when the open channel has alerts enabled, and re-injected on navigation (Discord re-renders the header).
Because this extension can **hide that header**, the popup's Sounds tab also carries an arm/mute control as a backup.

> **Known limitation (autoplay + popup):** a click inside the extension popup is a gesture in the *popup* document, not the Discord page, so the popup can flip the armed flag but cannot itself satisfy the page's autoplay gate. In practice the user has almost always already clicked within the Discord page (navigating channels), which unlocks it. The in-header button remains the fully-guaranteed unlock path because its click lands in the page.

### ADR-6 - Post-unlock control is a tab-wide mute/unmute toggle

After arming, the control becomes a **mute/unmute** toggle that silences or restores **the whole tab**, matching the tab-wide arming model (ADR-4). It does not alter the saved per-channel enabled settings.

### ADR-7 - Bursts coalesced by throttle

At most one sound plays per short window (target ~1000–1500 ms).
Only the open channel can play, so throttling is effectively per-open-channel.
Rejected: one-sound-per-message (overlap cacophony on busy channels).

### ADR-8 - Four bundled sounds, per-channel choice + volume, global defaults, no kill-switch

Four `.mp3` files are bundled as web-accessible resources.
Each enabled channel may choose its own **sound** and its own **volume**; a channel with no explicit choice falls back to the **global default sound** / **global default volume** respectively (mirrors the keyword global-vs-channel pattern).
There is **no** separate global on/off kill-switch - per-channel toggles plus arm/mute are the gates.
Multiple channels open across tabs can each sound with their own choice.
Per-channel volume is editable in both the popup (below the sound picker) and the Settings channel list; the global default volume lives in Settings.
Rejected: a single global volume - the user wants per-channel control (e.g. a loud alert channel, a quiet background one).

### ADR-11 - Loudness safeguard via a Web Audio limiter

Playback goes through the **Web Audio API**, not a bare `HTMLAudioElement`, so a limiter can sit in the graph:

```
AudioBufferSourceNode → GainNode(effectiveVolume) → DynamicsCompressorNode(limiter) → destination
```

The `DynamicsCompressorNode` is configured as a brickwall-ish limiter (low threshold, high ratio, fast attack, short release) and the volume sliders map 0–100% onto a gain range with a **hard ceiling below unity**, leaving the limiter headroom.
The result: however hot a source `.mp3` is, peak output is bounded and an alert can never blast at full system loudness.
The shared `AudioContext` is created lazily and `resume()`d on the unlock gesture (ties into ADR-4).
Source buffers are fetched once via `chrome.runtime.getURL` and decoded/cached.

### ADR-12 - Icons are inline SVG (lucide), not emoji

All new UI affordances (unlock/mute button, volume, limiter note, sound-preview control, header button) use inline SVG icons consistent with the extension's existing `lucide-react` usage (`Lock`, `Volume2`, `VolumeX`, `Volume1`, `Play`, `ShieldCheck`, `Settings`), not emoji.
Keeps the feature visually consistent with the rest of the UI and crisp at any DPI.

### ADR-9 - Threads out of scope for v1

Threads and forum posts have their own channel id, so `getChannelId()` treats each as a distinct channel.
v1 does not special-case them; a thread simply behaves like any other channel id.
No parent-channel inheritance.
Documented as a known limitation.

### ADR-10 - Multiple tabs sound independently

If Discord is open in several tabs, each arms independently and each plays its open channel's alert.
Accepted as expected behaviour, not deduplicated.

---

## Data model

### New types

```typescript
// src/shared/types.ts

export type SoundId = 'ding' | 'anime' | 'meet' | 'quack'

export interface SoundChannelConfig {
  enabled: boolean       // default (absent) = off
  sound?: SoundId        // omitted = use global default sound
  volume?: number        // 0..1; omitted = use global default volume
}

export interface SoundAlertSettings {
  defaultSound: SoundId          // used when a channel has no explicit sound
  defaultVolume: number          // 0..1; used when a channel has no explicit volume
  channels: { [channelId: string]: SoundChannelConfig }
}
```

### New field on `Settings`

```typescript
soundAlerts: SoundAlertSettings
```

### Defaults

```typescript
soundAlerts: {
  defaultSound: 'ding',   // classic notification tone
  defaultVolume: 0.5,
  channels: {},           // every channel off until toggled
}
```

Arming and mute are **not** stored here - they are ephemeral content-script runtime state (ADR-4).

---

## Assets and manifest

- Files supplied at `src/assets/sounds/{ding,anime,meet,quack}.mp3`.
- UI labels: `Ding`, `Anime`, `Meet`, `Quack`. Default: `ding`.
- Exposed to the page via `web_accessible_resources` in `manifest.json`, matched to `https://discord.com/*`, and loaded with `chrome.runtime.getURL('assets/sounds/<id>.mp3')`.
- The Vite content build must copy `src/assets/sounds/*` into `dist/assets/sounds/`.

---

## Detection algorithm (content script)

Runtime state (module-level, per tab):

- `armed: boolean` - default `false`.
- `muted: boolean` - default `false`.
- `lastSeenId: Record<channelId, bigint>` - newest snowflake seen per channel.
- `lastPlayedAt: number` - for throttling.
- `quietUntil: number` - timestamp; sounds suppressed until then.

On navigation / `applyAll`:

1. Set `quietUntil = now + QUIET_MS`.
2. Initialise `lastSeenId[channel]` to the max snowflake among currently-rendered rows (bulk render marked seen).
3. Re-inject / update the header Unlock control if the channel has alerts enabled.

On each observed added node (reuse a scroller `MutationObserver`, sibling to `startKeywordObserver`):

1. Resolve it (or a descendant) to a message row and extract its snowflake id; bail if none.
2. Channel alerts enabled? else skip.
3. `armed && !muted`? else skip.
4. `now >= quietUntil`? else skip (bulk render).
5. Bottom-anchored (added near bottom, scroller near bottom)? else skip (backscroll).
6. `id > lastSeenId[channel]`? update `lastSeenId`; else skip.
7. `now - lastPlayedAt >= THROTTLE_MS`? else skip (coalesce). Set `lastPlayedAt = now`.
8. Play the channel's sound (or the global default sound) at the channel's volume (or the global default volume), through the Web Audio limiter graph (ADR-11).

---

## Content ↔ popup messaging

Arming/mute is content-script runtime state, so the popup queries and drives it by message (like the existing `getChannelInfo` handler in `src/content/index.ts`):

- `getSoundState` → `{ armed: boolean, muted: boolean }`
- `setSoundArmed` → arms the tab (also used by the popup backup, subject to the ADR-5 caveat)
- `toggleSoundMute` → flips tab mute

---

## UI

### Popup - new "Sounds" tab

Alongside Elements / Keywords, operating on the current channel:

- Arm / Mute control at the top (backup for ADR-5), reflecting live `getSoundState`, using the `Lock`/`Volume2`/`VolumeX` icons.
- Enable toggle for the current channel.
- Sound picker chips (the four sounds; "Default" uses the global default), each with a `Play` preview.
- Per-channel volume slider below the picker (overrides the global default volume). Picker + volume grey out when the channel is disabled.
- A note when not on a channel, mirroring the Keywords tab.

### Settings - "Sound Alerts" section

- Global default volume slider (with the limiter note).
- Global default sound picker.
- Per-channel list (channels with config): enable mini-toggle + sound dropdown + compact volume slider + remove, consistent with the existing channel-overrides UI.

---

## Files changed

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `SoundId`, `SoundChannelConfig`, `SoundAlertSettings`; add `soundAlerts` to `Settings` |
| `src/shared/storage.ts` | Defaults + `getSettings` merge; helpers `setSoundChannelEnabled`, `setSoundChannelSound`, `setSoundChannelVolume`, `removeSoundChannel`, `setSoundDefaultSound`, `setSoundDefaultVolume` |
| `src/content/soundAlerts.ts` (new) | Detection algorithm, runtime state, Web Audio limiter playback (ADR-11), header Unlock control injection |
| `src/content/index.ts` | Wire the sound observer + navigation hooks; add `getSoundState` / `setSoundArmed` / `toggleSoundMute` message handlers |
| `src/content/selectors.ts` | Header injection anchor + message-row / snowflake selectors |
| `src/popup/Popup.tsx` | New "Sounds" tab: per-channel enable, sound picker, arm/mute |
| `src/settings/Settings.tsx` | "Sound Alerts" section: volume, default sound, per-channel list |
| `manifest.json` | `web_accessible_resources` for `assets/sounds/*.mp3` |
| `vite.content.config.ts` | Copy sound assets into `dist` |
| `src/assets/sounds/*.mp3` (new) | Four bundled sounds (user-supplied) |

## Tests to add

- `soundAlerts` detection: fires on a bottom-anchored newer id; skips backscroll (top / older id), bulk render (within quiet window), un-armed, muted, disabled channel, and throttled bursts.
- Snowflake extraction + `lastSeenId` bookkeeping across navigation.
- `storage.test.ts`: `getSettings` merge when `soundAlerts` absent; helper mutations.
- `Popup.test.tsx`: Sounds tab enable / sound pick / arm-mute messaging.
- `Settings.test.tsx`: volume, default sound, per-channel add/enable/remove.

## Open items before implementation

1. ~~Sound assets~~ - resolved: `ding`/`anime`/`meet`/`quack`, default `ding`, files in `src/assets/sounds/`.
2. **Snowflake DOM shape** - confirm the message-row id attribute on live Discord (ADR-3 assumption). Verify during implementation.
3. **Header injection anchor** - confirm a stable insertion point inside `div[data-window-chrome="true"]` that survives Discord re-renders. Verify during implementation.
4. **UI mockup** - hammer out popup Sounds tab + Settings section layout in a Lavish artifact before building.
