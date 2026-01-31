/**
 * Popup UI Logic
 *
 * Handles user interactions in the extension popup.
 * Communicates with service worker for wallet operations.
 */

console.log('[Lumen] Popup loaded');

// ============================================
// Security: HTML Escaping
// ============================================

/** Escape HTML to prevent XSS attacks from blockchain data */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Format raw token type hex to readable name (following wallet-cli pattern) */
function formatTokenType(tokenType: string): string {
  // NIGHT token ID = 64 zeros (the native token)
  const NIGHT_TOKEN_ID = '0000000000000000000000000000000000000000000000000000000000000000';

  const normalized = tokenType.toLowerCase().replace(/^0x/, '');

  if (normalized === NIGHT_TOKEN_ID) {
    return 'NIGHT';
  }

  // For token IDs that are mostly zeros, show the significant suffix
  // e.g., "0000...0001" -> "token:01", "0000...0002" -> "token:02"
  const trimmed = normalized.replace(/^0+/, '');
  if (trimmed.length <= 4) {
    return `token:${trimmed.padStart(2, '0')}`;
  }

  // Unknown token - show truncated hex
  if (normalized.length > 12) {
    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  }
  return tokenType;
}

// DOM Elements
const elements = {
  // Sections
  noWallet: document.getElementById('no-wallet')!,
  walletLoaded: document.getElementById('wallet-loaded')!,
  seedDisplay: document.getElementById('seed-display')!,
  importSeed: document.getElementById('import-seed')!,
  importKey: document.getElementById('import-key')!,
  importHex: document.getElementById('import-hex')!,
  localnetWallets: document.getElementById('localnet-wallets')!,

  // Wallet info
  walletAddress: document.getElementById('wallet-address')!,
  walletBalance: document.getElementById('wallet-balance')!,
  networkSelectInitial: document.getElementById('network-select-initial') as HTMLSelectElement,
  seedWords: document.getElementById('seed-words')!,
  seedInput: document.getElementById('seed-input') as HTMLTextAreaElement,
  keyInput: document.getElementById('key-input') as HTMLInputElement,
  hexInput: document.getElementById('hex-input') as HTMLInputElement,

  // Buttons
  btnGenerate: document.getElementById('btn-generate')!,
  btnImportSeed: document.getElementById('btn-import-seed')!,
  btnImportKey: document.getElementById('btn-import-key')!,
  btnImportHex: document.getElementById('btn-import-hex')!,
  btnCopy: document.getElementById('btn-copy')!,
  btnCopySeed: document.getElementById('btn-copy-seed')!,
  btnClearWallet: document.getElementById('btn-clear-wallet')!,
  btnConfirmSeed: document.getElementById('btn-confirm-seed')!,
  btnDoImportSeed: document.getElementById('btn-do-import-seed')!,
  btnCancelImport: document.getElementById('btn-cancel-import')!,
  btnDoImportKey: document.getElementById('btn-do-import-key')!,
  btnCancelImportKey: document.getElementById('btn-cancel-import-key')!,
  btnDoImportHex: document.getElementById('btn-do-import-hex')!,
  btnCancelImportHex: document.getElementById('btn-cancel-import-hex')!,

  // Debug panel
  debugPanel: document.getElementById('debug-panel')!,
  btnDebugToggle: document.getElementById('btn-debug-toggle')!,
  btnCopyDebug: document.getElementById('btn-copy-debug')!,
  debugSyncBadge: document.getElementById('debug-sync-badge')!,
  syncProgressBar: document.getElementById('sync-progress-bar')!,
  syncStatus: document.getElementById('sync-status')!,
  debugBalanceTotal: document.getElementById('debug-balance-total')!,
  debugBalanceAvailable: document.getElementById('debug-balance-available')!,
  debugBalancePending: document.getElementById('debug-balance-pending')!,
  debugCoinCount: document.getElementById('debug-coin-count')!,
  debugCoinList: document.getElementById('debug-coin-list')!,
  debugTabs: document.querySelectorAll('.debug-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  // Shielded tab elements
  shieldedNotAvailable: document.getElementById('shielded-not-available')!,
  shieldedContent: document.getElementById('shielded-content')!,
  shieldedCoinCount: document.getElementById('shielded-coin-count')!,
  shieldedBalances: document.getElementById('shielded-balances')!,
  shieldedSyncProgress: document.getElementById('shielded-sync-progress')!,
  // Unshielded tab elements
  unshieldedNotAvailable: document.getElementById('unshielded-not-available')!,
  unshieldedContent: document.getElementById('unshielded-content')!,
  unshieldedBalance: document.getElementById('unshielded-balance')!,
  unshieldedUtxoCount: document.getElementById('unshielded-utxo-count')!,
  unshieldedRegistered: document.getElementById('unshielded-registered')!,
  unshieldedSyncProgress: document.getElementById('unshielded-sync-progress')!,
  // Transaction history
  txHistoryList: document.getElementById('tx-history-list')!,
  // Status bar
  statusNode: document.getElementById('status-node')!,
  statusIndexer: document.getElementById('status-indexer')!,
  statusProver: document.getElementById('status-prover')!,
  statusHealth: document.getElementById('status-health')!,
  statusMessage: document.getElementById('status-message')!,

  // All wallet addresses
  walletShieldedAddress: document.getElementById('wallet-shielded-address')!,
  walletUnshieldedAddress: document.getElementById('wallet-unshielded-address')!,
  btnCopyShielded: document.getElementById('btn-copy-shielded')!,
  btnCopyUnshielded: document.getElementById('btn-copy-unshielded')!,

  // Action buttons
  btnTransfer: document.getElementById('btn-transfer')!,
  btnRegisterDust: document.getElementById('btn-register-dust')!,
  btnDeregisterDust: document.getElementById('btn-deregister-dust')!,
  btnSettings: document.getElementById('btn-settings')!,

  // Transfer modal
  transferModal: document.getElementById('transfer-modal')!,
  btnCloseTransfer: document.getElementById('btn-close-transfer')!,
  transferSteps: document.querySelectorAll('.transfer-step'),
  stepIndicators: document.querySelectorAll('.step-indicator .step'),
  typeButtons: document.querySelectorAll('.type-btn'),
  tokenList: document.getElementById('token-list')!,
  transferAmount: document.getElementById('transfer-amount') as HTMLInputElement,
  transferTokenSymbol: document.getElementById('transfer-token-symbol')!,
  transferAvailable: document.getElementById('transfer-available')!,
  transferAddress: document.getElementById('transfer-address') as HTMLInputElement,
  confirmType: document.getElementById('confirm-type')!,
  confirmToken: document.getElementById('confirm-token')!,
  confirmAmount: document.getElementById('confirm-amount')!,
  confirmAddress: document.getElementById('confirm-address')!,
  transferProcessing: document.getElementById('transfer-processing')!,
  transferResult: document.getElementById('transfer-result')!,
  transferResultIcon: document.getElementById('transfer-result-icon')!,
  transferResultMessage: document.getElementById('transfer-result-message')!,
  transferTxId: document.getElementById('transfer-tx-id')!,
  btnTransferDone: document.getElementById('transfer-done')!,
  btnTransferBack1: document.getElementById('transfer-back-1')!,
  btnTransferBack2: document.getElementById('transfer-back-2')!,
  btnTransferNext3: document.getElementById('transfer-next-3')!,
  btnTransferBack3: document.getElementById('transfer-back-3')!,
  btnTransferNext4: document.getElementById('transfer-next-4')!,
  btnTransferBack4: document.getElementById('transfer-back-4')!,
  btnTransferConfirm: document.getElementById('transfer-confirm')!,

  // Dust registration modal
  dustRegisterModal: document.getElementById('dust-register-modal')!,
  btnCloseDustRegister: document.getElementById('btn-close-dust-register')!,
  unregisteredUtxoList: document.getElementById('unregistered-utxo-list')!,
  dustReceiverAddress: document.getElementById('dust-receiver-address') as HTMLInputElement,
  btnDustRegisterCancel: document.getElementById('dust-register-cancel')!,
  btnDustRegisterNext: document.getElementById('dust-register-next')!,
  dustRegisterConfirm: document.getElementById('dust-register-confirm')!,
  dustConfirmUtxoCount: document.getElementById('dust-confirm-utxo-count')!,
  dustConfirmTotalValue: document.getElementById('dust-confirm-total-value')!,
  dustConfirmReceiver: document.getElementById('dust-confirm-receiver')!,
  btnDustRegisterBack: document.getElementById('dust-register-back')!,
  btnDustRegisterSubmit: document.getElementById('dust-register-submit')!,
  dustRegisterProcessing: document.getElementById('dust-register-processing')!,
  dustRegisterResult: document.getElementById('dust-register-result')!,
  dustRegisterResultIcon: document.getElementById('dust-register-result-icon')!,
  dustRegisterResultMessage: document.getElementById('dust-register-result-message')!,
  dustRegisterTxId: document.getElementById('dust-register-tx-id')!,
  btnDustRegisterDone: document.getElementById('dust-register-done')!,

  // Dust deregistration modal
  dustDeregisterModal: document.getElementById('dust-deregister-modal')!,
  btnCloseDustDeregister: document.getElementById('btn-close-dust-deregister')!,
  registeredUtxoList: document.getElementById('registered-utxo-list')!,
  btnDustDeregisterCancel: document.getElementById('dust-deregister-cancel')!,
  btnDustDeregisterNext: document.getElementById('dust-deregister-next')!,
  dustDeregisterConfirm: document.getElementById('dust-deregister-confirm')!,
  deregisterConfirmUtxoCount: document.getElementById('deregister-confirm-utxo-count')!,
  deregisterConfirmTotalValue: document.getElementById('deregister-confirm-total-value')!,
  btnDustDeregisterBack: document.getElementById('dust-deregister-back')!,
  btnDustDeregisterSubmit: document.getElementById('dust-deregister-submit')!,
  dustDeregisterProcessing: document.getElementById('dust-deregister-processing')!,
  dustDeregisterResult: document.getElementById('dust-deregister-result')!,
  dustDeregisterResultIcon: document.getElementById('dust-deregister-result-icon')!,
  dustDeregisterResultMessage: document.getElementById('dust-deregister-result-message')!,
  dustDeregisterTxId: document.getElementById('dust-deregister-tx-id')!,
  btnDustDeregisterDone: document.getElementById('dust-deregister-done')!,

  // Settings modal
  settingsModal: document.getElementById('settings-modal')!,
  btnCloseSettings: document.getElementById('btn-close-settings')!,
  settingsNetwork: document.getElementById('settings-network') as HTMLSelectElement,
  settingsNodeUrl: document.getElementById('settings-node-url') as HTMLInputElement,
  settingsIndexerUrl: document.getElementById('settings-indexer-url') as HTMLInputElement,
  settingsIndexerWsUrl: document.getElementById('settings-indexer-ws-url') as HTMLInputElement,
  settingsProverUrl: document.getElementById('settings-prover-url') as HTMLInputElement,
  btnSettingsReset: document.getElementById('settings-reset')!,
  btnSettingsApply: document.getElementById('settings-apply')!,
  settingsStatus: document.getElementById('settings-status')!,
};

// State
let currentSeedPhrase: string[] | null = null;
let debugPanelVisible = true;
let debugPollingInterval: ReturnType<typeof setInterval> | null = null;
const DEBUG_POLL_INTERVAL_MS = 1000;

// Track expanded coin indices to preserve state across refreshes
const expandedCoinIndices = new Set<number>();

// Helper: Send message to service worker
function sendMessage(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ method, params }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        // Unwrap the result from { result: ... } wrapper
        resolve(response?.result ?? response);
      }
    });
  });
}

