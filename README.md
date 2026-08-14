# VirPull

A small, modern Windows desktop app for downloading videos with [yt-dlp](https://github.com/yt-dlp/yt-dlp). Paste a URL, pick a quality and format, queue as many as you want, and watch them download one after another — with a clean dark-by-default UI.

Built with Electron, Vue 3, Pinia, and Vite. yt-dlp and FFmpeg do the actual downloading/muxing; this app never runs arbitrary shell commands.

## Features

- Paste a video or HLS (`.m3u8`) URL, pick quality (best down to 360p) and format (MP4/MKV/WEBM/MP3)
- **Download queue** — add multiple videos, they process one at a time; cancel or remove any item; open the containing folder when done
- Live per-item progress: percent, speed, ETA, status
- Native folder picker, with the last-used folder remembered across launches
- Dark/light theme, synced to native dialogs too
- Settings sidebar: default folder, preferred quality/format, auto-open-folder toggle, yt-dlp/FFmpeg version display, one-click yt-dlp update
- Human-readable errors (expired link, unsupported URL, network failure, disk space, etc.) instead of raw stack traces

## Installation

VirPull is a Windows desktop app; there's no npm package to install globally.

**Prebuilt installer:** if this repo has a [Releases](../../releases) page, download the latest `VirPull-*-Setup.exe`, run it, and you're done — yt-dlp and FFmpeg are bundled in, no extra downloads required.

**No release available yet, or you want to build it yourself:** see [Building from source](#building-from-source) below.

## Building from source

### Prerequisites

- Windows 10/11
- [Node.js](https://nodejs.org/) 20+ and npm
- `yt-dlp.exe` and `ffmpeg.exe` in `resources/binaries/` (not committed to the repo — see below)

### 1. Clone and install

```bash
git clone <this-repo-url>
cd virpull
npm install
```

`npm install` automatically runs `scripts/setup-binaries.mjs` (as a `postinstall` hook), which downloads `yt-dlp.exe` and `ffmpeg.exe` straight into `resources/binaries/` — no manual downloading needed. It's safe to re-run any time:

```bash
npm run setup:binaries
```

It skips any binary that's already present, so re-running just confirms everything's in place. If it can't reach the internet (it won't fail `npm install` over this — it just warns), grab the files yourself:

```
resources/binaries/
  yt-dlp.exe     ← https://github.com/yt-dlp/yt-dlp/releases/latest (asset "yt-dlp.exe")
  ffmpeg.exe     ← a Windows static build, e.g. https://www.gyan.dev/ffmpeg/builds/
                   or https://github.com/BtbN/FFmpeg-Builds/releases (grab ffmpeg.exe
                   from the archive's bin/ folder)
```

The app also checks for both at startup — the Settings tab shows "Not found" if either is missing, and it refuses to start a download with a clear error rather than crashing.

### 2. Run it

```bash
npm start
```

This builds the main/preload bundles, starts a Vite dev server for the renderer (hot reload), and launches Electron pointed at it.

### 3. Package it

```bash
npm run package   # unpacked build in out/VirPull-win32-x64/, for quick testing
npm run make      # distributable Squirrel.Windows installer in out/make/
```

Whatever is in `resources/binaries/` at build time gets copied next to the packaged app (via `packagerConfig.extraResource` in `forge.config.js`) and shipped inside the installer — end users need to install nothing extra.

## Usage

1. Paste a URL, choose where to save it, pick quality/format.
2. Click **Add to Queue**. Repeat for as many videos as you like — they queue up and download one at a time.
3. Watch progress in the **Queue** tab of the sidebar. Cancel a queued or in-progress item, remove a finished/errored one, or open its folder.
4. Switch to the **Settings** tab to change defaults, check yt-dlp/FFmpeg versions, or update yt-dlp.
5. Toggle dark/light theme with the icon button in the header (dark is the default).

## Configuration

Settings persist to `%APPDATA%/VirPull/settings.json`: default download folder, preferred quality/format, auto-open-folder toggle, and theme. The queue itself is **not** persisted — it's in-memory only and resets on app restart (though it survives a renderer-only reload, e.g. dev-time hot-reload).

## Architecture

```
src/
  main/               Electron main process (Node.js)
    main.js           App bootstrap, BrowserWindow, security settings
    ipc.js             All ipcMain handlers (the only entry point into main-process logic)
    queue.js             QueueManager — sequential FIFO download queue (one yt-dlp job at a time)
    downloader.js       Builds yt-dlp argument lists, spawns/parses/cancels a single job
    settings.js         Persists user settings to userData/settings.json
    paths.js            Resolves binary/settings paths for dev vs. packaged builds

  preload/
    preload.js           contextBridge API — the only thing the renderer can call

  renderer/               Vue 3 + Vite frontend
    index.html
    public/logo.png        VirPull logo, shown in the header
    src/
      App.vue             Two-column layout: add-download form + sidebar
      main.js
      stores/queue.js      Pinia store; owns queue/settings/theme state
      components/          UrlInput, FolderPicker, QualitySelect, FormatSelect,
                            QueueList, QueueItemRow, ErrorBanner, SettingsPanel
      utils/format.js      Byte/speed/ETA formatting + status-label helpers

resources/binaries/     yt-dlp.exe + ffmpeg.exe (not committed — see above)
build/icon.ico          Windows app/installer icon (generated from the logo)
forge.config.js         Electron Forge + Vite + Squirrel packaging config
vite.main.config.mjs / vite.preload.config.mjs / vite.renderer.config.mjs
```

### Security model

- The renderer (Vue app) has **no Node.js or Electron access**. `nodeIntegration` is off, `contextIsolation` and `sandbox` are on.
- `preload.js` exposes a fixed `window.api` object via `contextBridge` — a whitelist of specific functions (`addToQueue`, `cancelQueueItem`, `selectDownloadFolder`, etc.) and specific event subscriptions. No raw `ipcRenderer` is ever exposed.
- All yt-dlp/ffmpeg invocations happen in the main process (`downloader.js`), via `child_process.spawn` with **arguments passed as an array** — never through a shell, so the URL (or any other input) can never inject extra command-line flags or run arbitrary commands. URLs are validated (`http`/`https` only, rejecting anything starting with `-`) before ever reaching yt-dlp.

### Queue model

Only **one yt-dlp process runs at a time** (kinder to bandwidth/CPU, keeps the child-process model simple). Adding a video appends it to the queue; if nothing is currently downloading it starts immediately, otherwise it waits as `queued`. Finishing, erroring, or cancelling the active item automatically advances to the next queued one. This is deliberate — not a limitation to fix later — see `QueueManager` in `src/main/queue.js`.

**How a download flows:**

1. `App.vue`'s form calls `store.addToQueue()` (Pinia store in `stores/queue.js`).
2. The store calls `window.api.addToQueue(...)` → preload → `ipcMain.handle('queue:add', ...)` in `ipc.js`.
3. `ipc.js` delegates to `QueueManager.add()` (`queue.js`), which validates input, appends a queue item, and — if idle — starts a `DownloadJob` (`downloader.js`) spawning `yt-dlp.exe` with a custom `--progress-template` that emits structured, delimiter-separated progress lines and a final `--print` line with the finished file path.
4. `downloader.js` parses yt-dlp's stdout line by line and calls back into `QueueManager`, which updates that item's state and pushes a `queue:item-updated` event (plus `queue:item-complete` on success) to the renderer over IPC (never blocking the renderer). When a job finishes/errors/cancels, `QueueManager` immediately starts the next queued item.
5. The Pinia store listens for those events and merges them into its `queue` array by item id; `QueueList.vue` renders it reactively.

The renderer's *only* write path for queue item state is these events — the `queue:add` IPC call's return value is not used to mutate state (that raced with the event on initial add, producing duplicate rows; see the comment in `queue.js`).

### Theme

Dark is the default (first-run setting, and the base CSS so there's no flash-of-light on startup). The icon button in the header toggles light/dark; the choice persists to settings and is applied both to the Vue UI (via a `data-theme` attribute + CSS custom properties in `style.css`) and to Electron's `nativeTheme.themeSource`, so native elements like the folder-picker dialog match too.

## Troubleshooting

- **"yt-dlp.exe was not found" / "FFmpeg was not found"** — the corresponding `.exe` isn't in `resources/binaries/` (dev) or wasn't present when you ran `npm run make` (packaged). Add it and rebuild.
- **`Cannot find module './ipc'` (or similar) when running `npm start`** — the main-process source files must use ES module `import`/`export` syntax (not `require`/`module.exports`), because `@electron-forge/plugin-vite` bundles the main-process module graph with Rollup, which only traces `import` statements.
- **Blank window / `ERR_FILE_NOT_FOUND` loading `renderer/undefined/index.html`** — `MAIN_WINDOW_VITE_DEV_SERVER_URL` / `MAIN_WINDOW_VITE_NAME` in `main.js` must be referenced as bare global identifiers (not `globalThis.X`), since the Vite plugin injects them via a build-time `define` that does textual identifier replacement.
- **Download fails immediately with a network-looking error** — check the Settings tab confirms yt-dlp/FFmpeg are found, then try the same URL directly: `resources/binaries/yt-dlp.exe <url>` from a terminal to see yt-dlp's raw output.
- **A download seems to "instantly" finish on retry** — yt-dlp resumes partially-downloaded fragments by default. This is expected; delete any `*.part`/`*.ytdl` files in the destination folder to force a clean re-download.
- **Cancel doesn't seem to stop things** — on Windows, yt-dlp spawns ffmpeg as a subprocess; cancellation uses `taskkill /pid <pid> /T /F` to kill the whole tree rather than a plain process `kill()`, which would leave ffmpeg running. If you still see orphaned processes, check Task Manager for stray `yt-dlp.exe`/`ffmpeg.exe`.
- **A queue item appears twice right after adding it** — don't reintroduce a second write path for queue state. `queue:add`'s IPC return value must only be used for its promise (success/failure of adding), never to push into the renderer's `queue` array — that array is populated exclusively by `queue:item-updated` events, which `QueueManager.add()` emits synchronously before returning.
- **Squirrel installer build fails** — `npm run make` needs to run on Windows (Squirrel.Windows is Windows-only); make sure `npm run package` succeeds first to isolate whether the issue is in the Vite build or the installer step.

## Roadmap

Implemented: queueing, per-item progress/cancel/remove, settings sidebar, dark/light theme, yt-dlp self-update.

Not implemented yet: persisting the queue across app restarts, concurrent (parallel) downloads, and app auto-update.
