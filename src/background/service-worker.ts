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
  generateMnemonicWords,
  generateRandomSeed,
  validateMnemonic,
  joinMnemonicWords,
  HDWallet,
  Roles,
} from '@midnight-ntwrk/wallet-sdk-hd';

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

// In-memory wallet state (cleared on restart)
let walletState: WalletState = {
  hasWallet: false,
  network: 'devnet',
};

// In-memory seed (never persisted)
let currentSeed: Uint8Array | null = null;

// Helper: Create error response
function errorResponse(message: string, code: ErrorCode): LumenResponse {
  return { error: message, errorCode: code };
}

// Helper: Require wallet loaded
function requireWallet(): void {
  if (!walletState.hasWallet || !currentSeed) {
    throw new LumenError('No wallet loaded', 'NO_WALLET');
  }
}

// Helper: Derive address from seed
function deriveAddress(seed: Uint8Array): string {
  const walletResult = HDWallet.fromSeed(seed);
  if (walletResult.type !== 'seedOk') {
    throw new LumenError('Failed to derive wallet', 'UNKNOWN_ERROR');
  }

  // Derive the Dust key for the address (account 0, index 0)
  const dustKey = walletResult.hdWallet
    .selectAccount(0)
    .selectRole(Roles.Dust)
    .deriveKeyAt(0);

  if (dustKey.type !== 'keyDerived') {
    throw new LumenError('Failed to derive address key', 'UNKNOWN_ERROR');
  }

  // Convert key to hex address (simplified - real implementation would use address-format)
  const hexAddress = Array.from(dustKey.key)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `0x${hexAddress.slice(0, 40)}`; // Truncate for display
}

// Message handlers
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
    const words = generateMnemonicWords();
    const seed = generateRandomSeed();

    currentSeed = seed;
    walletState.hasWallet = true;
    walletState.address = deriveAddress(seed);
    walletState.balance = '0';

    return { seedPhrase: words };
  },

  // Import from seed phrase
  importFromSeed: (params: { seedPhrase: string }) => {
    const { seedPhrase } = params;

    if (!validateMnemonic(seedPhrase)) {
      throw new LumenError('Invalid seed phrase', 'INVALID_INPUT');
    }

    // Generate seed from mnemonic (simplified - real would use proper BIP39)
    const seed = generateRandomSeed(); // TODO: Properly derive from mnemonic

    currentSeed = seed;
    walletState.hasWallet = true;
    walletState.address = deriveAddress(seed);
    walletState.balance = '0';

    return { success: true };
  },

  // Import from private key
  importFromKey: (params: { privateKey: string }) => {
    const { privateKey } = params;

    // Validate hex format
    const cleanKey = privateKey.replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      throw new LumenError('Invalid private key format', 'INVALID_INPUT');
    }

    // Convert hex to bytes
    const seed = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      seed[i] = parseInt(cleanKey.slice(i * 2, i * 2 + 2), 16);
    }

    currentSeed = seed;
    walletState.hasWallet = true;
    walletState.address = deriveAddress(seed);
    walletState.balance = '0';

    return { success: true };
  },

  // Clear wallet
  clearWallet: () => {
    currentSeed = null;
    walletState = {
      hasWallet: false,
      network: walletState.network,
    };
    return { success: true };
  },

  // Set network
  setNetwork: (params: { network: NetworkId; customRpcUrl?: string }) => {
    walletState.network = params.network;
    if (params.network === 'custom' && params.customRpcUrl) {
      walletState.customRpcUrl = params.customRpcUrl;
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
    // TODO: Implement actual transaction signing
    console.log('[Lumen] Sign transaction:', params.tx);
    return { signedTx: 'TODO_SIGNED_TX' };
  },

  // Sign message
  signMessage: (params: { message: string }) => {
    requireWallet();
    // TODO: Implement actual message signing
    console.log('[Lumen] Sign message:', params.message);
    return { signature: 'TODO_SIGNATURE' };
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

// Message listener
chrome.runtime.onMessage.addListener((request: LumenRequest, _sender, sendResponse) => {
  const { method, params } = request;
  console.log('[Lumen] Received message:', method, params);

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

// Log on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Lumen] Extension installed');
});

console.log('[Lumen] Service worker ready');
