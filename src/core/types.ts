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
  rpcUrl: string;
}

export const NETWORKS: Record<Exclude<NetworkId, 'custom'>, NetworkConfig> = {
  localnet: {
    id: 'localnet',
    name: 'Localnet',
    rpcUrl: 'http://localhost:9944',
  },
  devnet: {
    id: 'devnet',
    name: 'DevNet',
    rpcUrl: 'https://rpc.devnet.midnight.network',
  },
  qanet: {
    id: 'qanet',
    name: 'QANET',
    rpcUrl: 'https://rpc.qanet.midnight.network',
  },
  preview: {
    id: 'preview',
    name: 'Preview',
    rpcUrl: 'https://rpc.preview.midnight.network',
  },
  preprod: {
    id: 'preprod',
    name: 'PreProd',
    rpcUrl: 'https://rpc.preprod.midnight.network',
  },
};

// Wallet state
export interface WalletState {
  hasWallet: boolean;
  address?: string;
  balance?: string;
  network: NetworkId;
  customRpcUrl?: string;
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

// dApp connector types (aligned with dapp-connector-api)
export interface EnableResult {
  enabled: boolean;
  address: string;
}

export interface NetworkInfo {
  rpcUrl: string;
  networkId: string;
}
