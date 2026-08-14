# Binaries

Place the following two executables directly in this folder before running the app in development:

- `yt-dlp.exe` — download from https://github.com/yt-dlp/yt-dlp/releases/latest (asset named `yt-dlp.exe`)
- `ffmpeg.exe` — download a Windows "essentials" or "full" build from https://www.gyan.dev/ffmpeg/builds/ (or https://ffmpeg.org/download.html) and copy `ffmpeg.exe` from the `bin` folder of the archive

Neither binary is committed to source control (see `.gitignore`). At build time, `forge.config.js` copies this entire folder into the packaged app's `resources` directory via `extraResource`, so whatever is here when you run `npm run make` ships inside the installer.

Expected layout:

```
resources/binaries/
  yt-dlp.exe
  ffmpeg.exe
```
