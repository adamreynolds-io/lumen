/**
 * Service Worker (Background Script)
 *
 * The source of truth for wallet state. Handles:
 * - Wallet generation and import
 * - Key storage (in-memory only)
 * - Transaction signing
 * - Network communication
 */

import {
  createWallet,
  importFromMnemonic,
  importFromPrivateKey,
  signMessage,
  signTransaction,
  type WalletKeys,
  type WalletInfo,
} from '../core/wallet.js';

import {
  type WalletState,
  type NetworkId,
  type LumenRequest,
  type LumenResponse,
  type ErrorCode,
  NETWORKS,
  LumenError,
} from '../core/types.js';

console.log('[Lumen] Service worker starting...');

// ============================================
// State
// ============================================

// In-memory wallet state (cleared on restart)
let walletState: WalletState = {
  hasWallet: false,
  network: 'devnet',
};

// In-memory keys (never persisted)
let currentKeys: WalletKeys | null = null;
let currentWalletInfo: WalletInfo | null = null;

// ============================================
// Helpers
// ============================================

function errorResponse(message: string, code: ErrorCode): LumenResponse {
  return { error: message, errorCode: code };
}

function requireWallet(): void {
  if (!walletState.hasWallet || !currentKeys) {
    throw new LumenError('No wallet loaded', 'NO_WALLET');
  }
}

function getNetworkId(): string {
  return walletState.network === 'custom'
    ? 'custom'
    : walletState.network;
}

// ============================================
// Message Handlers
// ============================================

