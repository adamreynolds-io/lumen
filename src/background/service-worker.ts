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
  importFromHexSeed,
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
  LumenError,
  LOCALNET_SEEDS,
} from '../core/types.js';

import {
  testConnection as networkTestConnection,
  saveNetworkConfig,
  loadNetworkConfig,
  getRpcUrl,
  getNetworkUrls,
  getNetworkPresets,
  isValidRpcUrl,
  type NetworkStatus,
  type NetworkUrls,
} from '../core/network.js';

import {
  LumenFacade,
  createDustOnlyFacade,
  createFacadeConfig,
  type DustBalance,
  type DebugState,
  type CoinInfo,
  type ConnectionStatus,
} from '../core/facade.js';

console.log('[Lumen] Service worker starting...');

// Log any uncaught errors
self.addEventListener('error', (event) => {
  console.error('[Lumen] Uncaught error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Lumen] Unhandled rejection:', event.reason);
});

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

// Wallet facade for SDK operations (balance queries, etc.)
let facade: LumenFacade | null = null;

// Balance polling interval
let balancePollingInterval: ReturnType<typeof setInterval> | null = null;
const BALANCE_POLL_INTERVAL_MS = 1000;

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

/**
 * Broadcast balance update to all extension pages (popup, etc.)
 */
function broadcastBalanceUpdate(balance: { total: string; available: string; pending: string }): void {
  chrome.runtime.sendMessage({
    type: 'balanceUpdate',
    balance,
  }).catch(() => {
    // Ignore errors when no listeners (popup closed)
  });
}

/**
 * Start polling for balance updates.
 */
function startBalancePolling(): void {
  // Clear any existing interval
  stopBalancePolling();

  balancePollingInterval = setInterval(async () => {
    if (!facade) return;

    try {
      const balance = await facade.getBalanceNonBlocking();
      if (balance) {
        const balanceStr = {
          total: balance.total.toString(),
          available: balance.available.toString(),
          pending: balance.pending.toString(),
        };

        // Update wallet state
        walletState.balance = balanceStr.total;

        // Broadcast to popup
        broadcastBalanceUpdate(balanceStr);
      }
    } catch (e) {
      // Silently ignore polling errors
    }
  }, BALANCE_POLL_INTERVAL_MS);
}

/**
 * Stop balance polling.
 */
function stopBalancePolling(): void {
  if (balancePollingInterval) {
    clearInterval(balancePollingInterval);
    balancePollingInterval = null;
  }
}

/**
 * Initialize or reinitialize the wallet facade.
 * Called when wallet is loaded or network changes.
 */
