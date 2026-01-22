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
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  NETWORK_ID: 'lumen_network_id',
  CUSTOM_RPC_URL: 'lumen_custom_rpc_url',
} as const;

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
 * Returns network status including block height and chain info.
 */
export async function testConnection(rpcUrl: string): Promise<NetworkStatus> {
  const startTime = Date.now();

  try {
    const api = await getApi(rpcUrl);

    // Get chain info
    const [chain, version, chainType, header] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.version(),
      api.rpc.system.chainType(),
      api.rpc.chain.getHeader(),
    ]);

    const latency = Date.now() - startTime;

    return {
      connected: true,
      blockHeight: header.number.toNumber(),
      chainInfo: {
        name: chain.toString(),
        version: version.toString(),
        chainType: chainType.toString(),
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
 * Uses Substrate's system.account storage.
 */
export async function queryBalance(
  rpcUrl: string,
  address: string
): Promise<BalanceInfo> {
  try {
    const api = await getApi(rpcUrl);

    // Query the account info from the system pallet
    const accountInfo = await api.query.system.account(address);

    // Extract balance data (structure may vary by chain)
    const data = accountInfo.data;
    const free = data.free.toString();
    const reserved = data.reserved.toString();
    const total = (BigInt(free) + BigInt(reserved)).toString();

    return { free, reserved, total };
  } catch (error) {
    // If query fails (e.g., invalid address format), return zero balance
    console.warn('[Network] Balance query failed:', error);
    return {
      free: '0',
      reserved: '0',
      total: '0',
    };
  }
}

// ============================================
// Storage Operations
// ============================================

/**
 * Save network configuration to chrome.storage.
 */
export async function saveNetworkConfig(networkId: NetworkId, customRpcUrl?: string): Promise<void> {
  const data: Record<string, string> = {
    [STORAGE_KEYS.NETWORK_ID]: networkId,
  };

  if (customRpcUrl) {
    data[STORAGE_KEYS.CUSTOM_RPC_URL] = customRpcUrl;
  }

  await chrome.storage.local.set(data);
}

/**
 * Load network configuration from chrome.storage.
 */
export async function loadNetworkConfig(): Promise<{
  networkId: NetworkId;
  customRpcUrl?: string;
}> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.NETWORK_ID, STORAGE_KEYS.CUSTOM_RPC_URL]);

  return {
    networkId: (data[STORAGE_KEYS.NETWORK_ID] as NetworkId) || 'devnet',
    customRpcUrl: data[STORAGE_KEYS.CUSTOM_RPC_URL],
  };
}

/**
 * Clear network configuration from chrome.storage.
 */
export async function clearNetworkConfig(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.NETWORK_ID, STORAGE_KEYS.CUSTOM_RPC_URL]);
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

/**
 * Validate a custom RPC URL.
 */
export function isValidRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'ws:' ||
      parsed.protocol === 'wss:'
    );
  } catch {
    return false;
  }
}
