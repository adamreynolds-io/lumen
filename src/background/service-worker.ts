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
  createFacade,
  createFacadeConfig,
  type DustBalance,
  type DebugState,
  type CoinInfo,
  type ConnectionStatus,
  type WalletKeys as FacadeWalletKeys,
} from '../core/facade.js';

// ============================================
// Conditional Logging (disabled in production)
// ============================================

const IS_DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/** Log only in development mode to prevent sensitive data exposure */
function devLog(...args: unknown[]): void {
  if (IS_DEV) {
    console.log('[Lumen]', ...args);
  }
}

devLog('Service worker starting...');

// Flag to track if critical error occurred (triggers key wipe)
let criticalErrorOccurred = false;

/**
 * Handle critical errors by wiping sensitive key material.
 * Called on uncaught errors/rejections to prevent keys from persisting in corrupted state.
 */
function handleCriticalError(error: unknown): void {
  console.error('[Lumen] Critical error - wiping keys for security:', error);
  criticalErrorOccurred = true;

  // Wipe keys immediately - use inline wipe since securelyWipeKeys may not be available yet
  // This is a safety measure in case of early initialization errors
  if (typeof currentKeys !== 'undefined' && currentKeys) {
    try {
      // Overwrite each key buffer with random data then zeros
      const wipe = (data: Uint8Array | undefined) => {
        if (data && data.length > 0) {
          crypto.getRandomValues(data);
          data.fill(0);
        }
      };
      wipe(currentKeys.dustKey);
      wipe(currentKeys.nightExternalKey);
      wipe(currentKeys.nightInternalKey);
    } catch {
      // Ignore errors during emergency wipe
    }
    currentKeys = null;
  }
  if (typeof currentWalletInfo !== 'undefined') {
    currentWalletInfo = null;
  }
}