// Track status timeout for cleanup
let statusTimeout: ReturnType<typeof setTimeout> | null = null;

// Helper: Show status message in bottom status bar
function showStatus(message: string, type: 'success' | 'error' | 'info'): void {
  // Clear any existing timeout
  if (statusTimeout) {
    clearTimeout(statusTimeout);
  }

  // Hide health indicators, show message
  elements.statusHealth.classList.add('hidden');
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;

  // Auto-restore health indicators after delay (longer for errors)
  const delay = type === 'error' ? 5000 : 2000;
  statusTimeout = setTimeout(() => {
    elements.statusMessage.classList.add('hidden');
    elements.statusHealth.classList.remove('hidden');
    statusTimeout = null;
  }, delay);
}

// Helper: Show section
function showSection(
  section: 'no-wallet' | 'wallet' | 'seed-display' | 'import-seed' | 'import-key' | 'import-hex'
): void {
  elements.noWallet.classList.add('hidden');
  elements.walletLoaded.classList.add('hidden');
  elements.seedDisplay.classList.add('hidden');
  elements.importSeed.classList.add('hidden');
  elements.importKey.classList.add('hidden');
  elements.importHex.classList.add('hidden');

  // Show/hide header buttons and debug panel based on wallet state
  const hasWallet = section === 'wallet';
  elements.btnCopyDebug.classList.toggle('hidden', !hasWallet);
  elements.btnDebugToggle.classList.toggle('hidden', !hasWallet);
  elements.btnClearWallet.classList.toggle('hidden', !hasWallet);
  elements.debugPanel.classList.toggle('hidden', !hasWallet || !debugPanelVisible);

  switch (section) {
    case 'no-wallet':
      elements.noWallet.classList.remove('hidden');
      break;
    case 'wallet':
      elements.walletLoaded.classList.remove('hidden');
      break;
    case 'seed-display':
      elements.seedDisplay.classList.remove('hidden');
      break;
    case 'import-seed':
      elements.importSeed.classList.remove('hidden');
      break;
    case 'import-key':
      elements.importKey.classList.remove('hidden');
      break;
    case 'import-hex':
      elements.importHex.classList.remove('hidden');
      break;
  }
}

// Helper: Update localnet wallet visibility
function updateLocalnetVisibility(network: string): void {
  elements.localnetWallets.classList.toggle('hidden', network !== 'localnet');
}

// Load wallet state from service worker
async function loadWalletState(): Promise<void> {
  try {
    const state = (await sendMessage('getState')) as {
      hasWallet: boolean;
      address?: string;
      balance?: string;
      network?: string;
    };

    // Update network select (initial selector only, wallet-loaded has no selector)
    if (state.network) {
      elements.networkSelectInitial.value = state.network;
      updateLocalnetVisibility(state.network);
    }

    if (state.hasWallet && state.address) {
      elements.walletAddress.textContent = state.address;
      elements.walletBalance.textContent = state.balance ?? 'Loading...';
      showSection('wallet');
    } else {
      showSection('no-wallet');
    }
  } catch (error) {
    console.error('[Lumen] Failed to load state:', error);
    showSection('no-wallet');
  }
}

// Event: Initial network selection (before wallet import)
elements.networkSelectInitial.addEventListener('change', async () => {
  const network = elements.networkSelectInitial.value;
  updateLocalnetVisibility(network);

  try {
    await sendMessage('setNetwork', { network });
  } catch (error) {
    console.error('[Lumen] Failed to set network:', error);
  }
});

// Event: Localnet wallet buttons
document.querySelectorAll('.localnet-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const walletName = (btn as HTMLElement).dataset.wallet;
    if (!walletName) return;

    try {
      showStatus(`Importing ${walletName}...`, 'info');
      const result = (await sendMessage('importLocalnetWallet', { walletName })) as {
        address: string;
      };
      showStatus(`Imported ${walletName}`, 'success');
      loadWalletState();
    } catch (error) {
      showStatus(`Import failed: ${error}`, 'error');
    }
  });
});

