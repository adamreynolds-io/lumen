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
  status: document.getElementById('status')!,

  // Wallet info
  walletAddress: document.getElementById('wallet-address')!,
  walletBalance: document.getElementById('wallet-balance')!,
  networkSelect: document.getElementById('network-select') as HTMLSelectElement,
  customRpc: document.getElementById('custom-rpc')!,
  rpcUrl: document.getElementById('rpc-url') as HTMLInputElement,
  seedWords: document.getElementById('seed-words')!,
  seedInput: document.getElementById('seed-input') as HTMLTextAreaElement,
  keyInput: document.getElementById('key-input') as HTMLInputElement,

  // Buttons
  btnGenerate: document.getElementById('btn-generate')!,
  btnImportSeed: document.getElementById('btn-import-seed')!,
  btnImportKey: document.getElementById('btn-import-key')!,
  btnCopy: document.getElementById('btn-copy')!,
  btnCopySeed: document.getElementById('btn-copy-seed')!,
  btnTestConnection: document.getElementById('btn-test-connection')!,
  btnClearWallet: document.getElementById('btn-clear-wallet')!,
  btnConfirmSeed: document.getElementById('btn-confirm-seed')!,
  btnDoImportSeed: document.getElementById('btn-do-import-seed')!,
  btnCancelImport: document.getElementById('btn-cancel-import')!,
  btnDoImportKey: document.getElementById('btn-do-import-key')!,
  btnCancelImportKey: document.getElementById('btn-cancel-import-key')!,
};

// State
let currentSeedPhrase: string[] | null = null;

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
    copyBtn.textContent = '📋 Copy';
    copyBtn.className = 'copy-error-btn';
    copyBtn.onclick = async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(message);
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => copyBtn.textContent = '📋 Copy', 1500);
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
function showSection(section: 'no-wallet' | 'wallet' | 'seed-display' | 'import-seed' | 'import-key'): void {
  elements.noWallet.classList.add('hidden');
  elements.walletLoaded.classList.add('hidden');
  elements.seedDisplay.classList.add('hidden');
  elements.importSeed.classList.add('hidden');
  elements.importKey.classList.add('hidden');

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
  }
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

    if (state.hasWallet && state.address) {
      elements.walletAddress.textContent = state.address;
      elements.walletBalance.textContent = state.balance ?? 'Loading...';
      if (state.network) {
        elements.networkSelect.value = state.network;
      }
      showSection('wallet');
    } else {
      showSection('no-wallet');
    }
  } catch (error) {
    console.error('[Lumen] Failed to load state:', error);
    showSection('no-wallet');
  }
}

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
    elements.btnCopySeed.textContent = '✓ Copied!';
    setTimeout(() => {
      elements.btnCopySeed.textContent = '📋 Copy Seed Phrase';
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

// Event: Copy address
elements.btnCopy.addEventListener('click', async () => {
  const address = elements.walletAddress.textContent;
  if (address && address !== '-') {
    await navigator.clipboard.writeText(address);
    showStatus('Address copied', 'success');
  }
});

// Event: Network change
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
    await sendMessage('testConnection');
    showStatus('Connection successful', 'success');
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

// Initialize
loadWalletState();