// Log and handle uncaught errors
self.addEventListener('error', (event) => {
  handleCriticalError(event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  handleCriticalError(event.reason);
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

// Balance polling state
let balancePollingTimeout: ReturnType<typeof setTimeout> | null = null;
const BALANCE_POLL_BASE_MS = 1000;      // Base polling interval
const BALANCE_POLL_MAX_MS = 30000;      // Max backoff (30 seconds)
const BALANCE_POLL_MAX_FAILURES = 10;   // Circuit breaker threshold
let balancePollFailures = 0;
let balancePollCurrentInterval = BALANCE_POLL_BASE_MS;

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

/**
 * Securely wipe sensitive data from a Uint8Array by overwriting with random values.
 * This helps prevent memory forensics from recovering key material.
 */
function secureWipe(data: Uint8Array): void {
  if (!data || data.length === 0) return;
  // Overwrite with random data
  crypto.getRandomValues(data);
  // Then zero it out
  data.fill(0);
}

/**
 * Securely clear all key material from memory.
 */
function securelyWipeKeys(): void {
  if (currentKeys) {
    // Wipe each key buffer
    if (currentKeys.dustKey) secureWipe(currentKeys.dustKey);
    if (currentKeys.nightExternalKey) secureWipe(currentKeys.nightExternalKey);
    if (currentKeys.nightInternalKey) secureWipe(currentKeys.nightInternalKey);
    currentKeys = null;
  }
  currentWalletInfo = null;
}

/**
 * Check if a message sender is the extension's popup (trusted context).
 * Only popup should be able to call sensitive wallet management methods.
 */
function isPopupSender(sender: chrome.runtime.MessageSender): boolean {
  // Popup has a URL like chrome-extension://<id>/popup.html
  if (!sender.url) return false;
  const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
  return sender.url.startsWith(extensionOrigin);
}

/** Methods that should only be callable from the popup, not from dApps */
const POPUP_ONLY_METHODS = [
  'generateWallet',
  'importFromSeed',
  'importFromKey',
  'importFromHexSeed',
  'importLocalnetWallet',
  'clearWallet',
  'setNetwork',
  'getDebugState',
  'getCoins',
];

// ============================================
// Rate Limiting
// ============================================

/** Rate limit config: max requests per window */
const RATE_LIMIT_MAX_REQUESTS = 100;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

/** Track request timestamps per origin */
const rateLimitMap = new Map<string, number[]>();

/**
 * Check if a request should be rate limited.
 * Uses sliding window algorithm.
 */
function isRateLimited(origin: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Get or create request history for this origin
  let requests = rateLimitMap.get(origin);
  if (!requests) {
    requests = [];
    rateLimitMap.set(origin, requests);
  }

  // Remove old requests outside the window
  requests = requests.filter((timestamp) => timestamp > windowStart);
  rateLimitMap.set(origin, requests);

  // Check if over limit
  if (requests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  // Record this request
  requests.push(now);
  return false;
}

/**
 * Get origin identifier from sender.
 * For popup, returns 'popup'. For content scripts, returns the tab's origin.
 */
function getSenderOrigin(sender: chrome.runtime.MessageSender): string {
  if (isPopupSender(sender)) {
    return 'popup'; // Popup is trusted, use fixed identifier
  }
  // For content scripts, use the tab's URL origin
  if (sender.tab?.url) {
    try {
      return new URL(sender.tab.url).origin;
    } catch {
      return 'unknown';
    }
  }
  return sender.origin || 'unknown';
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
 * Schedule next balance poll with current interval.
 */
function scheduleNextPoll(): void {
  if (balancePollingTimeout) {
    clearTimeout(balancePollingTimeout);
  }
  balancePollingTimeout = setTimeout(pollBalance, balancePollCurrentInterval);
}

/**
 * Poll balance once and schedule next poll.
 * Uses exponential backoff on errors, resets on success.
 */
async function pollBalance(): Promise<void> {
  if (!facade) {
    // No facade, stop polling
    return;
  }

  // Circuit breaker: stop polling after too many consecutive failures
  if (balancePollFailures >= BALANCE_POLL_MAX_FAILURES) {
    devLog('Balance polling circuit breaker triggered - stopping');
    return;
  }

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

      // Success: reset backoff
      balancePollFailures = 0;
      balancePollCurrentInterval = BALANCE_POLL_BASE_MS;
    }
  } catch (e) {
    // Error: apply exponential backoff
    balancePollFailures++;
    balancePollCurrentInterval = Math.min(
      balancePollCurrentInterval * 2,
      BALANCE_POLL_MAX_MS
    );
  }

  // Schedule next poll
  scheduleNextPoll();
}

/**
 * Start polling for balance updates with exponential backoff.
 */
function startBalancePolling(): void {
  // Reset state
  stopBalancePolling();
  balancePollFailures = 0;
  balancePollCurrentInterval = BALANCE_POLL_BASE_MS;

  // Start polling
  scheduleNextPoll();
}

/**
 * Stop balance polling.
 */
function stopBalancePolling(): void {
  if (balancePollingTimeout) {
    clearTimeout(balancePollingTimeout);
    balancePollingTimeout = null;
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

  // Create full wallet keys for WalletFacade
  const facadeKeys: FacadeWalletKeys = {
    dustKey: currentKeys.dustKey,
    // Use Night External key for shielded wallet (ZswapSecretKeys)
    shieldedKey: currentKeys.nightExternalKey,
    // Unshielded public key is derived from shielded keys inside facade
    unshieldedPublicKey: new Uint8Array(32), // Placeholder, derived internally
  };

  // Create and start full facade
  facade = createFacade(config, facadeKeys);

  try {
    // Enable full WalletFacade mode (ShieldedWallet + UnshieldedWallet + DustWallet)
    await facade.start(true);
    devLog(' Full WalletFacade initialized and syncing');

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

    devLog(' Wallet generated:', result.data.info.address);

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

    devLog(' Wallet imported from seed:', result.data.info.address);

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

    devLog(' Wallet imported from key:', result.data.info.address);

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
    devLog(' importLocalnetWallet called with:', params);
    const { walletName } = params;
    const seed = LOCALNET_SEEDS[walletName];

    if (!seed) {
      throw new LumenError(
        `Unknown localnet wallet: ${walletName}. Available: ${Object.keys(LOCALNET_SEEDS).join(', ')}`,
        'INVALID_INPUT'
      );
    }

    devLog(' Found seed for', walletName, '- calling importFromHexSeed');
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

    devLog(' Localnet wallet imported:', walletName, result.data.info.address);

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

    devLog(' Wallet imported from hex seed:', result.data.info.address);

    // Initialize facade and start balance polling
    await initializeFacade();

    return { success: true, address: result.data.info.address };
  },

  // Clear wallet
  clearWallet: async () => {
    // Use try-finally to ensure keys are ALWAYS wiped, even if facade.stop() fails
    try {
      // Stop balance polling first
      stopBalancePolling();

      // Try to stop facade gracefully
      if (facade) {
        try {
          await facade.stop();
        } catch (e) {
          // Log but continue with cleanup
          if (IS_DEV) console.warn('[Lumen] Failed to stop facade:', e);
        }
      }
    } finally {
      // ALWAYS wipe keys, regardless of any errors above
      facade = null;
      securelyWipeKeys();

      walletState = {
        hasWallet: false,
        network: walletState.network,
        customRpcUrl: walletState.customRpcUrl,
      };
    }

    devLog('Wallet cleared');

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
      devLog(' Network changed to:', params.network, '- reinitializing facade');
      await initializeFacade();
    }

    return { success: true, network: params.network };
  },

  // Test connection
  testConnection: async (): Promise<NetworkStatus> => {
    const rpcUrl = getRpcUrl(walletState.network, walletState.customUrls?.nodeUrl);

    devLog(' Testing connection to:', rpcUrl);

    const status = await networkTestConnection(rpcUrl);

    if (status.connected) {
      devLog(' Connected to:', status.chainInfo?.name, 'at block', status.blockHeight);
    } else {
      devLog(' Connection failed:', status.error);
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
      devLog(' Facade not available, returning 0 balance');
      return { total: '0', available: '0', pending: '0' };
    }

    try {
      const balance = await facade.getBalance();
      walletState.balance = balance.total.toString();

      devLog(' Balance refreshed via facade:', balance.total.toString());

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

    devLog(' Transaction signed');

    return result.data;
  },

  // Sign message
  signMessage: (params: { message: string }) => {
    requireWallet();

    const result = signMessage(params.message, currentKeys!.dustKey);

    if (!result.success) {
      throw new LumenError(result.error, 'UNKNOWN_ERROR');
    }

    devLog(' Message signed:', params.message.slice(0, 20) + '...');

    return result.data;
  },

  // Submit transaction to network
  submitTransaction: async (params: { tx: string }) => {
    requireWallet();

    const urls = getNetworkUrls(walletState.network, walletState.customUrls);

    // TODO: Implement actual transaction submission using @polkadot/api
    // For now, log and return success (developer wallet is for testing)
    devLog(' Transaction submitted to:', urls.nodeUrl);
    devLog(' Transaction data:', params.tx.slice(0, 50) + '...');

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

chrome.runtime.onMessage.addListener((request: LumenRequest, sender, sendResponse) => {
  const { method, params } = request;

  // Security: Check if method requires popup-only access
  if (POPUP_ONLY_METHODS.includes(method) && !isPopupSender(sender)) {
    sendResponse(errorResponse('This method is only available from the extension popup', 'UNAUTHORIZED'));
    return true;
  }

  // Security: Rate limiting for non-popup requests
  const senderOrigin = getSenderOrigin(sender);
  if (senderOrigin !== 'popup' && isRateLimited(senderOrigin)) {
    sendResponse(errorResponse('Rate limit exceeded. Please try again later.', 'UNKNOWN_ERROR'));
    return true;
  }

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

    devLog(' Loaded network config:', networkConfig.networkId);
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
  devLog(' Extension installed');
  // Set default network on first install
  await saveNetworkConfig('devnet');
});

devLog(' Service worker ready');
