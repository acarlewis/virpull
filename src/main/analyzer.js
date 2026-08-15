import { execFile } from 'node:child_process';
import { validateUrl } from './downloader.js';
import { classifyError } from './errorClassifier.js';

const ANALYZE_TIMEOUT_MS = 25000;
const MAX_BUFFER_BYTES = 20 * 1024 * 1024;
const MAX_DESCRIPTION_LENGTH = 1000;

// Formats yt-dlp reports purely for seek-bar thumbnails (storyboards), never
// real downloadable media — exclude them from what the UI shows/selects.
function isRealFormat(f) {
  if (f.ext === 'mhtml') return false;
  if (typeof f.format_note === 'string' && /storyboard/i.test(f.format_note)) return false;
  return true;
}

function toIsoDate(uploadDate) {
  if (typeof uploadDate !== 'string' || !/^\d{8}$/.test(uploadDate)) return null;
  return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`;
}

function pickThumbnail(info) {
  if (typeof info.thumbnail === 'string' && info.thumbnail) return info.thumbnail;
  if (Array.isArray(info.thumbnails) && info.thumbnails.length) {
    const last = info.thumbnails[info.thumbnails.length - 1];
    if (last && typeof last.url === 'string') return last.url;
  }
  return null;
}

function mapFormat(f) {
  const hasVideo = Boolean(f.vcodec && f.vcodec !== 'none');
  const hasAudio = Boolean(f.acodec && f.acodec !== 'none');
  return {
    formatId: f.format_id ?? null,
    height: Number.isFinite(f.height) ? f.height : null,
    width: Number.isFinite(f.width) ? f.width : null,
    ext: f.ext ?? null,
    vcodec: hasVideo ? f.vcodec : null,
    acodec: hasAudio ? f.acodec : null,
    hasVideo,
    hasAudio,
    filesizeBytes: Number.isFinite(f.filesize) ? f.filesize : Number.isFinite(f.filesize_approx) ? f.filesize_approx : null,
    fps: Number.isFinite(f.fps) ? f.fps : null,
    tbr: Number.isFinite(f.tbr) ? f.tbr : null,
    isHls: typeof f.protocol === 'string' && f.protocol.includes('m3u8')
  };
}

// A YouTube video can be legitimately embedded via YouTube's own
// youtube-nocookie.com player — that's not stream extraction, it's the
// mechanism YouTube provides for embedding. Direct files / HLS manifests
// can be played back using the exact URL the user already has. Every other
// extractor (Vimeo, TikTok, ...) has no such generic legitimate embed path
// here, so preview is simply unavailable rather than attempting to play an
// extracted stream URL.
function resolvePreview(url, extractorKey) {
  if (extractorKey === 'YouTube') {
    const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
    if (match) return { kind: 'youtube-embed', videoId: match[1] };
  }
  if (/\.m3u8(\?|$)/i.test(url)) return { kind: 'hls', url };
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url)) return { kind: 'direct', url };
  return null;
}

export function analyzeUrl(rawUrl, ytDlpPath) {
  const url = validateUrl(rawUrl);

  return new Promise((resolve, reject) => {
    execFile(
      ytDlpPath,
      ['--no-playlist', '--no-warnings', '--no-color', '-J', url],
      { windowsHide: true, timeout: ANALYZE_TIMEOUT_MS, maxBuffer: MAX_BUFFER_BYTES },
      (err, stdout, stderr) => {
        if (err) {
          if (err.killed || err.signal) {
            reject(new Error('errors.network'));
            return;
          }
          reject(new Error(classifyError(stderr, err.code)));
          return;
        }
        let info;
        try {
          info = JSON.parse(stdout);
        } catch {
          reject(new Error('errors.network'));
          return;
        }

        try {
          const formats = (Array.isArray(info.formats) ? info.formats : [])
            .filter(isRealFormat)
            .map(mapFormat);

          const hasVideoOnly = formats.some((f) => f.hasVideo && !f.hasAudio);
          const hasAudioOnly = formats.some((f) => !f.hasVideo && f.hasAudio);
          const isLive = info.is_live === true || info.live_status === 'is_live' || info.live_status === 'is_upcoming';

          // yt-dlp's own casing ("Youtube", not "YouTube") — normalize just
          // this one since it's the only platform with a dedicated badge;
          // everything else is shown using yt-dlp's extractor name as-is
          // rather than maintaining a hard-coded site-name list.
          const rawExtractorKey = typeof info.extractor_key === 'string' ? info.extractor_key : null;
          const extractorKey = rawExtractorKey === 'Youtube' ? 'YouTube' : rawExtractorKey;

          // Many platforms (YouTube included) deliver formats over m3u8
          // internally — that's an implementation detail of how yt-dlp
          // fetches them, not something to show the user as "HLS Stream".
          // "hls" here means the user's own URL is a raw HLS manifest link
          // (the Generic extractor handling a bare .m3u8), matching what
          // the client-side quick-recognition badge already checks for.
          const isHls = (!extractorKey || extractorKey === 'Generic') && /\.m3u8(\?|#|$)/i.test(url);

          let type = 'unknown';
          if (isHls) type = 'hls';
          else if (formats.some((f) => f.hasVideo)) type = 'video';
          else if (formats.some((f) => f.hasAudio)) type = 'audio';

          resolve({
            supported: true,
            url,
            platform: extractorKey === 'Generic' || !extractorKey ? null : extractorKey,
            type,
            title: typeof info.title === 'string' ? info.title : null,
            uploader: typeof info.uploader === 'string' ? info.uploader : typeof info.channel === 'string' ? info.channel : null,
            thumbnail: pickThumbnail(info),
            description:
              typeof info.description === 'string' ? info.description.slice(0, MAX_DESCRIPTION_LENGTH) : null,
            duration: Number.isFinite(info.duration) ? info.duration : null,
            uploadDate: toIsoDate(info.upload_date),
            isLive,
            isHls,
            hasSeparateAudioVideo: hasVideoOnly && hasAudioOnly,
            formats,
            preview: resolvePreview(url, extractorKey)
          });
        } catch {
          reject(new Error('errors.network'));
        }
      }
    );
  });
}
