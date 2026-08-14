# Video Downloader

A small, modern Windows desktop app for downloading videos with [yt-dlp](https://github.com/yt-dlp/yt-dlp), built with Electron, Vue 3, and Vite.

## Architecture

```
src/
  main/               Electron main process (Node.js)
    main.js           App bootstrap, BrowserWindow, security settings
    ipc.js             All ipcMain handlers (the only entry point into main-process logic)
    downloader.js       Builds yt-dlp argument lists, spawns/parses/cancels the process
    settings.js         Persists user settings to userData/settings.json
    paths.js            Resolves binary/settings paths for dev vs. packaged builds

  preload/
    preload.js           contextBridge API — the only thing the renderer can call

  renderer/               Vue 3 + Vite frontend
    index.html
    src/
      App.vue
      main.js
      stores/download.js  Pinia store; owns all download/settings state
      components/          UrlInput, FolderPicker, QualitySelect, FormatSelect,
                            ProgressPanel, ErrorBanner, SettingsPanel
      utils/format.js      Byte/speed/ETA formatting helpers

resources/binaries/     yt-dlp.exe + ffmpeg.exe (not committed — see below)
forge.config.js         Electron Forge + Vite + Squirrel packaging config
vite.main.config.mjs / vite.preload.config.mjs / vite.renderer.config.mjs
```

**Process boundaries (security model):**

- The renderer (Vue app) has **no Node.js or Electron access**. `nodeIntegration` is off, `contextIsolation` and `sandbox` are on.
- `preload.js` exposes a fixed `window.api` object via `contextBridge` — a whitelist of specific functions (`startDownload`, `cancelDownload`, `selectDownloadFolder`, etc.) and specific progress-event subscriptions. No raw `ipcRenderer` is ever exposed.
- All yt-dlp/ffmpeg invocations happen in the main process (`downloader.js`), via `child_process.spawn` with **arguments passed as an array** — never through a shell, so the URL (or any other input) can never inject extra command-line flags or run arbitrary commands. URLs are validated (`http`/`https` only, rejecting anything starting with `-`) before ever reaching yt-dlp.

**How a download flows:**

1. `App.vue` calls `store.startDownload()` (Pinia store in `stores/download.js`).
2. The store calls `window.api.startDownload(...)` → preload → `ipcMain.handle('download:start', ...)` in `ipc.js`.
3. `ipc.js` validates input, builds a `DownloadJob` (`downloader.js`), and spawns `yt-dlp.exe` with a custom `--progress-template` that emits structured, delimiter-separated progress lines and a final `--print` line with the finished file path.
4. `downloader.js` parses yt-dlp's stdout line by line and calls back into `ipc.js`, which pushes `download:progress` / `download:status` / `download:complete` / `download:error` events to the renderer over IPC (never blocking the renderer).
5. The Pinia store listens for those events and updates reactive state; the UI components re-render automatically.

## Prerequisites

- Windows 10/11
- [Node.js](https://nodejs.org/) 20+ and npm
- `yt-dlp.exe` and `ffmpeg.exe` placed in `resources/binaries/` (see below) — required for development, since they are not committed to source control.

### Getting the binaries (development)

```
resources/binaries/
  yt-dlp.exe     ← https://github.com/yt-dlp/yt-dlp/releases/latest (asset "yt-dlp.exe")
  ffmpeg.exe     ← a Windows static build, e.g. https://www.gyan.dev/ffmpeg/builds/
                   (grab ffmpeg.exe from the archive's bin/ folder)
```

The app checks for both files at startup (Settings panel shows "Not found" if missing) and will refuse to start a download without them, with a clear error message rather than a crash.

## Development commands

```bash
npm install
npm start
```

`npm start` runs `electron-forge start`, which builds the main/preload bundles, starts a Vite dev server for the renderer (with hot reload), and launches Electron pointed at it.

## Build / package commands

```bash
npm run package   # produces out/Video Downloader-win32-x64/ (unpacked, for quick testing)
npm run make      # produces a distributable Windows installer in out/make/
```

`npm run make` uses `@electron-forge/maker-squirrel` to produce a Squirrel.Windows installer (`.exe`) plus a zip artifact, in `out/make/`.

### How binaries are bundled for the packaged app

`forge.config.js` sets `packagerConfig.extraResource: ['resources/binaries']`. This copies the entire `resources/binaries/` folder (whatever `.exe` files are there at build time) into the packaged app's `resources/binaries/` directory, **next to** `app.asar` rather than inside it — necessary because they must be spawned as real Windows executables, not read from inside an archive.

At runtime, `src/main/paths.js` resolves the binaries directory differently depending on context:

- **Development** (`app.isPackaged === false`): `<project>/resources/binaries/`
- **Packaged**: `process.resourcesPath/binaries/` (i.e. next to `app.asar`)

So: make sure `resources/binaries/yt-dlp.exe` and `resources/binaries/ffmpeg.exe` exist **before** running `npm run make` — whatever is there gets shipped inside the installer, and end users need install nothing extra.

## Settings

Available in the collapsible **Settings** section on the main screen: default download folder, preferred quality/format, auto-open-folder toggle, and yt-dlp/FFmpeg version display with an **Update yt-dlp** button (runs the bundled `yt-dlp.exe -U` self-update and refreshes the shown version). Settings persist to `%APPDATA%/Video Downloader/settings.json` and are restored on next launch — including the last-used download folder, defaulting to the Windows Downloads folder on first run.

## Troubleshooting

- **"yt-dlp.exe was not found" / "FFmpeg was not found"** — the corresponding `.exe` isn't in `resources/binaries/` (dev) or wasn't present when you ran `npm run make` (packaged). Add it and rebuild.
- **`Cannot find module './ipc'` (or similar) when running `npm start`** — the main-process source files must use ES module `import`/`export` syntax (not `require`/`module.exports`), because `@electron-forge/plugin-vite` bundles the main-process module graph with Rollup, which only traces `import` statements.
- **Blank window / `ERR_FILE_NOT_FOUND` loading `renderer/undefined/index.html`** — `MAIN_WINDOW_VITE_DEV_SERVER_URL` / `MAIN_WINDOW_VITE_NAME` in `main.js` must be referenced as bare global identifiers (not `globalThis.X`), since the Vite plugin injects them via a build-time `define` that does textual identifier replacement.
- **Download fails immediately with a network-looking error** — check the Settings panel confirms yt-dlp/FFmpeg are found, then try the same URL directly: `resources/binaries/yt-dlp.exe <url>` from a terminal to see yt-dlp's raw output.
- **A download seems to "instantly" finish on retry** — yt-dlp resumes partially-downloaded fragments by default. This is expected; delete any `*.part`/`*.ytdl` files in the destination folder to force a clean re-download.
- **Cancel doesn't seem to stop things** — on Windows, yt-dlp spawns ffmpeg as a subprocess; cancellation uses `taskkill /pid <pid> /T /F` to kill the whole tree rather than a plain process `kill()`, which would leave ffmpeg running. If you still see orphaned processes, check Task Manager for stray `yt-dlp.exe`/`ffmpeg.exe`.
- **Squirrel installer build fails** — `npm run make` needs to run on Windows (Squirrel.Windows is Windows-only); make sure `npm run package` succeeds first to isolate whether the issue is in the Vite build or the installer step.

## What's implemented (Phase 1 + light Phase 2)

- URL input (paste button), native folder picker with persisted last-used folder, quality/format dropdowns, Download/Cancel, live progress bar with percent/speed/ETA/status, human-readable error banner, open-folder-on-complete.
- Settings panel: default folder, preferred quality/format, auto-open toggle, yt-dlp/FFmpeg version + update-yt-dlp.
- Not implemented (left for a future pass): download history, multi-download queue, and app auto-update — the spec explicitly scoped these as later-phase / optional.