// Event: Generate new wallet
elements.btnGenerate.addEventListener('click', async () => {
  try {
    const result = (await sendMessage('generateWallet')) as { seedPhrase: string[] };
    currentSeedPhrase = result.seedPhrase;

    // Display seed phrase
    elements.seedWords.innerHTML = '';
    result.seedPhrase.forEach((word, index) => {
      const span = document.createElement('span');
      span.textContent = word;
      span.dataset.index = String(index + 1);
      elements.seedWords.appendChild(span);
    });

    showSection('seed-display');
  } catch (error) {
    showStatus(`Failed to generate wallet: ${error}`, 'error');
  }
});

// Event: Copy seed phrase
elements.btnCopySeed.addEventListener('click', async () => {
  if (currentSeedPhrase) {
    await navigator.clipboard.writeText(currentSeedPhrase.join(' '));
    elements.btnCopySeed.textContent = 'Copied!';
    setTimeout(() => {
      elements.btnCopySeed.textContent = 'Copy Seed Phrase';
    }, 2000);
  }
});

// Event: Confirm seed saved
elements.btnConfirmSeed.addEventListener('click', () => {
  currentSeedPhrase = null;
  loadWalletState();
});

// Event: Show import seed form
elements.btnImportSeed.addEventListener('click', () => {
  elements.seedInput.value = '';
  showSection('import-seed');
});

// Event: Import from seed phrase
elements.btnDoImportSeed.addEventListener('click', async () => {
  const seedPhrase = elements.seedInput.value.trim();
  if (!seedPhrase) {
    showStatus('Please enter a seed phrase', 'error');
    return;
  }

  try {
    await sendMessage('importFromSeed', { seedPhrase });
    showStatus('Wallet imported successfully', 'success');
    loadWalletState();
  } catch (error) {
    showStatus(`Import failed: ${error}`, 'error');
  }
});

// Event: Cancel import seed
elements.btnCancelImport.addEventListener('click', () => {
  showSection('no-wallet');
});

// Event: Show import key form
elements.btnImportKey.addEventListener('click', () => {
  elements.keyInput.value = '';
  showSection('import-key');
});

// Event: Import from private key
elements.btnDoImportKey.addEventListener('click', async () => {
  const privateKey = elements.keyInput.value.trim();
  if (!privateKey) {
    showStatus('Please enter a private key', 'error');
    return;
  }

  try {
    await sendMessage('importFromKey', { privateKey });
    showStatus('Wallet imported successfully', 'success');
    loadWalletState();
  } catch (error) {
    showStatus(`Import failed: ${error}`, 'error');
  }
});

// Event: Cancel import key
elements.btnCancelImportKey.addEventListener('click', () => {
  showSection('no-wallet');
});

// Event: Show import hex form
elements.btnImportHex.addEventListener('click', () => {
  elements.hexInput.value = '';
  showSection('import-hex');
});

// Event: Import from hex seed
elements.btnDoImportHex.addEventListener('click', async () => {
  const hexSeed = elements.hexInput.value.trim();
  if (!hexSeed) {
    showStatus('Please enter a hex seed', 'error');
    return;
  }

  try {
    await sendMessage('importFromHexSeed', { hexSeed });
    showStatus('Wallet imported successfully', 'success');
    loadWalletState();
  } catch (error) {
    showStatus(`Import failed: ${error}`, 'error');
  }
});

// Event: Cancel import hex
elements.btnCancelImportHex.addEventListener('click', () => {
  showSection('no-wallet');
});

// Event: Copy address
elements.btnCopy.addEventListener('click', async () => {
  const address = elements.walletAddress.textContent;
  if (address && address !== '-') {
    await navigator.clipboard.writeText(address);
    showStatus('Address copied', 'success');
  }
});

// Event: Clear wallet
elements.btnClearWallet.addEventListener('click', async () => {
  if (confirm('Are you sure? You will need to re-import your wallet.')) {
    try {
      await sendMessage('clearWallet');
      showSection('no-wallet');
      showStatus('Wallet cleared', 'info');
    } catch (error) {
      showStatus(`Failed to clear wallet: ${error}`, 'error');
    }
  }
});

// Listen for balance updates from service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'balanceUpdate' && message.balance) {
    elements.walletBalance.textContent = message.balance.total;
  }
});

// ============================================
// Debug Panel
// ============================================

interface SyncProgress {
  percentage: number;
  appliedIndex: number;
  highestIndex: number;
  highestRelevantIndex: number;
  isComplete: boolean;
}

interface DustGenerationInfo {
  generationTime: string | null;
  maxCapacity: string;
  maxCapReachedAt: string;
  currentlyGenerated: string;
  rate: string;
}

interface CoinInfo {
  value: string;
  status: 'spendable' | 'pending' | 'spent';
  createdAt: string | null;
  sequenceNumber: number | null;
  merkleTreeIndex: string | null;
  backingNightNonce: string | null;
  generation: DustGenerationInfo | null;
}

interface ShieldedDebugState {
  balances: Record<string, string>;
  coinCount: number;
  address: string | null;
  syncProgress: SyncProgress | null;
}

interface UnshieldedDebugState {
  balance: string;
  utxoCount: number;
  isRegistered: boolean;
  syncProgress: SyncProgress | null;
}

interface TransactionInfo {
  id: string;
  type: 'transfer' | 'swap' | 'registration' | 'unknown';
  timestamp: string | null;
  status: 'confirmed' | 'pending' | 'failed';
  amount: string | null;
  tokenType: string | null;
}

interface DebugState {
  facadeStarted: boolean;
  syncProgress: SyncProgress | null;
  balance: {
    total: string;
    available: string;
    pending: string;
  } | null;
  coinCount: number;
  facadeStartTime: string | null;
  shielded: ShieldedDebugState | null;
  unshielded: UnshieldedDebugState | null;
  recentTransactions: TransactionInfo[];
}

type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

interface ServiceHealth {
  status: ServiceStatus;
  latency: number | null;
  lastChecked: string | null;
  error: string | null;
}

interface ConnectionStatus {
  node: ServiceHealth;
  indexer: ServiceHealth;
  prover: ServiceHealth;
}

// Format balance with denomination (following wallet-cli pattern)
// Divides by 10^6 and adds T/B/M suffixes
function formatBalance(value: bigint): string {
  const DENOMINATION = BigInt(10 ** 6);
  const denominated = value / DENOMINATION;
  const remainder = value % DENOMINATION;

  const TRILLION = BigInt(10 ** 12);
  const BILLION = BigInt(10 ** 9);
  const MILLION = BigInt(10 ** 6);

  if (denominated >= TRILLION) {
    const whole = denominated / TRILLION;
    const decimal = ((denominated % TRILLION) * 100n) / TRILLION;
    const decStr = decimal > 0 ? `.${decimal.toString().replace(/0+$/, '')}` : '';
    return `${whole.toLocaleString()}${decStr}T`;
  }
  if (denominated >= BILLION) {
    const whole = denominated / BILLION;
    const decimal = ((denominated % BILLION) * 100n) / BILLION;
    const decStr = decimal > 0 ? `.${decimal.toString().replace(/0+$/, '')}` : '';
    return `${whole.toLocaleString()}${decStr}B`;
  }
  if (denominated >= MILLION) {
    const whole = denominated / MILLION;
    const decimal = ((denominated % MILLION) * 100n) / MILLION;
    const decStr = decimal > 0 ? `.${decimal.toString().replace(/0+$/, '')}` : '';
    return `${whole.toLocaleString()}${decStr}M`;
  }

  // Below 1M - show full value with decimal from remainder
  const decimalPart = (remainder * 1000000n) / DENOMINATION;
  if (decimalPart > 0) {
    const decStr = decimalPart.toString().padStart(6, '0').replace(/0+$/, '');
    return `${denominated.toLocaleString()}.${decStr}`;
  }
  return denominated.toLocaleString();
}

// Format large numbers with commas (for raw display)
function formatNumber(value: string): string {
  try {
    return formatBalance(BigInt(value));
  } catch {
    return value;
  }
}

