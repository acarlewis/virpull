import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { i18n } from './i18n';
import './style.css';

createApp(App).use(createPinia()).use(i18n).mount('#app');

// The window itself stays hidden (see main.js's createMainWindow) until
// the splash hands off, so this only needs to cover the brief gap between
// first paint and Vue actually mounting — not coordinate with the splash.
requestAnimationFrame(() => document.body.classList.add('app-ready'));