async function initializeFacade(): Promise<void> {
  // Stop existing facade and polling if any
  stopBalancePolling();
  if (facade) {
    try {
      await facade.stop();
    } catch (e) {
      console.warn('[Lumen] Failed to stop existing facade:', e);
    }
    facade = null;
  }

  // Need keys to initialize facade
  if (!currentKeys) {
    return;
  }

  // Get network URLs
  const urls = getNetworkUrls(walletState.network, walletState.customUrls);

  // Create facade config
  const config = createFacadeConfig(
    getNetworkId(),
    urls.nodeUrl,
    urls.indexerUrl,
    urls.indexerWsUrl,
    urls.proverUrl
  );

  // Create and start facade with the HD-derived dust key (not raw seed)
  facade = createDustOnlyFacade(config, currentKeys.dustKey);

  try {
    await facade.start();
    console.log('[Lumen] Facade initialized and syncing');

    // Start balance polling
    startBalancePolling();
  } catch (e) {
    console.error('[Lumen] Failed to start facade:', e);
    facade = null;
  }
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
  generateWallet: async () => {
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

    // Initialize facade and start balance polling
    await initializeFacade();

    return { seedPhrase: result.data.mnemonic };
  },

  // Import from seed phrase
  importFromSeed: async (params: { seedPhrase: string }) => {
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

    // Initialize facade and start balance polling
    await initializeFacade();

    return { success: true, address: result.data.info.address };
  },

  // Import from private key
  importFromKey: async (params: { privateKey: string }) => {
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

    // Initialize facade and start balance polling
    await initializeFacade();

    return { success: true, address: result.data.info.address };
  },

  // Get available localnet prefunded wallets
  getLocalnetSeeds: () => {
    return Object.keys(LOCALNET_SEEDS).map((name) => ({
      name,
      description: `Prefunded localnet ${name}`,
    }));
  },

  // Import a prefunded localnet wallet
  importLocalnetWallet: async (params: { walletName: string }) => {
    console.log('[Lumen] importLocalnetWallet called with:', params);
    const { walletName } = params;
    const seed = LOCALNET_SEEDS[walletName];

    if (!seed) {
      throw new LumenError(
        `Unknown localnet wallet: ${walletName}. Available: ${Object.keys(LOCALNET_SEEDS).join(', ')}`,
        'INVALID_INPUT'
      );
    }

    console.log('[Lumen] Found seed for', walletName, '- calling importFromHexSeed');
    const networkId = getNetworkId();

    let result;
    try {
      result = importFromHexSeed(seed, networkId);
    } catch (e) {
      console.error('[Lumen] importFromHexSeed threw:', e);
      throw e;
    }

    if (!result.success) {
      console.error('[Lumen] importFromHexSeed failed:', result.error);
      throw new LumenError(result.error, 'INVALID_INPUT');
    }

    currentKeys = result.data.keys;
    currentWalletInfo = result.data.info;

    walletState.hasWallet = true;
    walletState.address = result.data.info.address;
    walletState.balance = '0';

    console.log('[Lumen] Localnet wallet imported:', walletName, result.data.info.address);

    // Initialize facade and start balance polling
    await initializeFacade();

    return { success: true, address: result.data.info.address, walletName };
  },

  // Import from hex seed (custom seed)
  importFromHexSeed: async (params: { hexSeed: string }) => {
    const { hexSeed } = params;
    const networkId = getNetworkId();

    const result = importFromHexSeed(hexSeed, networkId);

    if (!result.success) {
      throw new LumenError(result.error, 'INVALID_INPUT');
    }

    currentKeys = result.data.keys;
    currentWalletInfo = result.data.info;

    walletState.hasWallet = true;
    walletState.address = result.data.info.address;
    walletState.balance = '0';

    console.log('[Lumen] Wallet imported from hex seed:', result.data.info.address);

    // Initialize facade and start balance polling
    await initializeFacade();

    return { success: true, address: result.data.info.address };
  },

  // Clear wallet
  clearWallet: async () => {
    // Stop balance polling and facade
    stopBalancePolling();
    if (facade) {
      try {
        await facade.stop();
      } catch (e) {
        console.warn('[Lumen] Failed to stop facade:', e);
      }
      facade = null;
    }

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
  setNetwork: async (params: {
    network: NetworkId;
    customUrls?: { nodeUrl?: string; indexerUrl?: string; indexerWsUrl?: string; proverUrl?: string };
  }) => {
    // Validate custom URLs if provided
    if (params.network === 'custom') {
      if (!params.customUrls?.nodeUrl) {
        throw new LumenError('Custom network requires a node URL', 'INVALID_INPUT');
      }
      if (!isValidRpcUrl(params.customUrls.nodeUrl)) {
        throw new LumenError('Invalid node URL format', 'INVALID_INPUT');
      }
    }

    const previousNetwork = walletState.network;
    walletState.network = params.network;

    if (params.network === 'custom' && params.customUrls) {
      walletState.customUrls = params.customUrls;
    }

    // Persist to storage
    await saveNetworkConfig(params.network, params.customUrls?.nodeUrl);

    // Reinitialize facade if wallet exists and network changed
    if (currentKeys && previousNetwork !== params.network) {
      console.log('[Lumen] Network changed to:', params.network, '- reinitializing facade');
      await initializeFacade();
    }

    return { success: true, network: params.network };
  },

  // Test connection
  testConnection: async (): Promise<NetworkStatus> => {
    const rpcUrl = getRpcUrl(walletState.network, walletState.customUrls?.nodeUrl);

    console.log('[Lumen] Testing connection to:', rpcUrl);

    const status = await networkTestConnection(rpcUrl);

    if (status.connected) {
      console.log('[Lumen] Connected to:', status.chainInfo?.name, 'at block', status.blockHeight);
    } else {
      console.log('[Lumen] Connection failed:', status.error);
    }

    return status;
  },

  // Get network presets
  getNetworkPresets: () => {
    return getNetworkPresets();
  },

  // Get all network URLs for current network
  getNetworkUrls: (): NetworkUrls => {
    return getNetworkUrls(walletState.network, walletState.customUrls);
  },

  // Refresh balance from network using facade
  refreshBalance: async () => {
    requireWallet();

    // Initialize facade if not already done
    if (!facade) {
      await initializeFacade();
    }

    if (!facade) {
      console.log('[Lumen] Facade not available, returning 0 balance');
      return { total: '0', available: '0', pending: '0' };
    }

    try {
      const balance = await facade.getBalance();
      walletState.balance = balance.total.toString();

      console.log('[Lumen] Balance refreshed via facade:', balance.total.toString());

      return {
        total: balance.total.toString(),
        available: balance.available.toString(),
        pending: balance.pending.toString(),
      };
    } catch (e) {
      console.error('[Lumen] Failed to get balance from facade:', e);
      return { total: '0', available: '0', pending: '0' };
    }
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

  // Submit transaction to network
  submitTransaction: async (params: { tx: string }) => {
    requireWallet();

    const urls = getNetworkUrls(walletState.network, walletState.customUrls);

    // TODO: Implement actual transaction submission using @polkadot/api
    // For now, log and return success (developer wallet is for testing)
    console.log('[Lumen] Transaction submitted to:', urls.nodeUrl);
    console.log('[Lumen] Transaction data:', params.tx.slice(0, 50) + '...');

    return { success: true };
  },

  // Get network info (full URLs for dapp-connector-api Configuration)
  getNetwork: () => {
    const urls = getNetworkUrls(walletState.network, walletState.customUrls);

    return {
      networkId: walletState.network,
      nodeUrl: urls.nodeUrl,
      indexerUrl: urls.indexerUrl,
      indexerWsUrl: urls.indexerWsUrl,
      proverUrl: urls.proverUrl,
    };
  },

  // === Debug Methods ===

  // Get debug state for debug panel
  getDebugState: async (): Promise<DebugState> => {
    if (!facade) {
      return {
        facadeStarted: false,
        syncProgress: null,
        balance: null,
        coinCount: 0,
        facadeStartTime: null,
      };
    }

    return facade.getDebugState();
  },

  // Get list of coins for debug display
  getCoins: async (): Promise<CoinInfo[]> => {
    if (!facade) {
      return [];
    }

    return facade.getCoins();
  },

  // Get connection status for debug display
  getConnectionStatus: async (): Promise<ConnectionStatus> => {
    const unknownHealth = {
      status: 'unknown' as const,
      latency: null,
      lastChecked: null,
      error: null,
    };

    if (!facade) {
      return {
        node: unknownHealth,
        indexer: unknownHealth,
        prover: unknownHealth,
      };
    }

    return facade.getConnectionStatus();
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
// Initialization
// ============================================

async function initializeState(): Promise<void> {
  try {
    // Load saved network configuration
    const networkConfig = await loadNetworkConfig();
    walletState.network = networkConfig.networkId;
    walletState.customRpcUrl = networkConfig.customRpcUrl;

    console.log('[Lumen] Loaded network config:', networkConfig.networkId);
  } catch (error) {
    console.error('[Lumen] Failed to load network config:', error);
  }
}

// Initialize on startup
initializeState();

// ============================================
// Lifecycle
// ============================================

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Lumen] Extension installed');
  // Set default network on first install
  await saveNetworkConfig('devnet');
});

console.log('[Lumen] Service worker ready');
