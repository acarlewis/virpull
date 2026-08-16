// Deliberately vanilla, dependency-free — this window exists purely to
// paint instantly, so it never imports Vue/Pinia/anything from the main
// renderer bundle. All real progress comes from the main process via
// window.splashApi (see src/preload/splash-preload.js); nothing here is
// simulated or timed to "look" like progress.

const statusEl = document.getElementById('status');
const normalState = document.getElementById('normal-state');
const errorState = document.getElementById('error-state');
const errorMessageEl = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const closeBtn = document.getElementById('close-btn');

let currentLabel = statusEl.textContent;

function setStatus(label) {
  if (label === currentLabel) return;
  currentLabel = label;
  statusEl.classList.add('swapping');
  window.setTimeout(() => {
    statusEl.textContent = label;
    statusEl.classList.remove('swapping');
  }, 140);
}

function showError(message) {
  normalState.hidden = true;
  errorState.hidden = false;
  if (message) errorMessageEl.textContent = message;
}

function showNormal() {
  errorState.hidden = true;
  normalState.hidden = false;
}

// Tell the main process we're actually able to receive status updates now
// — see splashWindow.js's sendSplashStatus, which buffers until this fires
// so a fast startup can't send messages into the void before we're listening.
window.splashApi?.notifyListenerReady();

window.splashApi?.onStatus((payload) => {
  if (!payload) return;
  if (payload.state === 'error') {
    showError(payload.label);
    return;
  }
  if (payload.state === 'leaving') {
    document.body.classList.add('leaving');
    return;
  }
  showNormal();
  if (payload.label) setStatus(payload.label);
});

retryBtn?.addEventListener('click', () => {
  showNormal();
  setStatus('Starting VirPull…');
  window.splashApi?.retry();
});

closeBtn?.addEventListener('click', () => {
  window.splashApi?.close();
});
