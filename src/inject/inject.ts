/**
 * Injected Script
 *
 * Runs in the page context (not extension context).
 * Exposes window.midnight API for dApps to interact with Lumen.
 *
 * Note: This script cannot import from other extension modules directly
 * because it runs in the page context. Message types are duplicated here.
 */

console.log('[Lumen] Injecting window.midnight API');

// ============================================
// Message Handling (duplicated from messaging.ts for isolation)
// ============================================

interface LumenRequest {
  type: 'LUMEN_REQUEST';
  id: number;
  payload: { method: string; params?: unknown };
}

interface LumenResponse {
  type: 'LUMEN_RESPONSE';
  id: number;
  payload: { result?: unknown; error?: string; errorCode?: string };
}

let messageId = 0;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const pendingRequests = new Map<number, PendingRequest>();

// Listen for responses from content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'LUMEN_RESPONSE') return;

  const response = event.data as LumenResponse;
  const pending = pendingRequests.get(response.id);

  if (pending) {
    pendingRequests.delete(response.id);

    if (response.payload?.error) {
      const error = new Error(response.payload.error);
      (error as Error & { code?: string }).code = response.payload.errorCode;
      pending.reject(error);
    } else {
      pending.resolve(response.payload?.result);
    }
  }
});

// Send request to content script and wait for response
function sendRequest(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, { resolve, reject });

    const request: LumenRequest = {
      type: 'LUMEN_REQUEST',
      id,
      payload: { method, params },
    };

    window.postMessage(request, '*');

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }
    }, 30000);
  });
}

// ============================================
// window.midnight API
// ============================================

const midnightApi = {
  /** Identifies this as Lumen wallet */
  isLumen: true as const,

  /** Connect to the wallet */
  enable: (): Promise<{ enabled: boolean; address: string }> =>
    sendRequest('enable') as Promise<{ enabled: boolean; address: string }>,

  /** Disconnect from the wallet */
  disable: (): Promise<{ success: boolean }> =>
    sendRequest('disable') as Promise<{ success: boolean }>,

  /** Check if connected */
  isEnabled: (): Promise<boolean> =>
    sendRequest('isEnabled') as Promise<boolean>,

  /** Get wallet address */
  getAddress: (): Promise<string> =>
    sendRequest('getAddress') as Promise<string>,

  /** Get DUST balance */
  getBalance: (): Promise<string> =>
    sendRequest('getBalance') as Promise<string>,

  /** Sign a transaction */
  signTransaction: (tx: unknown): Promise<{ signedTx: string }> =>
    sendRequest('signTransaction', { tx }) as Promise<{ signedTx: string }>,

  /** Sign an arbitrary message */
  signMessage: (message: string): Promise<{ signature: string }> =>
    sendRequest('signMessage', { message }) as Promise<{ signature: string }>,

  /** Get network configuration */
  getNetwork: (): Promise<{ rpcUrl: string; networkId: string }> =>
    sendRequest('getNetwork') as Promise<{ rpcUrl: string; networkId: string }>,
};

// Expose on window
declare global {
  interface Window {
    midnight?: typeof midnightApi;
  }
}

window.midnight = midnightApi;

console.log('[Lumen] window.midnight API ready');

// Dispatch event to notify page that API is ready
window.dispatchEvent(new CustomEvent('midnight#ready'));
