import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, fr, nl }
});

// Main-process error/status "messages" are actually i18n keys (see the
// comment in src/main/downloader.js). Known keys get translated; anything
// else (yt-dlp's own raw English stderr, used as a last resort) is shown
// verbatim since it can't be looked up.
export function translateMessage(key) {
  if (!key) return '';
  return i18n.global.te(key) ? i18n.global.t(key) : key;
}

// Errors thrown from an ipcMain.handle() rejection arrive with a message
// like "Error invoking remote method 'x': Error: <key>" — strip that
// wrapper before treating the remainder as a translatable key.
export function translateIpcError(err, fallbackKey) {
  const cleaned = err?.message
    ?.replace(/^Error invoking remote method '.*?': ?/, '')
    ?.replace(/^[A-Za-z]*Error: ?/, '');
  return cleaned ? translateMessage(cleaned) : translateMessage(fallbackKey);
}
