/**
 * Message Passing Utilities
 *
 * Centralized message types and helpers for communication between
 * extension components (inject ↔ content ↔ service worker).
 */

import type { ErrorCode } from '../core/types.js';

// ============================================
// Message Types
// ============================================

/** Message from inject script to content script (via window.postMessage) */
export interface InjectToContentMessage {
  type: 'LUMEN_REQUEST';
  id: number;
  payload: {
    method: string;
    params?: unknown;
  };
}

/** Response from content script to inject script (via window.postMessage) */
export interface ContentToInjectMessage {
  type: 'LUMEN_RESPONSE';
  id: number;
  payload: {
    result?: unknown;
    error?: string;
    errorCode?: ErrorCode;
  };
}

/** Message from content/popup to service worker (via chrome.runtime.sendMessage) */
export interface ExtensionMessage {
  method: string;
  params?: unknown;
}

/** Response from service worker */
export interface ExtensionResponse {
  result?: unknown;
  error?: string;
  errorCode?: ErrorCode;
}

// ============================================
// Type Guards
// ============================================

export function isLumenRequest(data: unknown): data is InjectToContentMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as InjectToContentMessage).type === 'LUMEN_REQUEST' &&
    typeof (data as InjectToContentMessage).id === 'number' &&
    typeof (data as InjectToContentMessage).payload === 'object'
  );
}

export function isLumenResponse(data: unknown): data is ContentToInjectMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as ContentToInjectMessage).type === 'LUMEN_RESPONSE' &&
    typeof (data as ContentToInjectMessage).id === 'number'
  );
}

// ============================================
// Message ID Generator
// ============================================

let messageIdCounter = 0;

export function generateMessageId(): number {
  return ++messageIdCounter;
}

// ============================================
// Inject Script Helpers
// ============================================

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const pendingRequests = new Map<number, PendingRequest>();

/** Send a request from inject script and wait for response */
export function sendToContentScript(
  method: string,
  params?: unknown,
  timeoutMs = 30000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = generateMessageId();

    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request timeout: ${method}`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout });

    const message: InjectToContentMessage = {
      type: 'LUMEN_REQUEST',
      id,
      payload: { method, params },
    };

    window.postMessage(message, '*');
  });
}

/** Handle response from content script (call this in inject script's message listener) */
export function handleContentResponse(data: ContentToInjectMessage): boolean {
  const pending = pendingRequests.get(data.id);
  if (!pending) return false;

  pendingRequests.delete(data.id);
  clearTimeout(pending.timeout);

  if (data.payload.error) {
    const error = new Error(data.payload.error);
    (error as Error & { code?: ErrorCode }).code = data.payload.errorCode;
    pending.reject(error);
  } else {
    pending.resolve(data.payload.result);
  }

  return true;
}

// ============================================
// Content Script Helpers
// ============================================

/** Forward a request from inject script to service worker */
export function forwardToServiceWorker(
  payload: ExtensionMessage
): Promise<ExtensionResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response: ExtensionResponse) => {
      resolve(response ?? { error: 'No response from service worker' });
    });
  });
}

/** Send response back to inject script */
export function sendToInjectScript(
  id: number,
  payload: ExtensionResponse
): void {
  const message: ContentToInjectMessage = {
    type: 'LUMEN_RESPONSE',
    id,
    payload,
  };
  window.postMessage(message, '*');
}

// ============================================
// Popup/Service Worker Helpers
// ============================================

/** Send message to service worker (for use in popup) */
export function sendToServiceWorker(
  method: string,
  params?: unknown
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ method, params }, (response: ExtensionResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        const error = new Error(response.error);
        (error as Error & { code?: ErrorCode }).code = response.errorCode;
        reject(error);
      } else {
        resolve(response?.result ?? response);
      }
    });
  });
}

// ============================================
// Debug Logging
// ============================================

const DEBUG = true;

export function logMessage(
  direction: 'send' | 'receive',
  from: string,
  to: string,
  data: unknown
): void {
  if (!DEBUG) return;
  const arrow = direction === 'send' ? '→' : '←';
  console.log(`[Lumen] ${from} ${arrow} ${to}:`, data);
}
