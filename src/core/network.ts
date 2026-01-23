/**
 * Network Layer
 *
 * Handles RPC communication with Midnight nodes using @polkadot/api,
 * which is the same approach used by the wallet-sdk-node-client.
 */

import { ApiPromise, WsProvider, HttpProvider } from '@polkadot/api';
import { type NetworkId, type NetworkConfig, NETWORKS, LumenError } from './types.js';

// ============================================
// Types
// ============================================

export interface ChainInfo {
  name: string;
  version: string;
  chainType: string;
}

export interface NetworkStatus {
  connected: boolean;
  blockHeight?: number;
  chainInfo?: ChainInfo;
  latency?: number;
  error?: string;
}

export interface BalanceInfo {
  free: string;
  reserved: string;
  total: string;
}

// ============================================
// Health Check Types
// ============================================

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceHealth {
  /** Current service status */
  status: ServiceStatus;
  /** Response latency in ms (if available) */
  latency: number | null;
  /** ISO timestamp of last successful check */
  lastChecked: string | null;
  /** Error message if unhealthy */
  error: string | null;
}

export interface HealthCheckResult {
  /** Whether the check succeeded */
  success: boolean;
  /** Response latency in ms */
  latency: number;
  /** Error message if failed */
  error?: string;
  /** Additional data from the check */
  data?: Record<string, unknown>;
}

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  NETWORK_ID: 'lumen_network_id',
  CUSTOM_RPC_URL: 'lumen_custom_rpc_url',
  CONFIG_CHECKSUM: 'lumen_config_checksum',
} as const;

// ============================================
// Integrity Verification
// ============================================

/**
 * Compute a SHA-256 checksum for network config data.
 * Uses extension ID as salt to prevent cross-extension tampering.
 */
