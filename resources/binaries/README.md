# Binaries

Both executables are fetched automatically — `npm install` runs `scripts/setup-binaries.mjs` as a `postinstall` hook and downloads them straight into this folder. Re-run it any time with:

```bash
npm run setup:binaries
```

It skips whatever's already present, so it's safe to run repeatedly.

If you'd rather grab them yourself (no internet during install, corporate proxy, etc.), place these two files directly in this folder:

- `yt-dlp.exe` — download from https://github.com/yt-dlp/yt-dlp/releases/latest (asset named `yt-dlp.exe`)
- `ffmpeg.exe` — download a Windows static build, e.g. from https://www.gyan.dev/ffmpeg/builds/ or https://github.com/BtbN/FFmpeg-Builds/releases, and copy `ffmpeg.exe` out of the archive's `bin` folder

Neither binary is committed to source control (see `.gitignore`). At build time, `forge.config.js` copies this entire folder into the packaged app's `resources` directory via `extraResource`, so whatever is here when you run `npm run make` ships inside the installer.

Expected layout:

```
resources/binaries/
  yt-dlp.exe
  ffmpeg.exe
```