const handlers: Record<string, (params?: unknown) => Promise<unknown> | unknown> = {
  // Get current wallet state
  getState: () => {
    return {
      hasWallet: walletState.hasWallet,
      address: walletState.address,
      balance: walletState.balance,
      network: walletState.network,
    };
  },

  // Generate new wallet
  generateWallet: () => {
    const networkId = getNetworkId();
    const result = createWallet(networkId);

    if (!result.success) {
      throw new LumenError(result.error, 'UNKNOWN_ERROR');
    }

    currentKeys = result.data.keys;
    currentWalletInfo = result.data.info;

    walletState.hasWallet = true;
    walletState.address = result.data.info.address;
    walletState.balance = '0';

    console.log('[Lumen] Wallet generated:', result.data.info.address);

    return { seedPhrase: result.data.mnemonic };
  },

  // Import from seed phrase
  importFromSeed: (params: { seedPhrase: string }) => {
    const { seedPhrase } = params;
    const networkId = getNetworkId();

    const result = importFromMnemonic(seedPhrase, networkId);

    if (!result.success) {
      throw new LumenError(result.error, 'INVALID_INPUT');
    }

    currentKeys = result.data.keys;
    currentWalletInfo = result.data.info;

    walletState.hasWallet = true;
    walletState.address = result.data.info.address;
    walletState.balance = '0';

    console.log('[Lumen] Wallet imported from seed:', result.data.info.address);

    return { success: true, address: result.data.info.address };
  },

  // Import from private key
  importFromKey: (params: { privateKey: string }) => {
    const { privateKey } = params;
    const networkId = getNetworkId();

    const result = importFromPrivateKey(privateKey, networkId);

    if (!result.success) {
      throw new LumenError(result.error, 'INVALID_INPUT');
    }

    currentKeys = result.data.keys;
    currentWalletInfo = result.data.info;

    walletState.hasWallet = true;
    walletState.address = result.data.info.address;
    walletState.balance = '0';

    console.log('[Lumen] Wallet imported from key:', result.data.info.address);

    return { success: true, address: result.data.info.address };
  },

  // Clear wallet
  clearWallet: () => {
    currentKeys = null;
    currentWalletInfo = null;

    walletState = {
      hasWallet: false,
      network: walletState.network,
      customRpcUrl: walletState.customRpcUrl,
    };

    console.log('[Lumen] Wallet cleared');

    return { success: true };
  },

  // Set network
  setNetwork: (params: { network: NetworkId; customRpcUrl?: string }) => {
    const previousNetwork = walletState.network;
    walletState.network = params.network;

    if (params.network === 'custom' && params.customRpcUrl) {
      walletState.customRpcUrl = params.customRpcUrl;
    }

    // Re-derive address if wallet exists and network changed
    if (currentKeys && currentWalletInfo && previousNetwork !== params.network) {
      const networkId = getNetworkId();
      // Note: In a full implementation, we'd re-encode the address for the new network
      console.log('[Lumen] Network changed to:', networkId);
    }

    return { success: true };
  },

  // Test connection
  testConnection: async () => {
    const network = walletState.network;
    const rpcUrl =
      network === 'custom'
        ? walletState.customRpcUrl
        : NETWORKS[network as keyof typeof NETWORKS]?.rpcUrl;

    if (!rpcUrl) {
      throw new LumenError('No RPC URL configured', 'NETWORK_ERROR');
    }

    // TODO: Implement actual RPC health check
    console.log('[Lumen] Test connection to:', rpcUrl);

    return { success: true, rpcUrl };
  },

  // === dApp Connector Methods ===

  // Enable connection
  enable: () => {
    requireWallet();
    return {
      enabled: true,
      address: walletState.address,
    };
  },

  // Disable connection
  disable: () => {
    return { success: true };
  },

  // Check if enabled
  isEnabled: () => {
    return walletState.hasWallet;
  },

  // Get address
  getAddress: () => {
    requireWallet();
    return walletState.address;
  },

  // Get balance
  getBalance: () => {
    requireWallet();
    // TODO: Fetch actual balance from network
    return walletState.balance ?? '0';
  },

  // Sign transaction
  signTransaction: (params: { tx: unknown }) => {
    requireWallet();

    const result = signTransaction(params.tx, currentKeys!.dustKey);

    if (!result.success) {
      throw new LumenError(result.error, 'UNKNOWN_ERROR');
    }

    console.log('[Lumen] Transaction signed');

    return result.data;
  },

  // Sign message
  signMessage: (params: { message: string }) => {
    requireWallet();

    const result = signMessage(params.message, currentKeys!.dustKey);

    if (!result.success) {
      throw new LumenError(result.error, 'UNKNOWN_ERROR');
    }

    console.log('[Lumen] Message signed:', params.message.slice(0, 20) + '...');

    return result.data;
  },

  // Get network info
  getNetwork: () => {
    const network = walletState.network;
    const rpcUrl =
      network === 'custom'
        ? walletState.customRpcUrl
        : NETWORKS[network as keyof typeof NETWORKS]?.rpcUrl;

    return {
      rpcUrl,
      networkId: network,
    };
  },
};

// ============================================
// Message Listener
// ============================================

chrome.runtime.onMessage.addListener((request: LumenRequest, _sender, sendResponse) => {
  const { method, params } = request;
  console.log('[Lumen] Received message:', method);

  const handler = handlers[method];
  if (!handler) {
    sendResponse(errorResponse(`Unknown method: ${method}`, 'UNKNOWN_ERROR'));
    return true;
  }

  try {
    const result = handler(params as never);

    // Handle async handlers
    if (result instanceof Promise) {
      result
        .then((res) => sendResponse({ result: res }))
        .catch((err: Error) => {
          const code = err instanceof LumenError ? err.code : 'UNKNOWN_ERROR';
          sendResponse(errorResponse(err.message, code));
        });
      return true; // Keep channel open for async
    }

    sendResponse({ result });
  } catch (err) {
    const error = err as Error;
    const code = error instanceof LumenError ? error.code : 'UNKNOWN_ERROR';
    sendResponse(errorResponse(error.message, code));
  }

  return true;
});

// ============================================
// Lifecycle
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Lumen] Extension installed');
});

console.log('[Lumen] Service worker ready');