// Update debug panel with current state
async function updateDebugPanel(): Promise<void> {
  try {
    // Try to get detailed debug state first
    let debugState: DebugState | null = null;
    let coins: CoinInfo[] = [];
    let connectionStatus: ConnectionStatus | null = null;

    try {
      debugState = await sendMessage('getDebugState') as DebugState;
      coins = await sendMessage('getCoins') as CoinInfo[];
      connectionStatus = await sendMessage('getConnectionStatus') as ConnectionStatus;
    } catch {
      // Fallback to simple state if debug APIs not available
      const state = await sendMessage('getState') as { hasWallet: boolean; balance?: string };
      elements.syncProgressBar.style.width = state.hasWallet ? '100%' : '0%';
      elements.syncStatus.textContent = state.hasWallet ? 'Connected' : 'No wallet';
      elements.debugBalanceTotal.textContent = state.balance ? formatNumber(state.balance) : '-';
      elements.debugBalanceAvailable.textContent = state.balance ? formatNumber(state.balance) : '-';
      elements.debugBalancePending.textContent = '0';
      elements.debugCoinCount.textContent = '?';
      elements.debugCoinList.innerHTML = '<span class="empty">Coin details unavailable</span>';
      return;
    }

    // Update sync progress (following wallet-cli pattern: use highestRelevantIndex)
    if (debugState?.syncProgress) {
      const progress = debugState.syncProgress;
      // Use highestRelevantIndex like wallet-cli does
      const target = progress.highestRelevantIndex || progress.highestIndex || 0;
      const current = progress.appliedIndex || 0;
      const pct = target > 0 ? Math.round((current / target) * 100) : (current > 0 ? 100 : 0);

      elements.syncProgressBar.style.width = `${pct}%`;

      // Show detailed sync info (wallet-cli format: current/total (percentage%))
      const syncText = progress.isComplete || pct >= 100
        ? `Synced (${current.toLocaleString()})`
        : `${current.toLocaleString()}/${target.toLocaleString()} (${pct}%)`;
      elements.syncStatus.textContent = syncText;
      elements.syncStatus.className = progress.isComplete ? 'synced' : 'syncing';
      elements.syncStatus.title = `Applied: ${progress.appliedIndex}\nHighest: ${progress.highestIndex}\nRelevant: ${progress.highestRelevantIndex}`;

      // Update header sync badge
      elements.debugSyncBadge.textContent = progress.isComplete ? 'Synced' : `${pct}%`;
      elements.debugSyncBadge.className = `sync-badge ${progress.isComplete ? 'synced' : 'syncing'}`;
    } else if (debugState?.facadeStarted) {
      elements.syncProgressBar.style.width = '0%';
      elements.syncStatus.textContent = 'Starting...';
      elements.syncStatus.className = 'syncing';
      elements.debugSyncBadge.textContent = 'Starting';
      elements.debugSyncBadge.className = 'sync-badge syncing';
    } else {
      elements.syncProgressBar.style.width = '0%';
      elements.syncStatus.textContent = 'Not started';
      elements.syncStatus.className = '';
      elements.debugSyncBadge.textContent = '-';
      elements.debugSyncBadge.className = 'sync-badge';
    }

    // Update balance breakdown
    if (debugState?.balance) {
      elements.debugBalanceTotal.textContent = formatNumber(debugState.balance.total);
      elements.debugBalanceAvailable.textContent = formatNumber(debugState.balance.available);
      elements.debugBalancePending.textContent = formatNumber(debugState.balance.pending);
    } else {
      elements.debugBalanceTotal.textContent = '-';
      elements.debugBalanceAvailable.textContent = '-';
      elements.debugBalancePending.textContent = '-';
    }

    // Update coin list with detailed info
    elements.debugCoinCount.textContent = coins.length.toString();
    if (coins.length > 0) {
      elements.debugCoinList.innerHTML = coins.map((coin, index) => renderCoinItem(coin, index)).join('');
      // Add click handlers for expandable rows and restore expanded state
      elements.debugCoinList.querySelectorAll('.coin-item').forEach((item) => {
        const index = parseInt((item as HTMLElement).dataset.index ?? '0', 10);
        // Restore expanded state from previous render
        if (expandedCoinIndices.has(index)) {
          item.classList.add('expanded');
        }
        item.addEventListener('click', () => {
          item.classList.toggle('expanded');
          // Track expanded state
          if (item.classList.contains('expanded')) {
            expandedCoinIndices.add(index);
          } else {
            expandedCoinIndices.delete(index);
          }
        });
      });
    } else {
      elements.debugCoinList.textContent = '';
      const empty = document.createElement('span');
      empty.className = 'empty';
      empty.textContent = 'No coins';
      elements.debugCoinList.appendChild(empty);
    }

    // Update status bar health indicators
    if (connectionStatus) {
      updateStatusDot(elements.statusNode, 'Node', connectionStatus.node);
      updateStatusDot(elements.statusIndexer, 'Indexer', connectionStatus.indexer);
      updateStatusDot(elements.statusProver, 'Prover', connectionStatus.prover);
    }

    // Update shielded tab
    if (debugState?.shielded) {
      elements.shieldedNotAvailable.classList.add('hidden');
      elements.shieldedContent.classList.remove('hidden');

      elements.shieldedCoinCount.textContent = debugState.shielded.coinCount.toString();

      // Render balances by token type (with XSS protection)
      const balanceEntries = Object.entries(debugState.shielded.balances);
      if (balanceEntries.length > 0) {
        elements.shieldedBalances.innerHTML = balanceEntries
          .map(([tokenType, amount]) => `
            <div class="debug-value">
              <span class="label">${escapeHtml(formatTokenType(tokenType))}:</span>
              <span>${escapeHtml(formatNumber(amount))}</span>
            </div>
          `)
          .join('');
      } else {
        elements.shieldedBalances.textContent = '';
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-message';
        placeholder.textContent = 'No balances';
        elements.shieldedBalances.appendChild(placeholder);
      }

      // Update sync progress
      if (debugState.shielded.syncProgress) {
        const sp = debugState.shielded.syncProgress;
        elements.shieldedSyncProgress.textContent = sp.isComplete
          ? `Synced (${sp.appliedIndex})`
          : `${sp.percentage}% (${sp.appliedIndex}/${sp.highestIndex})`;
      } else {
        elements.shieldedSyncProgress.textContent = '-';
      }
    } else {
      elements.shieldedNotAvailable.classList.remove('hidden');
      elements.shieldedContent.classList.add('hidden');
    }

    // Update unshielded tab
    if (debugState?.unshielded) {
      elements.unshieldedNotAvailable.classList.add('hidden');
      elements.unshieldedContent.classList.remove('hidden');

      elements.unshieldedBalance.textContent = formatNumber(debugState.unshielded.balance);
      elements.unshieldedUtxoCount.textContent = debugState.unshielded.utxoCount.toString();
      elements.unshieldedRegistered.textContent = debugState.unshielded.isRegistered ? 'Yes' : 'No';
      elements.unshieldedRegistered.className = debugState.unshielded.isRegistered ? 'status-yes' : 'status-no';

      // Update sync progress
      if (debugState.unshielded.syncProgress) {
        const sp = debugState.unshielded.syncProgress;
        elements.unshieldedSyncProgress.textContent = sp.isComplete
          ? `Synced (${sp.appliedIndex})`
          : `${sp.percentage}% (${sp.appliedIndex}/${sp.highestIndex})`;
      } else {
        elements.unshieldedSyncProgress.textContent = '-';
      }
    } else {
      elements.unshieldedNotAvailable.classList.remove('hidden');
      elements.unshieldedContent.classList.add('hidden');
    }

    // Update transaction history tab (with XSS protection)
    if (debugState?.recentTransactions && debugState.recentTransactions.length > 0) {
      elements.txHistoryList.innerHTML = debugState.recentTransactions
        .slice(0, 10)
        .map((tx) => {
          const safeStatus = escapeHtml(tx.status);
          const safeType = escapeHtml(tx.type);
          const safeId = escapeHtml(tx.id);
          const safeAmount = tx.amount ? escapeHtml(formatNumber(tx.amount)) : '';
          const safeTokenType = tx.tokenType ? escapeHtml(formatTokenType(tx.tokenType)) : '';
          const safeTime = tx.timestamp ? escapeHtml(new Date(tx.timestamp).toLocaleString()) : '';

          return `
            <div class="tx-item ${safeStatus}">
              <div class="tx-header">
                <span class="tx-type">${safeType}</span>
                <span class="tx-status">${safeStatus}</span>
              </div>
              <div class="tx-details">
                ${safeAmount ? `<span class="tx-amount">${safeAmount} ${safeTokenType}</span>` : ''}
                ${safeTime ? `<span class="tx-time">${safeTime}</span>` : ''}
              </div>
              <div class="tx-id truncate" title="${safeId}">${safeId}</div>
            </div>
          `;
        })
        .join('');
    } else {
      elements.txHistoryList.textContent = '';
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder-message';
      placeholder.textContent = 'No transactions';
      elements.txHistoryList.appendChild(placeholder);
    }
  } catch (error) {
    console.error('[Lumen] Failed to update debug panel:', error);
  }
}

