/**
 * Injected Script
 *
 * Runs in the page context (not extension context).
 * Exposes window.midnight API for dApps to interact with Lumen.
 */

console.log('[Lumen] Injecting window.midnight API');

// Message ID counter for request/response matching
let messageId = 0;

// Pending requests waiting for responses
const pendingRequests = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

// Listen for responses from content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'LUMEN_RESPONSE') return;

  const pending = pendingRequests.get(event.data.id);
  if (pending) {
    pendingRequests.delete(event.data.id);
    if (event.data.payload?.error) {
      pending.reject(new Error(event.data.payload.error));
    } else {
      pending.resolve(event.data.payload);
    }
  }
});

// Send request to content script and wait for response
function sendRequest(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, { resolve, reject });

    window.postMessage(
      {
        type: 'LUMEN_REQUEST',
        id,
        payload: { method, params },
      },
      '*'
    );

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

// Define the window.midnight API
const midnightApi = {
  // Identifies this as Lumen wallet
  isLumen: true,

  // Connect to the wallet
  enable: () => sendRequest('enable'),

  // Disconnect from the wallet
  disable: () => sendRequest('disable'),

  // Check if connected
  isEnabled: () => sendRequest('isEnabled'),

  // Get wallet address
  getAddress: () => sendRequest('getAddress'),

  // Get DUST balance
  getBalance: () => sendRequest('getBalance'),

  // Sign a transaction
  signTransaction: (tx: unknown) => sendRequest('signTransaction', { tx }),

  // Sign an arbitrary message
  signMessage: (message: string) => sendRequest('signMessage', { message }),

  // Get network configuration
  getNetwork: () => sendRequest('getNetwork'),
};

// Expose on window
declare global {
  interface Window {
    midnight?: typeof midnightApi;
  }
}

window.midnight = midnightApi;

console.log('[Lumen] window.midnight API ready');
