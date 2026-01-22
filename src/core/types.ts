/**
 * Shared Types
 *
 * Types used across all extension components.
 */

// Network configuration
export type NetworkId = 'localnet' | 'devnet' | 'qanet' | 'preview' | 'preprod' | 'custom';

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  /** Substrate node RPC URL */
  nodeUrl: string;
  /** Indexer HTTP URL for queries */
  indexerUrl: string;
  /** Indexer WebSocket URL for subscriptions */
  indexerWsUrl: string;
  /** Prover server URL for ZK proof generation */
  proverUrl: string;
}

export const NETWORKS: Record<Exclude<NetworkId, 'custom'>, NetworkConfig> = {
  localnet: {
    id: 'localnet',
    name: 'Localnet',
    nodeUrl: 'http://localhost:9944',
    indexerUrl: 'http://localhost:8088/api/v3/graphql',
    indexerWsUrl: 'ws://localhost:8088/api/v3/graphql/ws',
    proverUrl: 'http://localhost:6300',
  },
  devnet: {
    id: 'devnet',
    name: 'DevNet',
    nodeUrl: 'wss://rpc.devnet.midnight.network',
    indexerUrl: 'https://indexer.devnet.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.devnet.midnight.network/api/v3/graphql/ws',
    proverUrl: 'https://prover.devnet.midnight.network',
  },
  qanet: {
    id: 'qanet',
    name: 'QANET',
    nodeUrl: 'wss://rpc.qanet.midnight.network',
    indexerUrl: 'https://indexer.qanet.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.qanet.midnight.network/api/v3/graphql/ws',
    proverUrl: 'https://prover.qanet.midnight.network',
  },
  preview: {
    id: 'preview',
    name: 'Preview',
    nodeUrl: 'wss://rpc.preview.midnight.network',
    indexerUrl: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    proverUrl: 'https://prover.preview.midnight.network',
  },
  preprod: {
    id: 'preprod',
    name: 'PreProd',
    nodeUrl: 'wss://rpc.preprod.midnight.network',
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    proverUrl: 'https://prover.preprod.midnight.network',
  },
};

// Wallet state
export interface WalletState {
  hasWallet: boolean;
  address?: string;
  balance?: string;
  network: NetworkId;
  /** Custom network URLs (only used when network === 'custom') */
  customUrls?: {
    nodeUrl?: string;
    indexerUrl?: string;
    indexerWsUrl?: string;
    proverUrl?: string;
  };
}

// Message types for extension communication
export interface LumenRequest {
  method: string;
  params?: unknown;
}

export interface LumenResponse {
  result?: unknown;
  error?: string;
  errorCode?: ErrorCode;
}

// Standardized error codes
export type ErrorCode =
  | 'NO_WALLET'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'INVALID_TX'
  | 'USER_REJECTED'
  | 'INVALID_INPUT'
  | 'UNKNOWN_ERROR';

export class LumenError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode
  ) {
    super(message);
    this.name = 'LumenError';
  }
}

// Prefunded localnet wallet seeds (genesis mint wallets from testkit-js)
export const LOCALNET_SEEDS: Record<string, string> = {
  'wallet-0': '0000000000000000000000000000000000000000000000000000000000000001',
  'wallet-1': '0000000000000000000000000000000000000000000000000000000000000002',
  'wallet-2': '0000000000000000000000000000000000000000000000000000000000000003',
  'wallet-3': '0000000000000000000000000000000000000000000000000000000000000004',
};

// dApp connector types (aligned with dapp-connector-api)
export interface EnableResult {
  enabled: boolean;
  address: string;
}

export interface NetworkInfo {
  rpcUrl: string;
  networkId: string;
}
