/**
 * Popup UI Logic
 *
 * Handles user interactions in the extension popup.
 * Communicates with service worker for wallet operations.
 */

console.log('[Lumen] Popup loaded');

// DOM Elements
const elements = {
  // Sections
  noWallet: document.getElementById('no-wallet')!,
  walletLoaded: document.getElementById('wallet-loaded')!,
  seedDisplay: document.getElementById('seed-display')!,
  importSeed: document.getElementById('import-seed')!,
  importKey: document.getElementById('import-key')!,
  importHex: document.getElementById('import-hex')!,
  status: document.getElementById('status')!,
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
  shieldedAddress: document.getElementById('shielded-address')!,
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

// Helper: Show status message
function showStatus(message: string, type: 'success' | 'error' | 'info'): void {
  // Clear previous content
  elements.status.innerHTML = '';

  // Add message text
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  elements.status.appendChild(messageSpan);

  // Add copy button for errors
  if (type === 'error') {
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.className = 'copy-error-btn';
    copyBtn.onclick = async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(message);
      copyBtn.textContent = 'Copied';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
    };
    elements.status.appendChild(copyBtn);
  }

  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');

  // Auto-hide after delay (longer for errors)
  const delay = type === 'error' ? 10000 : 3000;
  setTimeout(() => elements.status.classList.add('hidden'), delay);
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

// Format large numbers with commas
function formatNumber(value: string): string {
  return BigInt(value).toLocaleString();
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

    // Update sync progress
    if (debugState?.syncProgress) {
      const progress = debugState.syncProgress;
      elements.syncProgressBar.style.width = `${progress.percentage}%`;

      // Show detailed sync info
      const syncText = progress.isComplete
        ? `Synced (${progress.appliedIndex})`
        : `${progress.percentage}% (${progress.appliedIndex}/${progress.highestIndex})`;
      elements.syncStatus.textContent = syncText;
      elements.syncStatus.className = progress.isComplete ? 'synced' : 'syncing';
      elements.syncStatus.title = `Applied: ${progress.appliedIndex}\nHighest: ${progress.highestIndex}\nRelevant: ${progress.highestRelevantIndex}`;

      // Update header sync badge
      elements.debugSyncBadge.textContent = progress.isComplete ? 'Synced' : `${progress.percentage}%`;
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
      elements.debugCoinList.innerHTML = '<span class="empty">No coins</span>';
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

      elements.shieldedAddress.textContent = debugState.shielded.address ?? '-';
      elements.shieldedAddress.title = debugState.shielded.address ?? '';
      elements.shieldedCoinCount.textContent = debugState.shielded.coinCount.toString();

      // Render balances by token type
      const balanceEntries = Object.entries(debugState.shielded.balances);
      if (balanceEntries.length > 0) {
        elements.shieldedBalances.innerHTML = balanceEntries
          .map(([tokenType, amount]) => `
            <div class="debug-value">
              <span class="label">${tokenType}:</span>
              <span>${formatNumber(amount)}</span>
            </div>
          `)
          .join('');
      } else {
        elements.shieldedBalances.innerHTML = '<div class="placeholder-message"><span>No balances</span></div>';
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

    // Update transaction history tab
    if (debugState?.recentTransactions && debugState.recentTransactions.length > 0) {
      elements.txHistoryList.innerHTML = debugState.recentTransactions
        .slice(0, 10)
        .map((tx) => `
          <div class="tx-item ${tx.status}">
            <div class="tx-header">
              <span class="tx-type">${tx.type}</span>
              <span class="tx-status">${tx.status}</span>
            </div>
            <div class="tx-details">
              ${tx.amount ? `<span class="tx-amount">${formatNumber(tx.amount)} ${tx.tokenType ?? ''}</span>` : ''}
              ${tx.timestamp ? `<span class="tx-time">${new Date(tx.timestamp).toLocaleString()}</span>` : ''}
            </div>
            <div class="tx-id truncate" title="${tx.id}">${tx.id}</div>
          </div>
        `)
        .join('');
    } else {
      elements.txHistoryList.innerHTML = '<div class="placeholder-message"><span>No transactions</span></div>';
    }
  } catch (error) {
    console.error('[Lumen] Failed to update debug panel:', error);
  }
}

// Render a single coin item with expandable details
function renderCoinItem(coin: CoinInfo, index: number): string {
  const statusClass = coin.status === 'spendable' ? 'spendable' : 'pending';
  const value = formatNumber(coin.value);

  // Format creation time
  const createdAt = coin.createdAt
    ? new Date(coin.createdAt).toLocaleString()
    : 'Unknown';

  // Format generation info
  let generationHtml = '';
  if (coin.generation) {
    const gen = coin.generation;
    const genTime = gen.generationTime
      ? new Date(gen.generationTime).toLocaleString()
      : 'Not started';
    generationHtml = `
      <div class="coin-detail">
        <span class="label">Generation:</span>
        <span>${genTime}</span>
      </div>
      <div class="coin-detail">
        <span class="label">Generated:</span>
        <span>${formatNumber(gen.currentlyGenerated)} / ${formatNumber(gen.maxCapacity)}</span>
      </div>
      <div class="coin-detail">
        <span class="label">Rate:</span>
        <span>${formatNumber(gen.rate)}/block</span>
      </div>
    `;
  }

  return `
    <div class="coin-item ${statusClass}" data-index="${index}">
      <div class="coin-header">
        <span class="coin-value">${value}</span>
        <span class="coin-status">${coin.status}</span>
        <span class="coin-expand">▶</span>
      </div>
      <div class="coin-details">
        <div class="coin-detail">
          <span class="label">Created:</span>
          <span>${createdAt}</span>
        </div>
        <div class="coin-detail">
          <span class="label">Seq:</span>
          <span>${coin.sequenceNumber ?? '-'}</span>
        </div>
        <div class="coin-detail">
          <span class="label">MT Index:</span>
          <span>${coin.merkleTreeIndex ?? '-'}</span>
        </div>
        <div class="coin-detail">
          <span class="label">Backing NIGHT:</span>
          <span class="truncate">${coin.backingNightNonce ?? '-'}</span>
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
async function copyDebugInfo(): Promise<void> {
  const btn = elements.btnCopyDebug;
  const originalHTML = btn.innerHTML;

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

    const debugInfo = {
      timestamp: new Date().toISOString(),
      hasWallet: state.hasWallet,
      address: state.address,
      balance: state.balance,
      network: state.network,
      debugState,
      coins,
      connectionStatus,
    };

    await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));

    // Show checkmark on button
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    btn.style.background = '#4caf50';

    setTimeout(() => {
      btn.innerHTML = originalHTML;
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

// Initialize
loadWalletState();

// Start debug panel polling (debug panel is always visible)
elements.btnDebugToggle.classList.add('active');
updateDebugPanel();
debugPollingInterval = setInterval(updateDebugPanel, DEBUG_POLL_INTERVAL_MS);