// Render a single coin item with expandable details
// Render a single coin item with XSS protection
function renderCoinItem(coin: CoinInfo, index: number): string {
  const statusClass = coin.status === 'spendable' ? 'spendable' : 'pending';
  const safeValue = escapeHtml(formatNumber(coin.value));
  const safeStatus = escapeHtml(coin.status);

  // Format creation time
  const createdAt = coin.createdAt
    ? escapeHtml(new Date(coin.createdAt).toLocaleString())
    : 'Unknown';

  const safeSeq = coin.sequenceNumber !== null ? escapeHtml(String(coin.sequenceNumber)) : '-';
  const safeMtIndex = coin.merkleTreeIndex ? escapeHtml(coin.merkleTreeIndex) : '-';
  const safeNonce = coin.backingNightNonce ? escapeHtml(coin.backingNightNonce) : '-';

  // Format generation info
  let generationHtml = '';
  if (coin.generation) {
    const gen = coin.generation;
    const genTime = gen.generationTime
      ? escapeHtml(new Date(gen.generationTime).toLocaleString())
      : 'Not started';
    const safeGenerated = escapeHtml(formatNumber(gen.currentlyGenerated));
    const safeMaxCap = escapeHtml(formatNumber(gen.maxCapacity));
    const safeRate = escapeHtml(formatNumber(gen.rate));

    generationHtml = `
      <div class="coin-detail">
        <span class="label">Generation:</span>
        <span>${genTime}</span>
      </div>
      <div class="coin-detail">
        <span class="label">Generated:</span>
        <span>${safeGenerated} / ${safeMaxCap}</span>
      </div>
      <div class="coin-detail">
        <span class="label">Rate:</span>
        <span>${safeRate}/block</span>
      </div>
    `;
  }

  return `
    <div class="coin-item ${statusClass}" data-index="${index}">
      <div class="coin-header">
        <span class="coin-value">${safeValue}</span>
        <span class="coin-status">${safeStatus}</span>
        <span class="coin-expand">▶</span>
      </div>
      <div class="coin-details">
        <div class="coin-detail">
          <span class="label">Created:</span>
          <span>${createdAt}</span>
        </div>
        <div class="coin-detail">
          <span class="label">Seq:</span>
          <span>${safeSeq}</span>
        </div>
        <div class="coin-detail">
          <span class="label">MT Index:</span>
          <span>${safeMtIndex}</span>
        </div>
        <div class="coin-detail">
          <span class="label">Backing NIGHT:</span>
          <span class="truncate">${safeNonce}</span>
        </div>
        ${generationHtml}
      </div>
    </div>
  `;
}

// Update a status bar dot with health info
function updateStatusDot(element: HTMLElement, serviceName: string, health: ServiceHealth): void {
  element.className = `status-dot ${health.status}`;

  // Build informative tooltip
  const lines: string[] = [];
  lines.push(`${serviceName}: ${health.status.charAt(0).toUpperCase() + health.status.slice(1)}`);

  if (health.latency !== null) {
    lines.push(`Latency: ${health.latency}ms`);
  }

  if (health.error) {
    lines.push(`Error: ${health.error}`);
  }

  if (health.lastChecked) {
    lines.push(`Checked: ${new Date(health.lastChecked).toLocaleTimeString()}`);
  }

  element.title = lines.join('\n');
}

// Toggle debug panel visibility
function toggleDebugPanel(): void {
  debugPanelVisible = !debugPanelVisible;

  if (debugPanelVisible) {
    elements.debugPanel.classList.remove('hidden');
    elements.btnDebugToggle.classList.add('active');

    // Start polling
    updateDebugPanel();
    debugPollingInterval = setInterval(updateDebugPanel, DEBUG_POLL_INTERVAL_MS);
  } else {
    elements.debugPanel.classList.add('hidden');
    elements.btnDebugToggle.classList.remove('active');

    // Stop polling
    if (debugPollingInterval) {
      clearInterval(debugPollingInterval);
      debugPollingInterval = null;
    }
  }
}

// Copy debug info to clipboard
// Icon SVGs for button states
const ICON_DOWNLOAD = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

async function copyDebugInfo(): Promise<void> {
  const btn = elements.btnCopyDebug;

  // Security: Warn user before copying sensitive wallet info
  const confirmed = confirm(
    'This will copy wallet debug info to your clipboard.\n\n' +
    'Warning: This includes your wallet address and balance.\n' +
    'Only share this information with trusted parties.\n\n' +
    'Continue?'
  );

  if (!confirmed) {
    return;
  }

  try {
    const state = await sendMessage('getState') as { hasWallet: boolean; address?: string; balance?: string; network?: string };

    // Try to get detailed debug state
    let debugState: DebugState | null = null;
    let coins: CoinInfo[] = [];
    let connectionStatus: ConnectionStatus | null = null;

    try {
      debugState = await sendMessage('getDebugState') as DebugState;
      coins = await sendMessage('getCoins') as CoinInfo[];
      connectionStatus = await sendMessage('getConnectionStatus') as ConnectionStatus;
    } catch {
      // Detailed state unavailable
    }

    // Redact sensitive coin data (keep counts but remove specific identifiers)
    const redactedCoins = coins.map((coin, index) => ({
      index,
      value: coin.value,
      status: coin.status,
      tokenType: coin.tokenType,
      // Redact specific identifiers
      id: '[redacted]',
    }));

    const debugInfo = {
      timestamp: new Date().toISOString(),
      hasWallet: state.hasWallet,
      address: state.address,
      balance: state.balance,
      network: state.network,
      debugState: debugState ? {
        ...debugState,
        // Keep summary info, no sensitive keys
      } : null,
      coinCount: coins.length,
      coins: redactedCoins,
      connectionStatus,
    };

    await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));

    // Show checkmark on button
    btn.innerHTML = ICON_CHECK;
    btn.style.background = '#4caf50';

    // Show status message
    showStatus('Copied to clipboard', 'success');

    setTimeout(() => {
      btn.innerHTML = ICON_DOWNLOAD;
      btn.style.background = '';
    }, 1500);
  } catch (error) {
    showStatus(`Failed to copy: ${error}`, 'error');
  }
}

// Event: Toggle debug panel
elements.btnDebugToggle.addEventListener('click', toggleDebugPanel);

// Event: Copy debug info
elements.btnCopyDebug.addEventListener('click', copyDebugInfo);

// Event: Tab switching
elements.debugTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const tabName = (tab as HTMLElement).dataset.tab;
    if (!tabName) return;

    // Update active tab button
    elements.debugTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active tab content
    elements.tabContents.forEach((content) => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
  });
});

// ============================================
// Wallet Addresses
// ============================================

interface WalletAddresses {
  shielded: string | null;
  unshielded: string | null;
  dust: string | null;
}

async function loadWalletAddresses(): Promise<void> {
  try {
    const addresses = await sendMessage('getWalletAddresses') as WalletAddresses;
    elements.walletShieldedAddress.textContent = addresses.shielded || 'Not available';
    elements.walletUnshieldedAddress.textContent = addresses.unshielded || 'Not available';
    // Dust address is already shown in walletAddress
  } catch (error) {
    console.error('[Lumen] Failed to load wallet addresses:', error);
  }
}

