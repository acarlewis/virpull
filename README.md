# VirPull

A small, modern Windows desktop app for downloading videos with [yt-dlp](https://github.com/yt-dlp/yt-dlp). Paste a URL, pick a quality and format, queue as many as you want, and watch them download one after another — with a clean dark-by-default UI.

Built with Electron, Vue 3, Pinia, and Vite. yt-dlp and FFmpeg do the actual downloading/muxing; this app never runs arbitrary shell commands.

## Features

- Paste a video or HLS (`.m3u8`) URL, pick quality (best down to 360p) and format (MP4/MKV/WEBM/MP3)
- **YouTube-aware quality detection** — pasting a YouTube URL automatically fetches that specific video's real available resolutions and replaces the generic quality list with them; every other URL keeps the generic list, unchanged
- **Download queue** — add multiple videos, they process one at a time; cancel or remove any item; open the containing folder when done
- Live per-item progress: percent, speed, ETA, status
- Native folder picker, with the last-used folder remembered across launches
- Customizable output filename — plain title, with upload date, or grouped into a per-uploader subfolder
- Six themes (Light, Dark, Midnight, Cyberpunk, Ocean, Forest), synced to native dialogs too — dark by default
- English, French, and Dutch UI, switchable anytime
- Settings sidebar with **General** (folder/quality/format/filename/language), **Appearance** (theme picker), and **Info** (versions, update checks, disclaimer) sections
- Human-readable, translated errors (expired link, unsupported URL, network failure, disk space, etc.) instead of raw stack traces

## Installation

**[⬇ Download VirPull-Setup.exe](https://github.com/acarlewis/virpull/releases/latest/download/VirPull-Setup.exe)**

Run the installer — yt-dlp and FFmpeg are bundled in, so there's nothing else to install. Windows SmartScreen will likely warn that the app is unrecognized, since the installer isn't code-signed: click **More info → Run anyway** to proceed.

Prefer to build it yourself instead? See [Building from source](#building-from-source) below.

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

1. Paste a URL, choose where to save it, pick quality/format. If it's a YouTube URL, the quality list automatically updates to that video's real available resolutions once fetched (shown by a status line under the format row).
2. Click **Add to Queue**. Repeat for as many videos as you like — they queue up and download one at a time.
3. Watch progress in the **Queue** tab of the sidebar. Cancel a queued or in-progress item, remove a finished/errored one, or open its folder.
4. Switch to the **Settings** tab — **General** for folder/quality/format/filename/language, **Appearance** for the theme picker, **Info** for versions, update checks, and support links.
5. Click the palette icon in the header to jump straight to the theme picker (dark is the default).

## Settings reference

**General**

- Default download folder, preferred quality/format, auto-open-folder toggle
- **Output filename** — one of three yt-dlp templates: `title.ext` (default), `date - title.ext`, or `uploader/title.ext` (groups downloads into a subfolder per channel/uploader)
- **Language** — English, French, or Dutch; switches the whole UI immediately, no restart

**Appearance**

Six themes: Light, Dark, Midnight, Cyberpunk, Ocean, Forest. Dark is the default. Each maps to a native light/dark equivalent so OS dialogs (like the folder picker) stay visually consistent.

**Info**

App version, yt-dlp/FFmpeg versions with a one-click yt-dlp updater, a "Check for updates" button (queries this repo's GitHub Releases API and links to the release if a newer version exists), a support link, and a usage disclaimer.

## Configuration

Settings persist to `%APPDATA%/VirPull/settings.json`: default download folder, preferred quality/format, filename template, language, auto-open-folder toggle, and theme. The queue itself is **not** persisted — it's in-memory only and resets on app restart (though it survives a renderer-only reload, e.g. dev-time hot-reload).

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
      i18n.js              vue-i18n setup + translateMessage/translateIpcError helpers
      locales/              en.json, fr.json
      stores/queue.js      Pinia store; owns queue/settings/theme/language state
      components/          UrlInput, FolderPicker, QualitySelect, FormatSelect,
                            QueueList, QueueItemRow, ErrorBanner, SettingsPanel
        settings/            GeneralSettings, AppearanceSettings, InfoSettings
      utils/format.js      Byte/speed/ETA formatting + status helpers

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

### YouTube format detection

`src/renderer/src/utils/youtube.js`'s `isYouTubeUrl()` is a client-side hint only — it decides whether to trigger probing, nothing more. Typing/pasting into the URL field is watched (debounced 600ms) in `App.vue`; when the URL looks like YouTube, the store calls `window.api.probeFormats(url)` → `ipcMain.handle('formats:probe', ...)` → `probeFormats()` in `src/main/formats.js`, which runs `yt-dlp -J <url>` (metadata only — nothing is downloaded) and extracts the distinct video heights actually available for that specific video from the returned format list.

`QualitySelect.vue` swaps in those real heights in place of the generic preset list (best/2160/1440/1080/720/480/360) while a probe is `ready`; every other URL — direct files, `.m3u8`, or a YouTube probe that hasn't resolved yet — keeps the generic list untouched. Selecting a probed height (which can be any real value, e.g. 144p, not just the presets) flows through the exact same `--merge-output-format`/height-filter download pipeline as before; `resolveHeight()` in `downloader.js` was generalized from a fixed lookup table to parsing any numeric height so this needed no new download logic.

**No DRM/auth/paywall bypass:** `probeFormats()` passes no cookies, credentials, proxy, or geo-bypass flags — it only ever sees what yt-dlp can extract anonymously and publicly, identically to a real download attempt. Members-only, private, age-restricted, or otherwise inaccessible videos fail the probe the same way they'd fail a download, and are classified through the same `classifyError()` used for downloads (now with added patterns for members-only content and not-yet-available premieres/live streams) — surfaced as a clear, translated message in place of the quality list rather than a raw yt-dlp error.

A URL change always resets the selected quality back to `best` (`scheduleFormatProbe()` in `stores/queue.js`) — carrying over a specific height like 144p from a previous YouTube video into a new URL that doesn't have that resolution caused real download failures ("Requested format is not available") during testing.

### Theme

Six themes live as CSS custom-property sets in `style.css`, each under a `:root[data-theme='name']` selector. Dark is the default and defined on the bare `:root` (not behind an attribute) so the very first paint — before Vue mounts and applies the persisted theme — is already correct and never flashes light. Each theme also maps to a native light/dark equivalent (`THEME_NATIVE_SOURCE` in `src/main/settings.js`) applied to Electron's `nativeTheme.themeSource`, so native dialogs (the folder picker) stay visually consistent even for themes like Cyberpunk that have no native counterpart.

### Internationalization

English, French, and Dutch, via `vue-i18n`. The renderer's translations live in `src/renderer/src/locales/*.json` (`en.json`, `fr.json`, `nl.json`) and are used directly with `t('some.key')`. Adding another language means: a new locale JSON mirroring `en.json`'s keys, registering it in `i18n.js`'s `messages` object, adding it to `VALID_LANGUAGES` in `src/main/settings.js`, and adding an `<option>` to the language `<select>` in `GeneralSettings.vue`.

Main-process error messages work differently: `downloader.js`'s `ValidationError`s and `classifyError()` return **i18n keys** (e.g. `'errors.expiredLink'`), not English text — the main process has no notion of the user's language. The renderer translates them via `translateMessage()`/`translateIpcError()` in `i18n.js`, which check whether the string is a known key (`te(key)`) and fall back to displaying it verbatim if not — this is what lets yt-dlp's own raw (English) stderr output still show up as a last resort without crashing on an unknown key.

**CSP note:** the renderer's Content-Security-Policy includes `'unsafe-eval'`, which vue-i18n needs to JIT-compile locale message strings into render functions at runtime (`new Function()`). This only ever runs against the bundled locale JSON — never remote or user-supplied content — see the comment in `index.html`. An attempted fix using `@intlify/unplugin-vue-i18n` to precompile messages at build time (avoiding eval entirely) hit a message-compiler version mismatch between that plugin and the installed `vue-i18n`; reintroducing it would be the more airtight long-term fix if someone wants to revisit it.

## Troubleshooting

- **"yt-dlp.exe was not found" / "FFmpeg was not found"** — the corresponding `.exe` isn't in `resources/binaries/` (dev) or wasn't present when you ran `npm run make` (packaged). Add it and rebuild.
- **`Cannot find module './ipc'` (or similar) when running `npm start`** — the main-process source files must use ES module `import`/`export` syntax (not `require`/`module.exports`), because `@electron-forge/plugin-vite` bundles the main-process module graph with Rollup, which only traces `import` statements.
- **Blank window / `ERR_FILE_NOT_FOUND` loading `renderer/undefined/index.html`** — `MAIN_WINDOW_VITE_DEV_SERVER_URL` / `MAIN_WINDOW_VITE_NAME` in `main.js` must be referenced as bare global identifiers (not `globalThis.X`), since the Vite plugin injects them via a build-time `define` that does textual identifier replacement.
- **Download fails immediately with a network-looking error** — check the Settings tab confirms yt-dlp/FFmpeg are found, then try the same URL directly: `resources/binaries/yt-dlp.exe <url>` from a terminal to see yt-dlp's raw output.
- **A download seems to "instantly" finish on retry** — yt-dlp resumes partially-downloaded fragments by default. This is expected; delete any `*.part`/`*.ytdl` files in the destination folder to force a clean re-download.
- **Cancel doesn't seem to stop things** — on Windows, yt-dlp spawns ffmpeg as a subprocess; cancellation uses `taskkill /pid <pid> /T /F` to kill the whole tree rather than a plain process `kill()`, which would leave ffmpeg running. If you still see orphaned processes, check Task Manager for stray `yt-dlp.exe`/`ffmpeg.exe`.
- **A queue item appears twice right after adding it** — don't reintroduce a second write path for queue state. `queue:add`'s IPC return value must only be used for its promise (success/failure of adding), never to push into the renderer's `queue` array — that array is populated exclusively by `queue:item-updated` events, which `QueueManager.add()` emits synchronously before returning.
- **Blank window with a CSP "unsafe-eval" console error mentioning vue-i18n** — the CSP in `index.html` must keep `'unsafe-eval'` in `script-src` (see the Internationalization section above) unless message precompilation is set up correctly; removing it without that will blank-screen the app.
- **Squirrel installer build fails** — `npm run make` needs to run on Windows (Squirrel.Windows is Windows-only); make sure `npm run package` succeeds first to isolate whether the issue is in the Vite build or the installer step.

## Roadmap

Implemented: queueing, per-item progress/cancel/remove, YouTube-specific format detection, General/Appearance/Info settings, six themes, English/French/Dutch UI, customizable filename templates, yt-dlp self-update, and update checks against GitHub Releases.

Not implemented yet: persisting the queue across app restarts, concurrent (parallel) downloads, in-app auto-update (the "Check for updates" button links out to the release rather than downloading it), and languages beyond English/French/Dutch.
