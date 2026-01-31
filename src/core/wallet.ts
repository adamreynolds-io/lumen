/**
 * Wallet Core
 *
 * Handles wallet generation, import, key derivation, and signing.
 * Uses @midnight-ntwrk/wallet-sdk-hd for HD wallet operations.
 * Uses @midnight-ntwrk/wallet-sdk-address-format for Bech32m address encoding.
 */

import {
  generateMnemonicWords,
  validateMnemonic,
  joinMnemonicWords,
  mnemonicToWords,
  HDWallet,
  Roles,
} from '@midnight-ntwrk/wallet-sdk-hd';

import { DustAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { DustSecretKey, ZswapSecretKeys } from '@midnight-ntwrk/ledger-v7';

import { mnemonicToSeedSync } from '@scure/bip39';

// ============================================
// Types
// ============================================

export interface WalletKeys {
  /** 64-byte seed derived from mnemonic */
  seed: Uint8Array;
  /** Derived Zswap key for shielded wallet (raw bytes) */
  zswapKey: Uint8Array;
  /** Derived Dust key for gas payments (raw bytes) */
  dustKey: Uint8Array;
  /** Derived Night External key for unshielded wallet */
  nightExternalKey: Uint8Array;
  /** Dust secret key from ledger (for SDK operations) */
  dustSecretKey: DustSecretKey;
  /** Zswap secret keys for shielded wallet (pre-computed) */
  zswapSecretKeys: ZswapSecretKeys;
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
 * Uses the correct derivation path matching the reference implementation:
 * - Roles.Zswap for shielded wallet
 * - Roles.NightExternal for unshielded wallet
 * - Roles.Dust for dust/gas payments
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

  // Derive all three keys using selectRoles for efficiency
  const derivationResult = walletResult.hdWallet
    .selectAccount(account)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(index);

  // Clear HD wallet after derivation for security
  walletResult.hdWallet.clear();

  if (derivationResult.type !== 'keysDerived') {
    return {
      success: false,
      error: `Failed to derive keys: ${derivationResult.type}`,
    };
  }

  const zswapKey = derivationResult.keys[Roles.Zswap];
  const nightExternalKey = derivationResult.keys[Roles.NightExternal];
  const dustKey = derivationResult.keys[Roles.Dust];

  if (!zswapKey || !nightExternalKey || !dustKey) {
    return {
      success: false,
      error: 'Failed to derive one or more keys',
    };
  }

  // Create secret keys from derived keys
  const zswapSecretKeys = ZswapSecretKeys.fromSeed(zswapKey);
  const dustSecretKey = DustSecretKey.fromSeed(dustKey);

  return {
    success: true,
    data: {
      seed,
      zswapKey,
      dustKey,
      nightExternalKey,
      dustSecretKey,
      zswapSecretKeys,
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
 * Format a Dust address using the SDK's Bech32m encoding.
 * Uses wallet-sdk-address-format for proper Midnight address encoding.
 *
 * @param dustSecretKey - The DustSecretKey from ledger
 * @param networkId - Network identifier (localnet, devnet, etc)
 */
export function formatDustAddress(dustSecretKey: DustSecretKey, networkId: string): string {
  const publicKey = dustSecretKey.publicKey;
  return DustAddress.encodePublicKey(networkId, publicKey);
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

  // Format address using proper Bech32m encoding
  const address = formatDustAddress(keysResult.data.dustSecretKey, networkId);
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

  // Format address using proper Bech32m encoding
  const address = formatDustAddress(keysResult.data.dustSecretKey, networkId);
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
 * Accepts 64 hex chars (32 bytes) which will be padded to 64 bytes.
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
      error: 'Invalid private key format',
    };
  }

  // Convert to bytes (DO NOT pad - use 32 bytes directly like testkit)
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    seed[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }

  // Derive keys
  const keysResult = deriveKeys(seed);
  if (!keysResult.success) {
    return keysResult;
  }

  // Format address using proper Bech32m encoding
  const address = formatDustAddress(keysResult.data.dustSecretKey, networkId);
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
 * Import a wallet from a hex seed.
 * Accepts either 64 hex chars (32 bytes) or 128 hex chars (64 bytes).
 * Used for prefunded localnet wallets.
 */
export function importFromHexSeed(
  hexSeed: string,
  networkId: string
): WalletResult<{
  keys: WalletKeys;
  info: WalletInfo;
}> {
  // Clean and validate hex
  const cleanHex = hexSeed.replace(/^0x/, '').toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(cleanHex) && !/^[0-9a-f]{128}$/.test(cleanHex)) {
    return {
      success: false,
      error: 'Invalid seed format',
    };
  }

  // Convert to bytes (DO NOT pad - testkit uses 32 bytes directly)
  const byteLength = cleanHex.length / 2;
  const seed = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    seed[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }

  // Derive keys
  const keysResult = deriveKeys(seed);
  if (!keysResult.success) {
    return keysResult;
  }

  // Format address using proper Bech32m encoding
  const address = formatDustAddress(keysResult.data.dustSecretKey, networkId);
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
 * @deprecated Use LumenFacade.signRecipe() for actual signing operations.
 * This placeholder is kept for backward compatibility with dApp connector.
 */
export function signMessage(
  message: string,
  privateKey: Uint8Array
): WalletResult<{ signature: string }> {
  // Placeholder - actual signing should use facade.signRecipe()
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
 * @deprecated Use LumenFacade.transfer() for actual transaction signing.
 * This placeholder is kept for backward compatibility with dApp connector.
 */
export function signTransaction(
  tx: unknown,
  privateKey: Uint8Array
): WalletResult<{ signedTx: string }> {
  // Placeholder - actual signing should use facade.transfer()
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
