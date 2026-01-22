/**
 * Content Script
 *
 * Runs in the context of web pages. Bridges communication between:
 * - Injected script (window.midnight API) via window.postMessage
 * - Service worker via chrome.runtime messaging
 */

console.log('[Lumen] Content script loaded');

// Inject the dApp connector script into the page
function injectScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.type = 'module';
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

// Listen for messages from the injected script
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  // Only handle Lumen messages
  if (event.data?.type !== 'LUMEN_REQUEST') return;

  console.log('[Lumen] Content received message:', event.data);

  // Forward to service worker
  chrome.runtime.sendMessage(event.data.payload, (response) => {
    // Send response back to injected script
    window.postMessage(
      {
        type: 'LUMEN_RESPONSE',
        id: event.data.id,
        payload: response,
      },
      '*'
    );
  });
});

// Inject on load
injectScript();
