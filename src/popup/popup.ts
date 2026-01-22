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
  networkSelect: document.getElementById('network-select') as HTMLSelectElement,
  networkSelectInitial: document.getElementById('network-select-initial') as HTMLSelectElement,
  customRpc: document.getElementById('custom-rpc')!,
  rpcUrl: document.getElementById('rpc-url') as HTMLInputElement,
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
  btnRefresh: document.getElementById('btn-refresh')!,
  btnTestConnection: document.getElementById('btn-test-connection')!,
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
  syncProgressBar: document.getElementById('sync-progress-bar')!,
  syncStatus: document.getElementById('sync-status')!,
  debugBalanceTotal: document.getElementById('debug-balance-total')!,
  debugBalanceAvailable: document.getElementById('debug-balance-available')!,
  debugBalancePending: document.getElementById('debug-balance-pending')!,
  debugCoinCount: document.getElementById('debug-coin-count')!,
  debugCoinList: document.getElementById('debug-coin-list')!,
  debugIndexerStatus: document.getElementById('debug-indexer-status')!,
  debugNodeStatus: document.getElementById('debug-node-status')!,
};

// State
let currentSeedPhrase: string[] | null = null;
let debugPanelVisible = false;
let debugPollingInterval: ReturnType<typeof setInterval> | null = null;
const DEBUG_POLL_INTERVAL_MS = 1000;

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

    // Update network selects
    if (state.network) {
      elements.networkSelect.value = state.network;
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

// Event: Refresh balance
elements.btnRefresh.addEventListener('click', async () => {
  try {
    elements.walletBalance.textContent = 'Loading...';
    const balance = (await sendMessage('refreshBalance')) as { total: string };
    elements.walletBalance.textContent = balance.total;
    showStatus('Balance refreshed', 'success');
  } catch (error) {
    elements.walletBalance.textContent = 'Error';
    showStatus(`Failed to refresh: ${error}`, 'error');
  }
});

// Event: Network change (wallet loaded state)
elements.networkSelect.addEventListener('change', async () => {
  const network = elements.networkSelect.value;
  elements.customRpc.classList.toggle('hidden', network !== 'custom');

  if (network !== 'custom') {
    try {
      await sendMessage('setNetwork', { network });
      showStatus(`Switched to ${network}`, 'success');
    } catch (error) {
      showStatus(`Failed to switch network: ${error}`, 'error');
    }
  }
});

// Event: Test connection
elements.btnTestConnection.addEventListener('click', async () => {
  try {
    showStatus('Testing connection...', 'info');
    const status = (await sendMessage('testConnection')) as {
      connected: boolean;
      blockHeight?: number;
      error?: string;
    };
    if (status.connected) {
      showStatus(`Connected (block ${status.blockHeight})`, 'success');
    } else {
      showStatus(`Connection failed: ${status.error}`, 'error');
    }
  } catch (error) {
    showStatus(`Connection failed: ${error}`, 'error');
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

interface DebugState {
  facadeStarted: boolean;
  syncProgress: {
    percentage: number;
    currentBlock: number;
    targetBlock: number;
    isComplete: boolean;
  } | null;
  balance: {
    total: bigint;
    available: bigint;
    pending: bigint;
  } | null;
  coinCount: number;
  facadeStartTime: string | null;
}

interface CoinInfo {
  value: string;
  status: 'spendable' | 'pending' | 'spent';
}

interface ConnectionStatus {
  indexerWs: 'connected' | 'connecting' | 'disconnected' | 'unknown';
  nodeRpc: 'unknown';
  lastError: string | null;
}

// Format large numbers with commas
function formatNumber(value: string): string {
  return BigInt(value).toLocaleString();
}

// Update debug panel with current state
async function updateDebugPanel(): Promise<void> {
  try {
    // Use simple getState which we know works
    const state = await sendMessage('getState') as { hasWallet: boolean; address?: string; balance?: string; network?: string };

    // Update sync status based on whether we have balance
    if (state.hasWallet) {
      if (state.balance && state.balance !== '0' && state.balance !== 'Loading...') {
        elements.syncProgressBar.style.width = '100%';
        elements.syncStatus.textContent = 'Synced';
        elements.syncStatus.className = 'synced';
      } else {
        elements.syncProgressBar.style.width = '50%';
        elements.syncStatus.textContent = 'Syncing...';
        elements.syncStatus.className = 'syncing';
      }

      // Update balance breakdown (simple version using existing balance)
      const balance = state.balance || '0';
      elements.debugBalanceTotal.textContent = formatNumber(balance);
      elements.debugBalanceAvailable.textContent = formatNumber(balance);
      elements.debugBalancePending.textContent = '0';
    } else {
      elements.syncProgressBar.style.width = '0%';
      elements.syncStatus.textContent = 'No wallet';
      elements.syncStatus.className = '';
      elements.debugBalanceTotal.textContent = '-';
      elements.debugBalanceAvailable.textContent = '-';
      elements.debugBalancePending.textContent = '-';
    }

    // Simplified coin list - just show count based on balance
    const hasCoins = state.balance && state.balance !== '0' && state.balance !== 'Loading...';
    elements.debugCoinCount.textContent = hasCoins ? '?' : '0';
    elements.debugCoinList.innerHTML = hasCoins
      ? '<span class="empty">Coin details unavailable</span>'
      : '<span class="empty">No coins</span>';

    // Connection status - infer from whether we got state
    updateConnectionIndicator(elements.debugIndexerStatus, state.hasWallet ? 'connected' : 'unknown');
    updateConnectionIndicator(elements.debugNodeStatus, 'unknown');
  } catch (error) {
    console.error('[Lumen] Failed to update debug panel:', error);
  }
}

// Update a connection status indicator
function updateConnectionIndicator(
  element: HTMLElement,
  status: 'connected' | 'connecting' | 'disconnected' | 'unknown' | 'error'
): void {
  element.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  element.className = `status-indicator ${status}`;
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
  try {
    const state = await sendMessage('getState') as { hasWallet: boolean; address?: string; balance?: string; network?: string };

    const debugInfo = {
      timestamp: new Date().toISOString(),
      hasWallet: state.hasWallet,
      address: state.address,
      balance: state.balance,
      network: state.network,
    };

    await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    showStatus('Debug info copied to clipboard', 'success');
  } catch (error) {
    showStatus(`Failed to copy: ${error}`, 'error');
  }
}

// Event: Toggle debug panel
elements.btnDebugToggle.addEventListener('click', toggleDebugPanel);

// Event: Copy debug info
elements.btnCopyDebug.addEventListener('click', copyDebugInfo);

// Initialize
loadWalletState();
