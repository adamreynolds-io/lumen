/**
 * Content Script
 *
 * Runs in the context of web pages. Bridges communication between:
 * - Injected script (window.midnight API) via window.postMessage
 * - Service worker via chrome.runtime messaging
 */

import {
  isLumenRequest,
  forwardToServiceWorker,
  sendToInjectScript,
  logMessage,
} from '../lib/messaging.js';

console.log('[Lumen] Content script loaded');

// Inject the dApp connector script into the page
function injectScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.type = 'module';
  script.onload = () => {
    script.remove();
    console.log('[Lumen] Inject script loaded into page');
  };
  script.onerror = (e) => {
    console.error('[Lumen] Failed to load inject script:', e);
  };
  (document.head || document.documentElement).appendChild(script);
}

// Listen for messages from the injected script
window.addEventListener('message', async (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  // Only handle Lumen requests
  if (!isLumenRequest(event.data)) return;

  const { id, payload } = event.data;
  logMessage('receive', 'inject', 'content', payload);

  // Forward to service worker
  const response = await forwardToServiceWorker(payload);
  logMessage('receive', 'service-worker', 'content', response);

  // Send response back to injected script
  sendToInjectScript(id, response);
  logMessage('send', 'content', 'inject', response);
});

// Inject on load
injectScript();
