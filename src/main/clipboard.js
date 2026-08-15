import { clipboard } from 'electron';

const POLL_INTERVAL_MS = 1500;
const MAX_CLIPBOARD_TEXT_LENGTH = 2048;

// Cheap, main-process-local check for "this looks like a URL we could act
// on" — mirrors the renderer's quickRecognize() heuristic but stays
// independent of it (no cross-process coupling needed for a one-line check).
// Anything that fails this is never inspected further or retained.
function looksLikeSupportedUrl(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_CLIPBOARD_TEXT_LENGTH) return false;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

// Polls the system clipboard for supported-looking video URLs while the app
// is open. Never persists or transmits clipboard content: the only state
// kept in memory is the last raw clipboard text (to detect changes and
// avoid re-notifying for content that hasn't changed) and, transiently,
// whichever URL was last handed to onUrlDetected.
export class ClipboardWatcher {
  constructor({ onUrlDetected, isEnabled }) {
    this.onUrlDetected = onUrlDetected;
    this.isEnabled = isEnabled;
    this.lastRawText = null;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  _poll() {
    if (!this.isEnabled()) return;
    let text;
    try {
      text = clipboard.readText();
    } catch {
      return;
    }
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed === this.lastRawText) return;
    this.lastRawText = trimmed;
    if (!looksLikeSupportedUrl(trimmed)) return;
    this.onUrlDetected(trimmed);
  }
}