// Copy shielded address
elements.btnCopyShielded.addEventListener('click', async () => {
  const address = elements.walletShieldedAddress.textContent;
  if (address && address !== 'Not available' && address !== '-') {
    await navigator.clipboard.writeText(address);
    showStatus('Shielded address copied', 'success');
  }
});

// Copy unshielded address
elements.btnCopyUnshielded.addEventListener('click', async () => {
  const address = elements.walletUnshieldedAddress.textContent;
  if (address && address !== 'Not available' && address !== '-') {
    await navigator.clipboard.writeText(address);
    showStatus('Unshielded address copied', 'success');
  }
});

// ============================================
// Transfer Modal
// ============================================

interface TransferState {
  tokenType: 'shielded' | 'unshielded' | null;
  tokenId: string | null;
  amount: string;
  address: string;
  availableBalance: string;
}

let transferState: TransferState = {
  tokenType: null,
  tokenId: null,
  amount: '',
  address: '',
  availableBalance: '0',
};

function resetTransferState(): void {
  transferState = {
    tokenType: null,
    tokenId: null,
    amount: '',
    address: '',
    availableBalance: '0',
  };
}

function showTransferStep(step: number): void {
  // Hide all steps
  for (let i = 1; i <= 5; i++) {
    const stepEl = document.getElementById(`transfer-step-${i}`);
    if (stepEl) stepEl.classList.add('hidden');
  }
  elements.transferProcessing.classList.add('hidden');
  elements.transferResult.classList.add('hidden');

  // Show requested step
  const targetStep = document.getElementById(`transfer-step-${step}`);
  if (targetStep) targetStep.classList.remove('hidden');

  // Update step indicators
  elements.stepIndicators.forEach((indicator, index) => {
    indicator.classList.remove('active', 'completed');
    if (index + 1 < step) {
      indicator.classList.add('completed');
    } else if (index + 1 === step) {
      indicator.classList.add('active');
    }
  });
}

function openTransferModal(): void {
  resetTransferState();
  showTransferStep(1);
  elements.transferModal.classList.remove('hidden');
}

function closeTransferModal(): void {
  elements.transferModal.classList.add('hidden');
  resetTransferState();
}

// Open transfer modal
elements.btnTransfer.addEventListener('click', openTransferModal);
elements.btnCloseTransfer.addEventListener('click', closeTransferModal);

// Step 1: Select token type
elements.typeButtons.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const type = (btn as HTMLElement).dataset.type as 'shielded' | 'unshielded';
    transferState.tokenType = type;

    // Visual feedback
    elements.typeButtons.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');

    // Load tokens for the selected type
    await loadTokensForType(type);
    showTransferStep(2);
  });
});

async function loadTokensForType(type: 'shielded' | 'unshielded'): Promise<void> {
  elements.tokenList.innerHTML = '<div class="placeholder-message">Loading tokens...</div>';

  try {
    const debugState = await sendMessage('getDebugState') as DebugState;
    const tokens: Array<{ id: string; balance: string }> = [];

    if (type === 'shielded' && debugState.shielded?.balances) {
      for (const [tokenType, balance] of Object.entries(debugState.shielded.balances)) {
        if (BigInt(balance) > 0n) {
          tokens.push({ id: tokenType, balance });
        }
      }
    } else if (type === 'unshielded' && debugState.unshielded) {
      tokens.push({ id: 'NIGHT', balance: debugState.unshielded.balance });
    }

    if (tokens.length === 0) {
      elements.tokenList.innerHTML = '<div class="placeholder-message">No tokens available</div>';
      return;
    }

    elements.tokenList.innerHTML = tokens.map((token) => `
      <div class="token-item" data-token="${escapeHtml(token.id)}" data-balance="${escapeHtml(token.balance)}">
        <span class="token-name">${escapeHtml(token.id)}</span>
        <span class="token-balance">${escapeHtml(formatNumber(token.balance))}</span>
      </div>
    `).join('');

    // Add click handlers for token selection
    elements.tokenList.querySelectorAll('.token-item').forEach((item) => {
      item.addEventListener('click', () => {
        const tokenId = (item as HTMLElement).dataset.token!;
        const balance = (item as HTMLElement).dataset.balance!;
        transferState.tokenId = tokenId;
        transferState.availableBalance = balance;

        // Visual feedback
        elements.tokenList.querySelectorAll('.token-item').forEach((i) => i.classList.remove('selected'));
        item.classList.add('selected');

        // Move to step 3
        elements.transferTokenSymbol.textContent = tokenId;
        elements.transferAvailable.textContent = formatNumber(balance);
        elements.transferAmount.value = '';
        showTransferStep(3);
      });
    });
  } catch (error) {
    elements.tokenList.innerHTML = `<div class="placeholder-message">Error: ${error}</div>`;
  }
}

// Step navigation
elements.btnTransferBack1.addEventListener('click', () => showTransferStep(1));
elements.btnTransferBack2.addEventListener('click', () => showTransferStep(2));
elements.btnTransferBack3.addEventListener('click', () => showTransferStep(3));
elements.btnTransferBack4.addEventListener('click', () => showTransferStep(4));

elements.btnTransferNext3.addEventListener('click', () => {
  const amount = elements.transferAmount.value.trim();
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    showStatus('Please enter a valid amount', 'error');
    return;
  }

  // Check if amount exceeds available balance
  try {
    const amountBigInt = BigInt(Math.floor(Number(amount) * 1e6)); // Assuming 6 decimals
    const availableBigInt = BigInt(transferState.availableBalance);
    if (amountBigInt > availableBigInt) {
      showStatus('Amount exceeds available balance', 'error');
      return;
    }
  } catch {
    showStatus('Invalid amount format', 'error');
    return;
  }

  transferState.amount = amount;
  elements.transferAddress.value = '';
  showTransferStep(4);
});

elements.btnTransferNext4.addEventListener('click', () => {
  const address = elements.transferAddress.value.trim();
  if (!address) {
    showStatus('Please enter a recipient address', 'error');
    return;
  }

  transferState.address = address;

  // Show confirmation
  elements.confirmType.textContent = transferState.tokenType === 'shielded' ? 'Shielded' : 'Unshielded';
  elements.confirmToken.textContent = transferState.tokenId || '-';
  elements.confirmAmount.textContent = transferState.amount;
  elements.confirmAddress.textContent = address;
  showTransferStep(5);
});

elements.btnTransferConfirm.addEventListener('click', async () => {
  // Show processing
  for (let i = 1; i <= 5; i++) {
    const stepEl = document.getElementById(`transfer-step-${i}`);
    if (stepEl) stepEl.classList.add('hidden');
  }
  elements.transferProcessing.classList.remove('hidden');

  try {
    // Convert amount to smallest unit (assuming 6 decimals)
    const amountInSmallestUnit = BigInt(Math.floor(Number(transferState.amount) * 1e6));

    const result = await sendMessage('transfer', {
      tokenType: transferState.tokenType,
      tokenId: transferState.tokenId,
      receiverAddress: transferState.address,
      amount: amountInSmallestUnit.toString(),
    }) as { success: boolean; txId?: string };

    // Show success
    elements.transferProcessing.classList.add('hidden');
    elements.transferResult.classList.remove('hidden');
    elements.transferResultIcon.textContent = '✓';
    elements.transferResultIcon.classList.remove('error');
    elements.transferResultMessage.textContent = 'Transfer successful!';
    elements.transferTxId.textContent = result.txId || '';
  } catch (error) {
    // Show error
    elements.transferProcessing.classList.add('hidden');
    elements.transferResult.classList.remove('hidden');
    elements.transferResultIcon.textContent = '✗';
    elements.transferResultIcon.classList.add('error');
    elements.transferResultMessage.textContent = `Transfer failed: ${error}`;
    elements.transferTxId.textContent = '';
  }
});