async function computeConfigChecksum(networkId: string, customRpcUrl?: string): Promise<string> {
  const extensionId = chrome.runtime?.id || 'lumen-wallet';
  const data = `${extensionId}:${networkId}:${customRpcUrl || ''}`;

  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify network config integrity.
 * Returns true if checksum matches, false otherwise.
 */
async function verifyConfigIntegrity(
  networkId: string,
  customRpcUrl: string | undefined,
  storedChecksum: string
): Promise<boolean> {
  const computedChecksum = await computeConfigChecksum(networkId, customRpcUrl);
  return computedChecksum === storedChecksum;
}

// ============================================
// API Connection Cache
// ============================================

let cachedApi: ApiPromise | null = null;
let cachedRpcUrl: string | null = null;

/**
 * Get or create a Polkadot API connection.
 * Uses caching to avoid reconnecting for every request.
 */
async function getApi(rpcUrl: string): Promise<ApiPromise> {
  // Return cached API if URL matches
  if (cachedApi && cachedRpcUrl === rpcUrl && cachedApi.isConnected) {
    return cachedApi;
  }

  // Disconnect existing API if URL changed
  if (cachedApi) {
    await cachedApi.disconnect();
    cachedApi = null;
    cachedRpcUrl = null;
  }

  // Create provider based on URL protocol
  const url = new URL(rpcUrl);
  const provider = url.protocol === 'ws:' || url.protocol === 'wss:'
    ? new WsProvider(rpcUrl)
    : new HttpProvider(rpcUrl);

  // Create and cache API
  cachedApi = await ApiPromise.create({ provider });
  cachedRpcUrl = rpcUrl;

  return cachedApi;
}

/**
 * Disconnect the cached API connection.
 */
export async function disconnectApi(): Promise<void> {
  if (cachedApi) {
    await cachedApi.disconnect();
    cachedApi = null;
    cachedRpcUrl = null;
  }
}

// ============================================
// Network Operations
// ============================================

export interface NetworkUrls {
  nodeUrl: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proverUrl: string;
}

/**
 * Get all network URLs for a network.
 */
export function getNetworkUrls(
  networkId: NetworkId,
  customUrls?: Partial<NetworkUrls>
): NetworkUrls {
  if (networkId === 'custom') {
    if (!customUrls?.nodeUrl) {
      throw new LumenError('Custom network requires a node URL', 'INVALID_INPUT');
    }
    return {
      nodeUrl: customUrls.nodeUrl,
      indexerUrl: customUrls.indexerUrl || customUrls.nodeUrl.replace(':9944', ':8088'),
      indexerWsUrl: customUrls.indexerWsUrl || customUrls.nodeUrl.replace('http', 'ws').replace(':9944', ':8088'),
      proverUrl: customUrls.proverUrl || customUrls.nodeUrl.replace(':9944', ':6300'),
    };
  }
  return NETWORKS[networkId];
}

/**
 * Get the node RPC URL for a network.
 */
export function getRpcUrl(networkId: NetworkId, customNodeUrl?: string): string {
  if (networkId === 'custom') {
    if (!customNodeUrl) {
      throw new LumenError('Custom network requires a node URL', 'INVALID_INPUT');
    }
    return customNodeUrl;
  }
  return NETWORKS[networkId].nodeUrl;
}

/**
 * Test connection to a Midnight node.
 * Uses HTTP health endpoint for fast, reliable checks.
 */
export async function testConnection(rpcUrl: string): Promise<NetworkStatus> {
  const startTime = Date.now();

  try {
    // Convert WS URL to HTTP for health check
    const httpUrl = rpcUrl
      .replace('wss://', 'https://')
      .replace('ws://', 'http://');

    // Use health endpoint for quick check
    const healthResponse = await fetch(`${httpUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }

    const health = await healthResponse.json();

    // Get block height via RPC
    const rpcResponse = await fetch(httpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'chain_getHeader',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const rpcData = await rpcResponse.json();
    const blockHeight = rpcData.result?.number
      ? parseInt(rpcData.result.number, 16)
      : undefined;

    const latency = Date.now() - startTime;

    return {
      connected: true,
      blockHeight,
      chainInfo: {
        name: 'Midnight',
        version: 'unknown',
        chainType: health.isSyncing ? 'syncing' : 'ready',
      },
      latency,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Query account balance from the chain.
 * Note: Balance queries are limited in dev wallet - returns 0 for now.
 * Full balance tracking requires wallet-sdk integration with proper address formats.
 */
export async function queryBalance(
  _rpcUrl: string,
  _address: string
): Promise<BalanceInfo> {
  // Developer wallet uses simplified address format (mn_loc_xxx)
  // Full balance queries require wallet-sdk with proper Midnight address encoding
  // For now, return 0 - this is acceptable for a dev/testing wallet
  console.log('[Network] Balance query skipped - dev wallet limitation');
  return {
    free: '0',
    reserved: '0',
    total: '0',
  };
}

// ============================================
// Storage Operations
// ============================================

/**
 * Save network configuration to chrome.storage with integrity checksum.
 */
export async function saveNetworkConfig(networkId: NetworkId, customRpcUrl?: string): Promise<void> {
  // Compute integrity checksum
  const checksum = await computeConfigChecksum(networkId, customRpcUrl);

  const data: Record<string, string> = {
    [STORAGE_KEYS.NETWORK_ID]: networkId,
    [STORAGE_KEYS.CONFIG_CHECKSUM]: checksum,
  };

  if (customRpcUrl) {
    data[STORAGE_KEYS.CUSTOM_RPC_URL] = customRpcUrl;
  }

  await chrome.storage.local.set(data);
}

/**
 * Load network configuration from chrome.storage with integrity verification.
 * Falls back to safe defaults if integrity check fails.
 */
export async function loadNetworkConfig(): Promise<{
  networkId: NetworkId;
  customRpcUrl?: string;
}> {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.NETWORK_ID,
    STORAGE_KEYS.CUSTOM_RPC_URL,
    STORAGE_KEYS.CONFIG_CHECKSUM,
  ]);

  const networkId = data[STORAGE_KEYS.NETWORK_ID] as NetworkId | undefined;
  const customRpcUrl = data[STORAGE_KEYS.CUSTOM_RPC_URL] as string | undefined;
  const storedChecksum = data[STORAGE_KEYS.CONFIG_CHECKSUM] as string | undefined;

  // If no config stored, return defaults
  if (!networkId) {
    return { networkId: 'devnet' };
  }

  // Verify integrity if checksum exists
  if (storedChecksum) {
    const isValid = await verifyConfigIntegrity(networkId, customRpcUrl, storedChecksum);
    if (!isValid) {
      // Integrity check failed - possible tampering
      // Clear the compromised config and return safe defaults
      console.warn('[Lumen] Network config integrity check failed - resetting to defaults');
      await clearNetworkConfig();
      return { networkId: 'devnet' };
    }
  }

  return {
    networkId: networkId || 'devnet',
    customRpcUrl,
  };
}

/**
 * Clear network configuration from chrome.storage.
 */
export async function clearNetworkConfig(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.NETWORK_ID,
    STORAGE_KEYS.CUSTOM_RPC_URL,
    STORAGE_KEYS.CONFIG_CHECKSUM,
  ]);
}

// ============================================
// Network Presets
// ============================================

/**
 * Get all available network presets.
 */
export function getNetworkPresets(): NetworkConfig[] {
  return Object.values(NETWORKS);
}

/**
 * Get a specific network preset by ID.
 */
export function getNetworkPreset(networkId: Exclude<NetworkId, 'custom'>): NetworkConfig {
  return NETWORKS[networkId];
}

/** Maximum allowed URL length */
const MAX_URL_LENGTH = 2048;

/** Private/internal IP patterns that should be blocked in production */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                    // Loopback
  /^10\./,                     // Class A private
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // Class B private
  /^192\.168\./,               // Class C private
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^::1$/,                     // IPv6 loopback
  /^fc00:/i,                   // IPv6 unique local
  /^fe80:/i,                   // IPv6 link-local
];

/** Hostnames that should be blocked */
const BLOCKED_HOSTNAMES = ['localhost', 'localhost.localdomain'];

/**
 * Check if a hostname is a private/internal address.
 * Note: For development, localhost is allowed when network is 'localnet'.
 */
function isPrivateHost(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(lowerHost)) {
    return true;
  }

  // Check IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a custom RPC URL.
 * Checks protocol, URL length, and optionally blocks private IPs.
 * @param url - The URL to validate
 * @param allowPrivate - Whether to allow private/localhost addresses (default: true for dev wallet)
 */
export function isValidRpcUrl(url: string, allowPrivate = true): boolean {
  try {
    // Check URL length
    if (url.length > MAX_URL_LENGTH) {
      return false;
    }

    const parsed = new URL(url);

    // Check protocol
    const validProtocol =
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'ws:' ||
      parsed.protocol === 'wss:';

    if (!validProtocol) {
      return false;
    }

    // Check for private IPs (if not allowed)
    if (!allowPrivate && isPrivateHost(parsed.hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================
// Health Check Functions
// ============================================

const HEALTH_CHECK_TIMEOUT = 5000;
const MAX_RESPONSE_SIZE = 1024 * 100; // 100KB max response size

/**
 * Fetch with response size limit to prevent slow-loris and large payload attacks.
 * Reads the response in chunks and aborts if size exceeds limit.
 */
async function safeFetch(
  url: string,
  options: RequestInit,
  maxSize = MAX_RESPONSE_SIZE
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> }> {
  const response = await fetch(url, options);

  // Check Content-Length header if available
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new Error(`Response too large: ${contentLength} bytes`);
  }

  // Read response with size limit
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalSize += value.length;
    if (totalSize > maxSize) {
      reader.cancel();
      throw new Error(`Response exceeded size limit of ${maxSize} bytes`);
    }
    chunks.push(value);
  }

  // Combine chunks into text
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder().decode(combined);

  return {
    ok: response.ok,
    status: response.status,
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

/**
 * Check node health via /health endpoint and RPC call.
 * Uses safeFetch to limit response sizes.
 */
export async function checkNodeHealth(nodeUrl: string): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Convert WS URL to HTTP for health check
    const httpUrl = nodeUrl
      .replace('wss://', 'https://')
      .replace('ws://', 'http://');

    // Check /health endpoint with size limit
    const healthResponse = await safeFetch(`${httpUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
    });

    if (!healthResponse.ok) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: `Health endpoint returned ${healthResponse.status}`,
      };
    }

    const health = await healthResponse.json();

    // Also verify RPC is responding with size limit
    const rpcResponse = await safeFetch(httpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'system_health',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
    });

    if (!rpcResponse.ok) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: `RPC returned ${rpcResponse.status}`,
      };
    }

    const rpcData = await rpcResponse.json();
    const latency = Date.now() - startTime;

    return {
      success: true,
      latency,
      data: {
        isSyncing: (health as Record<string, unknown>).isSyncing ?? (rpcData as Record<string, unknown>).result,
        peers: ((rpcData as Record<string, unknown>).result as Record<string, unknown>)?.peers,
      },
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check indexer health via HTTP GraphQL endpoint.
 * Uses safeFetch to limit response sizes.
 */
export async function checkIndexerHealth(indexerHttpUrl: string): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Simple GraphQL introspection query to verify indexer is responding
    const response = await safeFetch(indexerHttpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ __typename }',
      }),
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        latency,
        error: `Indexer returned ${response.status}`,
      };
    }

    const data = (await response.json()) as { errors?: Array<{ message?: string }>; data?: { __typename?: string } };

    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      return {
        success: false,
        latency,
        error: data.errors[0].message || 'GraphQL error',
      };
    }

    return {
      success: true,
      latency,
      data: { typename: data.data?.__typename },
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check prover health via /version endpoint.
 * Uses safeFetch to limit response sizes.
 */
export async function checkProverHealth(proverUrl: string): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Prover exposes /version endpoint with size limit
    const response = await safeFetch(`${proverUrl}/version`, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        latency,
        error: `Prover returned ${response.status}`,
      };
    }

    const version = await response.text();

    return {
      success: true,
      latency,
      data: { version: version.trim() },
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
