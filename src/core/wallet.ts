/**
 * Wallet Core
 *
 * Handles wallet generation, import, key derivation, and signing.
 * Uses @midnight-ntwrk/wallet-sdk-hd for HD wallet operations.
 */

import {
  generateMnemonicWords,
  validateMnemonic,
  joinMnemonicWords,
  mnemonicToWords,
  HDWallet,
  Roles,
  type Role,
} from '@midnight-ntwrk/wallet-sdk-hd';

import { mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

// Note: @midnight-ntwrk/wallet-sdk-address-format has Node.js/WASM dependencies
// that don't work in browser extension context. Using hex addresses for now.
// TODO: Implement bech32m encoding manually or wait for browser-compatible SDK

// ============================================
// Types
// ============================================

export interface WalletKeys {
  /** 64-byte seed derived from mnemonic */
  seed: Uint8Array;
  /** Derived Dust key for gas payments */
  dustKey: Uint8Array;
  /** Derived Night External key */
  nightExternalKey: Uint8Array;
  /** Derived Night Internal key */
  nightInternalKey: Uint8Array;
}

export interface WalletInfo {
  /** Bech32m encoded address */
  address: string;
  /** Hex-encoded public key */
  publicKeyHex: string;
  /** Network ID used for address encoding */
  networkId: string;
}

export type WalletResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================
// Constants
// ============================================

/** Default account index for key derivation */
const DEFAULT_ACCOUNT = 0;

/** Default key index for derivation */
const DEFAULT_INDEX = 0;

/** Network IDs for address encoding */
export const NETWORK_IDS: Record<string, string> = {
  localnet: 'localnet',
  devnet: 'devnet',
  qanet: 'qanet',
  preview: 'preview',
  preprod: 'preprod',
};

// ============================================
// Mnemonic Operations
// ============================================

/**
 * Generate a new 24-word BIP39 mnemonic phrase.
 */
export function generateMnemonic(): string[] {
  return generateMnemonicWords();
}

/**
 * Validate a BIP39 mnemonic phrase.
 */
export function isValidMnemonic(words: string[] | string): boolean {
  const mnemonic = Array.isArray(words) ? joinMnemonicWords(words) : words;
  return validateMnemonic(mnemonic);
}

/**
 * Convert mnemonic words to a seed using BIP39 derivation.
 * @param words Mnemonic as array or space-separated string
 * @param passphrase Optional BIP39 passphrase (empty string by default)
 */
export function mnemonicToSeed(words: string[] | string, passphrase = ''): Uint8Array {
  const mnemonic = Array.isArray(words) ? joinMnemonicWords(words) : words;
  return mnemonicToSeedSync(mnemonic, passphrase);
}

// ============================================
// Key Derivation
// ============================================

/**
 * Derive wallet keys from a seed.
 */
export function deriveKeys(
  seed: Uint8Array,
  account = DEFAULT_ACCOUNT,
  index = DEFAULT_INDEX
): WalletResult<WalletKeys> {
  const walletResult = HDWallet.fromSeed(seed);

  if (walletResult.type !== 'seedOk') {
    return {
      success: false,
      error: `Failed to create HD wallet: ${walletResult.type}`,
    };
  }

  const accountKey = walletResult.hdWallet.selectAccount(account);

  // Derive keys for each role
  const deriveRole = (role: Role): Uint8Array | null => {
    const result = accountKey.selectRole(role).deriveKeyAt(index);
    return result.type === 'keyDerived' ? result.key : null;
  };

  const dustKey = deriveRole(Roles.Dust);
  const nightExternalKey = deriveRole(Roles.NightExternal);
  const nightInternalKey = deriveRole(Roles.NightInternal);

  if (!dustKey || !nightExternalKey || !nightInternalKey) {
    return {
      success: false,
      error: 'Failed to derive one or more keys',
    };
  }

  return {
    success: true,
    data: {
      seed,
      dustKey,
      nightExternalKey,
      nightInternalKey,
    },
  };
}

// ============================================
// Address Formatting
// ============================================

/**
 * Convert a derived key to a hex string.
 */
export function keyToHex(key: Uint8Array): string {
  return Array.from(key)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Format a Dust address.
 * Note: Using hex format until browser-compatible bech32m encoding is available.
 */
export function formatDustAddress(dustKey: Uint8Array, networkId: string): string {
  // Prefix with network for disambiguation
  const prefix = networkId === 'mainnet' ? 'mn1' : `mn_${networkId.slice(0, 3)}_`;
  return `${prefix}${keyToHex(dustKey).slice(0, 40)}`;
}

/**
 * Format an unshielded address.
 */
export function formatUnshieldedAddress(key: Uint8Array, networkId: string): string {
  const prefix = networkId === 'mainnet' ? 'mn1' : `mn_${networkId.slice(0, 3)}_`;
  return `${prefix}${keyToHex(key).slice(0, 40)}`;
}

// ============================================
// Wallet Creation
// ============================================

/**
 * Create a new wallet with a fresh mnemonic.
 */
export function createWallet(networkId: string): WalletResult<{
  mnemonic: string[];
  keys: WalletKeys;
  info: WalletInfo;
}> {
  // Generate mnemonic
  const mnemonic = generateMnemonic();

  // Derive seed from mnemonic
  const seed = mnemonicToSeed(mnemonic);

  // Derive keys
  const keysResult = deriveKeys(seed);
  if (!keysResult.success) {
    return keysResult;
  }

  // Format address
  const address = formatDustAddress(keysResult.data.dustKey, networkId);
  const publicKeyHex = keyToHex(keysResult.data.dustKey);

  return {
    success: true,
    data: {
      mnemonic,
      keys: keysResult.data,
      info: {
        address,
        publicKeyHex,
        networkId,
      },
    },
  };
}

/**
 * Import a wallet from a mnemonic phrase.
 */
export function importFromMnemonic(
  mnemonicInput: string | string[],
  networkId: string
): WalletResult<{
  keys: WalletKeys;
  info: WalletInfo;
}> {
  // Normalize input
  const words = Array.isArray(mnemonicInput)
    ? mnemonicInput
    : mnemonicToWords(mnemonicInput);

  // Validate
  if (!isValidMnemonic(words)) {
    return {
      success: false,
      error: 'Invalid mnemonic phrase',
    };
  }

  // Derive seed
  const seed = mnemonicToSeed(words);

  // Derive keys
  const keysResult = deriveKeys(seed);
  if (!keysResult.success) {
    return keysResult;
  }

  // Format address
  const address = formatDustAddress(keysResult.data.dustKey, networkId);
  const publicKeyHex = keyToHex(keysResult.data.dustKey);

  return {
    success: true,
    data: {
      keys: keysResult.data,
      info: {
        address,
        publicKeyHex,
        networkId,
      },
    },
  };
}

/**
 * Import a wallet from a raw private key (hex).
 */
export function importFromPrivateKey(
  privateKeyHex: string,
  networkId: string
): WalletResult<{
  keys: WalletKeys;
  info: WalletInfo;
}> {
  // Clean and validate hex
  const cleanHex = privateKeyHex.replace(/^0x/, '').toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(cleanHex)) {
    return {
      success: false,
      error: 'Invalid private key format. Expected 64 hex characters.',
    };
  }

  // Convert to bytes (use as seed directly for simplicity)
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    seed[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }

  // Pad to 64 bytes for HD wallet compatibility
  const paddedSeed = new Uint8Array(64);
  paddedSeed.set(seed, 0);

  // Derive keys
  const keysResult = deriveKeys(paddedSeed);
  if (!keysResult.success) {
    return keysResult;
  }

  // Format address
  const address = formatDustAddress(keysResult.data.dustKey, networkId);
  const publicKeyHex = keyToHex(keysResult.data.dustKey);

  return {
    success: true,
    data: {
      keys: keysResult.data,
      info: {
        address,
        publicKeyHex,
        networkId,
      },
    },
  };
}

// ============================================
// Signing Operations
// ============================================

/**
 * Sign a message with the wallet's private key.
 * Note: This is a placeholder - actual signing requires the full SDK.
 */
export function signMessage(
  message: string,
  privateKey: Uint8Array
): WalletResult<{ signature: string }> {
  // TODO: Implement actual message signing using SDK
  // For now, return a deterministic hash-based signature
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  // Simple XOR-based "signature" for demo (NOT cryptographically secure)
  const signatureBytes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    signatureBytes[i] =
      privateKey[i % privateKey.length] ^ messageBytes[i % messageBytes.length];
  }

  return {
    success: true,
    data: {
      signature: `0x${keyToHex(signatureBytes)}`,
    },
  };
}

/**
 * Sign a transaction.
 * Note: This is a placeholder - actual signing requires the full SDK.
 */
export function signTransaction(
  tx: unknown,
  privateKey: Uint8Array
): WalletResult<{ signedTx: string }> {
  // TODO: Implement actual transaction signing using SDK
  // For now, return a placeholder

  const txJson = JSON.stringify(tx);
  const encoder = new TextEncoder();
  const txBytes = encoder.encode(txJson);

  // Create a "signature" by hashing
  let hash = 0;
  for (const byte of txBytes) {
    hash = ((hash << 5) - hash + byte) | 0;
  }

  return {
    success: true,
    data: {
      signedTx: `SIGNED_TX_${Math.abs(hash).toString(16)}`,
    },
  };
}