elements.btnTransferDone.addEventListener('click', closeTransferModal);

// ============================================
// Dust Registration Modal
// ============================================

interface NightUtxoInfo {
  id: string;
  value: string;
  registeredForDustGeneration: boolean;
  tokenType: string;
}

// Track selected UTXOs for registration
let dustRegisterSelectedUtxos: { id: string; value: string }[] = [];

function openDustRegisterModal(): void {
  dustRegisterSelectedUtxos = [];
  showDustRegisterStep('select');
  loadUnregisteredUtxos();
  elements.dustReceiverAddress.value = '';
  elements.dustRegisterModal.classList.remove('hidden');
}

function closeDustRegisterModal(): void {
  elements.dustRegisterModal.classList.add('hidden');
  dustRegisterSelectedUtxos = [];
}

function showDustRegisterStep(step: 'select' | 'confirm' | 'processing' | 'result'): void {
  document.getElementById('dust-register-select')!.classList.toggle('hidden', step !== 'select');
  elements.dustRegisterConfirm.classList.toggle('hidden', step !== 'confirm');
  elements.dustRegisterProcessing.classList.toggle('hidden', step !== 'processing');
  elements.dustRegisterResult.classList.toggle('hidden', step !== 'result');
}

async function loadUnregisteredUtxos(): Promise<void> {
  elements.unregisteredUtxoList.innerHTML = '<div class="placeholder-message">Loading UTXOs...</div>';

  try {
    const utxos = await sendMessage('getUnregisteredNightUtxos') as NightUtxoInfo[];

    if (utxos.length === 0) {
      elements.unregisteredUtxoList.innerHTML = '<div class="placeholder-message">No unregistered UTXOs available</div>';
      return;
    }

    elements.unregisteredUtxoList.innerHTML = utxos.map((utxo) => `
      <label class="utxo-item">
        <input type="checkbox" value="${escapeHtml(utxo.id)}">
        <div class="utxo-info">
          <div class="utxo-value">${escapeHtml(formatNumber(utxo.value))} NIGHT</div>
          <div class="utxo-id">${escapeHtml(utxo.id.slice(0, 16))}...</div>
        </div>
      </label>
    `).join('');
  } catch (error) {
    elements.unregisteredUtxoList.innerHTML = `<div class="placeholder-message">Error: ${error}</div>`;
  }
}

elements.btnRegisterDust.addEventListener('click', openDustRegisterModal);
elements.btnCloseDustRegister.addEventListener('click', closeDustRegisterModal);
elements.btnDustRegisterCancel.addEventListener('click', closeDustRegisterModal);

// Step 1 → Step 2 (select → confirm)
elements.btnDustRegisterNext.addEventListener('click', () => {
  const checkboxes = elements.unregisteredUtxoList.querySelectorAll('input[type="checkbox"]:checked');

  if (checkboxes.length === 0) {
    showStatus('Please select at least one UTXO', 'error');
    return;
  }

  // Collect selected UTXOs with their values
  dustRegisterSelectedUtxos = Array.from(checkboxes).map((cb) => {
    const item = (cb as HTMLInputElement).closest('.utxo-item');
    const valueEl = item?.querySelector('.utxo-value');
    const valueText = valueEl?.textContent || '0';
    // Extract numeric value from "123,456 NIGHT"
    const valueMatch = valueText.replace(/,/g, '').match(/^(\d+)/);
    return {
      id: (cb as HTMLInputElement).value,
      value: valueMatch ? valueMatch[1] : '0',
    };
  });

  // Calculate total value
  const totalValue = dustRegisterSelectedUtxos.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);

  // Update confirmation screen
  elements.dustConfirmUtxoCount.textContent = `${dustRegisterSelectedUtxos.length} UTXO${dustRegisterSelectedUtxos.length > 1 ? 's' : ''}`;
  elements.dustConfirmTotalValue.textContent = `${formatNumber(totalValue.toString())} NIGHT`;

  const receiverAddress = elements.dustReceiverAddress.value.trim();
  elements.dustConfirmReceiver.textContent = receiverAddress || '(Default wallet address)';
  elements.dustConfirmReceiver.title = receiverAddress || '';

  showDustRegisterStep('confirm');
});

// Back from confirm to select
elements.btnDustRegisterBack.addEventListener('click', () => showDustRegisterStep('select'));

// Submit registration
elements.btnDustRegisterSubmit.addEventListener('click', async () => {
  showDustRegisterStep('processing');

  try {
    const selectedIds = dustRegisterSelectedUtxos.map((u) => u.id);
    const params: { utxoIds: string[]; dustReceiverAddress?: string } = { utxoIds: selectedIds };
    const customAddress = elements.dustReceiverAddress.value.trim();
    if (customAddress) {
      params.dustReceiverAddress = customAddress;
    }

    const result = await sendMessage('registerForDust', params) as { success: boolean; txId?: string };

    showDustRegisterStep('result');
    elements.dustRegisterResultIcon.textContent = '✓';
    elements.dustRegisterResultIcon.classList.remove('error');
    elements.dustRegisterResultMessage.textContent = 'Registration successful!';
    elements.dustRegisterTxId.textContent = result.txId || '';
  } catch (error) {
    showDustRegisterStep('result');
    elements.dustRegisterResultIcon.textContent = '✗';
    elements.dustRegisterResultIcon.classList.add('error');
    elements.dustRegisterResultMessage.textContent = `Registration failed: ${error}`;
    elements.dustRegisterTxId.textContent = '';
  }
});

elements.btnDustRegisterDone.addEventListener('click', closeDustRegisterModal);

// ============================================
// Dust Deregistration Modal
// ============================================

// Track selected UTXOs for deregistration
let dustDeregisterSelectedUtxos: { id: string; value: string }[] = [];

function openDustDeregisterModal(): void {
  dustDeregisterSelectedUtxos = [];
  showDustDeregisterStep('select');
  loadRegisteredUtxos();
  elements.dustDeregisterModal.classList.remove('hidden');
}

function closeDustDeregisterModal(): void {
  elements.dustDeregisterModal.classList.add('hidden');
  dustDeregisterSelectedUtxos = [];
}

function showDustDeregisterStep(step: 'select' | 'confirm' | 'processing' | 'result'): void {
  document.getElementById('dust-deregister-select')!.classList.toggle('hidden', step !== 'select');
  elements.dustDeregisterConfirm.classList.toggle('hidden', step !== 'confirm');
  elements.dustDeregisterProcessing.classList.toggle('hidden', step !== 'processing');
  elements.dustDeregisterResult.classList.toggle('hidden', step !== 'result');
}

async function loadRegisteredUtxos(): Promise<void> {
  elements.registeredUtxoList.innerHTML = '<div class="placeholder-message">Loading UTXOs...</div>';

  try {
    const utxos = await sendMessage('getRegisteredNightUtxos') as NightUtxoInfo[];

    if (utxos.length === 0) {
      elements.registeredUtxoList.innerHTML = '<div class="placeholder-message">No registered UTXOs available</div>';
      return;
    }

    elements.registeredUtxoList.innerHTML = utxos.map((utxo) => `
      <label class="utxo-item">
        <input type="checkbox" value="${escapeHtml(utxo.id)}">
        <div class="utxo-info">
          <div class="utxo-value">${escapeHtml(formatNumber(utxo.value))} NIGHT</div>
          <div class="utxo-id">${escapeHtml(utxo.id.slice(0, 16))}...</div>
        </div>
      </label>
    `).join('');
  } catch (error) {
    elements.registeredUtxoList.innerHTML = `<div class="placeholder-message">Error: ${error}</div>`;
  }
}

elements.btnDeregisterDust.addEventListener('click', openDustDeregisterModal);
elements.btnCloseDustDeregister.addEventListener('click', closeDustDeregisterModal);
elements.btnDustDeregisterCancel.addEventListener('click', closeDustDeregisterModal);

