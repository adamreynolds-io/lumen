/**
 * Content Script
 *
 * Runs in the context of web pages. Bridges communication between:
 * - Injected script (window.midnight API) via window.postMessage
 * - Service worker via chrome.runtime messaging
 *
 * Security: Validates origin before processing dApp requests.
 */

import {
  isLumenRequest,
  forwardToServiceWorker,
  sendToInjectScript,
  logMessage,
} from '../lib/messaging.js';

// Conditional logging - disabled in production
const IS_DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
function devLog(...args: unknown[]): void {
  if (IS_DEV) console.log('[Lumen]', ...args);
}

devLog('Content script loaded');

// ============================================
// Origin Validation
// ============================================

/** Origins that have been approved by the user */
const approvedOrigins = new Set<string>();

/** Methods that don't require prior approval (used to request connection) */
const PUBLIC_METHODS = ['connect', 'isConnected', 'getState'];

/** Dangerous protocols that should never be allowed */
const BLOCKED_PROTOCOLS = ['data:', 'blob:', 'file:', 'javascript:'];

/**
 * Check if an origin is safe (not a dangerous protocol).
 * Rejects data:, blob:, file:, and javascript: origins.
 */
function isSafeOrigin(origin: string): boolean {
  if (!origin || origin === 'null') {
    return false;
  }

  // Check for blocked protocols
  const lowerOrigin = origin.toLowerCase();
  for (const protocol of BLOCKED_PROTOCOLS) {
    if (lowerOrigin.startsWith(protocol)) {
      return false;
    }
  }

  // Must be http or https
  if (!lowerOrigin.startsWith('http://') && !lowerOrigin.startsWith('https://')) {
    return false;
  }

  return true;
}

/** Check if an origin is approved or method is public */
function isRequestAllowed(origin: string, method: string): boolean {
  // Public methods are always allowed (they request permission)
  if (PUBLIC_METHODS.includes(method)) {
    return true;
  }
  // Other methods require approved origin
  return approvedOrigins.has(origin);
}

/** Approve an origin (called when user grants permission) */
function approveOrigin(origin: string): void {
  approvedOrigins.add(origin);
  devLog('Origin approved');
}

// ============================================
// Script Injection
// ============================================

function injectScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.type = 'module';
  script.onload = () => {
    script.remove();
    devLog('Inject script loaded into page');
  };
  script.onerror = (e) => {
    console.error('[Lumen] Failed to load inject script:', e);
  };
  (document.head || document.documentElement).appendChild(script);
}

// ============================================
// Message Handling
// ============================================

// Listen for messages from the injected script
window.addEventListener('message', async (event) => {
  // Security: Only accept messages from the same window
  if (event.source !== window) return;

  // Security: Validate origin matches current page
  const origin = event.origin || window.location.origin;
  if (event.origin && event.origin !== window.location.origin) {
    // Message from different origin (e.g., iframe) - reject
    return;
  }

  // Security: Reject dangerous protocols
  if (!isSafeOrigin(origin)) {
    if (IS_DEV) console.warn('[Lumen] Request blocked - unsafe origin protocol');
    return;
  }

  // Only handle Lumen requests
  if (!isLumenRequest(event.data)) return;

  const { id, payload } = event.data;
  const method = payload.method;

  logMessage('receive', 'inject', 'content', { origin, ...payload });

  // Security: Check if request is allowed
  if (!isRequestAllowed(origin, method)) {
    if (IS_DEV) console.warn('[Lumen] Request blocked - origin not approved');
    sendToInjectScript(id, {
      error: 'Origin not connected. Call connect() first.',
      errorCode: 'NOT_CONNECTED',
    });
    return;
  }

  // Forward to service worker with origin info
  const response = await forwardToServiceWorker({
    ...payload,
    _origin: origin, // Include origin for service worker to track
  });
  logMessage('receive', 'service-worker', 'content', response);

  // If this was a successful connect, approve the origin
  if (method === 'connect' && !response.error) {
    approveOrigin(origin);
  }

  // Send response back to injected script
  sendToInjectScript(id, response);
  logMessage('send', 'content', 'inject', response);
});

// Inject on load
injectScript();