// Step 1 → Step 2 (select → confirm)
elements.btnDustDeregisterNext.addEventListener('click', () => {
  const checkboxes = elements.registeredUtxoList.querySelectorAll('input[type="checkbox"]:checked');

  if (checkboxes.length === 0) {
    showStatus('Please select at least one UTXO', 'error');
    return;
  }

  // Collect selected UTXOs with their values
  dustDeregisterSelectedUtxos = Array.from(checkboxes).map((cb) => {
    const item = (cb as HTMLInputElement).closest('.utxo-item');
    const valueEl = item?.querySelector('.utxo-value');
    const valueText = valueEl?.textContent || '0';
    // Extract numeric value from "123,456 NIGHT"
    const valueMatch = valueText.replace(/,/g, '').match(/^(\d+)/);
    return {
      id: (cb as HTMLInputElement).value,
      value: valueMatch ? valueMatch[1] : '0',
    };
  });

  // Calculate total value
  const totalValue = dustDeregisterSelectedUtxos.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);

  // Update confirmation screen
  elements.deregisterConfirmUtxoCount.textContent = `${dustDeregisterSelectedUtxos.length} UTXO${dustDeregisterSelectedUtxos.length > 1 ? 's' : ''}`;
  elements.deregisterConfirmTotalValue.textContent = `${formatNumber(totalValue.toString())} NIGHT`;

  showDustDeregisterStep('confirm');
});

// Back from confirm to select
elements.btnDustDeregisterBack.addEventListener('click', () => showDustDeregisterStep('select'));

// Submit deregistration
elements.btnDustDeregisterSubmit.addEventListener('click', async () => {
  showDustDeregisterStep('processing');

  try {
    const selectedIds = dustDeregisterSelectedUtxos.map((u) => u.id);
    const result = await sendMessage('deregisterFromDust', { utxoIds: selectedIds }) as { success: boolean; txId?: string };

    showDustDeregisterStep('result');
    elements.dustDeregisterResultIcon.textContent = '✓';
    elements.dustDeregisterResultIcon.classList.remove('error');
    elements.dustDeregisterResultMessage.textContent = 'Deregistration successful!';
    elements.dustDeregisterTxId.textContent = result.txId || '';
  } catch (error) {
    showDustDeregisterStep('result');
    elements.dustDeregisterResultIcon.textContent = '✗';
    elements.dustDeregisterResultIcon.classList.add('error');
    elements.dustDeregisterResultMessage.textContent = `Deregistration failed: ${error}`;
    elements.dustDeregisterTxId.textContent = '';
  }
});

elements.btnDustDeregisterDone.addEventListener('click', closeDustDeregisterModal);

// ============================================
// Settings Modal
// ============================================

interface NetworkUrls {
  nodeUrl: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proverUrl: string;
}

const networkDefaults: Record<string, NetworkUrls> = {
  localnet: {
    nodeUrl: 'ws://localhost:9944',
    indexerUrl: 'http://localhost:8088/api/v3/graphql',
    indexerWsUrl: 'ws://localhost:8088/api/v3/graphql/ws',
    proverUrl: 'http://localhost:6300',
  },
  devnet: {
    nodeUrl: 'wss://rpc.devnet.midnight.network',
    indexerUrl: 'https://indexer.devnet.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.devnet.midnight.network/api/v3/graphql/ws',
    proverUrl: 'https://prover.devnet.midnight.network',
  },
  qanet: {
    nodeUrl: 'wss://rpc.qanet.dev.midnight.network',
    indexerUrl: 'https://indexer.qanet.dev.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.qanet.dev.midnight.network/api/v3/graphql/ws',
    proverUrl: 'https://prover.qanet.dev.midnight.network',
  },
  preview: {
    nodeUrl: 'wss://rpc.preview.midnight.network',
    indexerUrl: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    proverUrl: 'https://prover.preview.midnight.network',
  },
  preprod: {
    nodeUrl: 'wss://rpc.preprod.midnight.network',
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    proverUrl: 'https://prover.preprod.midnight.network',
  },
};

async function openSettingsModal(): Promise<void> {
  // Load current settings
  try {
    const state = await sendMessage('getState') as { network?: string };
    const urls = await sendMessage('getNetworkUrls') as NetworkUrls;

    elements.settingsNetwork.value = state.network || 'devnet';
    elements.settingsNodeUrl.value = urls.nodeUrl;
    elements.settingsIndexerUrl.value = urls.indexerUrl;
    elements.settingsIndexerWsUrl.value = urls.indexerWsUrl;
    elements.settingsProverUrl.value = urls.proverUrl;
  } catch (error) {
    console.error('[Lumen] Failed to load settings:', error);
  }

  elements.settingsStatus.classList.add('hidden');
  elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal(): void {
  elements.settingsModal.classList.add('hidden');
}

elements.btnSettings.addEventListener('click', openSettingsModal);
elements.btnCloseSettings.addEventListener('click', closeSettingsModal);

// Update URLs when network changes
elements.settingsNetwork.addEventListener('change', () => {
  const network = elements.settingsNetwork.value;
  const defaults = networkDefaults[network];
  if (defaults) {
    elements.settingsNodeUrl.value = defaults.nodeUrl;
    elements.settingsIndexerUrl.value = defaults.indexerUrl;
    elements.settingsIndexerWsUrl.value = defaults.indexerWsUrl;
    elements.settingsProverUrl.value = defaults.proverUrl;
  }
});

elements.btnSettingsReset.addEventListener('click', () => {
  const network = elements.settingsNetwork.value;
  const defaults = networkDefaults[network];
  if (defaults) {
    elements.settingsNodeUrl.value = defaults.nodeUrl;
    elements.settingsIndexerUrl.value = defaults.indexerUrl;
    elements.settingsIndexerWsUrl.value = defaults.indexerWsUrl;
    elements.settingsProverUrl.value = defaults.proverUrl;
    showSettingsStatus('Reset to defaults', 'success');
  }
});

elements.btnSettingsApply.addEventListener('click', async () => {
  const network = elements.settingsNetwork.value;

  try {
    showSettingsStatus('Applying settings...', 'info');

    await sendMessage('setNetwork', {
      network,
      customUrls: {
        nodeUrl: elements.settingsNodeUrl.value,
        indexerUrl: elements.settingsIndexerUrl.value,
        indexerWsUrl: elements.settingsIndexerWsUrl.value,
        proverUrl: elements.settingsProverUrl.value,
      },
    });

    showSettingsStatus('Settings applied! Wallet facade restarting...', 'success');

    // Update initial network selector too
    elements.networkSelectInitial.value = network;

    // Close after a delay
    setTimeout(() => {
      closeSettingsModal();
      loadWalletState();
    }, 1500);
  } catch (error) {
    showSettingsStatus(`Failed to apply settings: ${error}`, 'error');
  }
});

function showSettingsStatus(message: string, type: 'success' | 'error' | 'info'): void {
  elements.settingsStatus.textContent = message;
  elements.settingsStatus.className = `settings-status ${type}`;
  elements.settingsStatus.classList.remove('hidden');
}

// ============================================
// Show/Hide Header Buttons Based on Wallet State
// ============================================

function updateHeaderButtons(hasWallet: boolean): void {
  elements.btnSettings.classList.toggle('hidden', !hasWallet);
}

// ============================================
// Initialize
// ============================================

// Modify loadWalletState to also load addresses and update header
const originalLoadWalletState = loadWalletState;
loadWalletState = async function(): Promise<void> {
  await originalLoadWalletState();

  // Check if wallet is loaded and fetch addresses
  try {
    const state = await sendMessage('getState') as { hasWallet: boolean };
    updateHeaderButtons(state.hasWallet);
    if (state.hasWallet) {
      await loadWalletAddresses();
    }
  } catch {
    updateHeaderButtons(false);
  }
};

// Initialize
loadWalletState();

// Start debug panel polling (debug panel is always visible)
elements.btnDebugToggle.classList.add('active');
updateDebugPanel();
debugPollingInterval = setInterval(updateDebugPanel, DEBUG_POLL_INTERVAL_MS);
