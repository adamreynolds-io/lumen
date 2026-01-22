/**
 * Wallet Core Unit Tests
 *
 * Run with: npx tsx test/wallet.test.ts
 */

import {
  generateMnemonic,
  isValidMnemonic,
  mnemonicToSeed,
  deriveKeys,
  createWallet,
  importFromMnemonic,
  importFromPrivateKey,
  importFromHexSeed,
  signMessage,
  signTransaction,
  keyToHex,
} from '../src/core/wallet.js';

import { LOCALNET_SEEDS } from '../src/core/types.js';

// Simple test framework
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  ${(e as Error).message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// ============================================
// Tests
// ============================================

console.log('\n=== Wallet Core Unit Tests ===\n');

// Mnemonic Tests
test('generateMnemonic returns 24 words', () => {
  const words = generateMnemonic();
  assertEqual(words.length, 24, 'Word count');
});

test('generateMnemonic returns valid mnemonic', () => {
  const words = generateMnemonic();
  assert(isValidMnemonic(words), 'Mnemonic should be valid');
});

test('isValidMnemonic accepts valid 24-word phrase', () => {
  const validMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
  assert(isValidMnemonic(validMnemonic), 'Should accept valid mnemonic');
});

test('isValidMnemonic rejects invalid phrase', () => {
  const invalidMnemonic = 'invalid words that are not a real mnemonic';
  assert(!isValidMnemonic(invalidMnemonic), 'Should reject invalid mnemonic');
});

test('isValidMnemonic accepts array format', () => {
  const words = generateMnemonic();
  assert(isValidMnemonic(words), 'Should accept array format');
});

// Seed Derivation Tests
test('mnemonicToSeed returns 64-byte seed', () => {
  const words = generateMnemonic();
  const seed = mnemonicToSeed(words);
  assertEqual(seed.length, 64, 'Seed length');
});

test('mnemonicToSeed is deterministic', () => {
  const words = generateMnemonic();
  const seed1 = mnemonicToSeed(words);
  const seed2 = mnemonicToSeed(words);
  assertEqual(keyToHex(seed1), keyToHex(seed2), 'Seeds should match');
});

test('mnemonicToSeed with passphrase differs', () => {
  const words = generateMnemonic();
  const seed1 = mnemonicToSeed(words, '');
  const seed2 = mnemonicToSeed(words, 'password');
  assert(keyToHex(seed1) !== keyToHex(seed2), 'Seeds should differ with passphrase');
});

// Key Derivation Tests
test('deriveKeys succeeds with valid seed', () => {
  const words = generateMnemonic();
  const seed = mnemonicToSeed(words);
  const result = deriveKeys(seed);
  assert(result.success, 'Should succeed');
});

test('deriveKeys returns all required keys', () => {
  const words = generateMnemonic();
  const seed = mnemonicToSeed(words);
  const result = deriveKeys(seed);

  assert(result.success, 'Should succeed');
  if (result.success) {
    assert(result.data.dustKey.length > 0, 'Should have dustKey');
    assert(result.data.nightExternalKey.length > 0, 'Should have nightExternalKey');
    assert(result.data.nightInternalKey.length > 0, 'Should have nightInternalKey');
  }
});

test('deriveKeys is deterministic', () => {
  const words = generateMnemonic();
  const seed = mnemonicToSeed(words);
  const result1 = deriveKeys(seed);
  const result2 = deriveKeys(seed);

  assert(result1.success && result2.success, 'Both should succeed');
  if (result1.success && result2.success) {
    assertEqual(
      keyToHex(result1.data.dustKey),
      keyToHex(result2.data.dustKey),
      'Dust keys should match'
    );
  }
});

// Wallet Creation Tests
test('createWallet succeeds', () => {
  const result = createWallet('devnet');
  assert(result.success, 'Should succeed');
});

test('createWallet returns mnemonic and address', () => {
  const result = createWallet('devnet');
  assert(result.success, 'Should succeed');
  if (result.success) {
    assertEqual(result.data.mnemonic.length, 24, 'Should have 24-word mnemonic');
    assert(result.data.info.address.length > 0, 'Should have address');
  }
});

// Import Tests
test('importFromMnemonic succeeds with valid mnemonic', () => {
  // First create a wallet to get a valid mnemonic
  const created = createWallet('devnet');
  assert(created.success, 'Create should succeed');

  if (created.success) {
    const imported = importFromMnemonic(created.data.mnemonic, 'devnet');
    assert(imported.success, 'Import should succeed');
  }
});

test('importFromMnemonic reproduces same address', () => {
  const created = createWallet('devnet');
  assert(created.success, 'Create should succeed');

  if (created.success) {
    const imported = importFromMnemonic(created.data.mnemonic, 'devnet');
    assert(imported.success, 'Import should succeed');

    if (imported.success) {
      assertEqual(
        imported.data.info.address,
        created.data.info.address,
        'Addresses should match'
      );
    }
  }
});

test('importFromMnemonic rejects invalid mnemonic', () => {
  const result = importFromMnemonic('invalid mnemonic words', 'devnet');
  assert(!result.success, 'Should fail');
});

test('importFromPrivateKey succeeds with valid hex', () => {
  const validKey = '0x' + '1234567890abcdef'.repeat(4);
  const result = importFromPrivateKey(validKey, 'devnet');
  assert(result.success, 'Should succeed');
});

test('importFromPrivateKey rejects invalid hex', () => {
  const result = importFromPrivateKey('invalid', 'devnet');
  assert(!result.success, 'Should fail');
});

test('importFromPrivateKey rejects wrong length', () => {
  const result = importFromPrivateKey('0x1234', 'devnet');
  assert(!result.success, 'Should fail');
});

// Hex Seed Import Tests
test('importFromHexSeed succeeds with 64-char hex (32 bytes)', () => {
  const seed32 = LOCALNET_SEEDS['wallet-0']; // 64 hex chars
  const result = importFromHexSeed(seed32, 'localnet');
  assert(result.success, 'Should succeed with 32-byte seed');
  if (result.success) {
    assert(result.data.info.address.length > 0, 'Should have address');
  }
});

test('importFromHexSeed succeeds with 128-char hex (64 bytes)', () => {
  const seed64 = LOCALNET_SEEDS['wallet-3']; // 128 hex chars
  const result = importFromHexSeed(seed64, 'localnet');
  assert(result.success, 'Should succeed with 64-byte seed');
  if (result.success) {
    assert(result.data.info.address.length > 0, 'Should have address');
  }
});

test('importFromHexSeed is deterministic', () => {
  const seed = LOCALNET_SEEDS['wallet-0'];
  const result1 = importFromHexSeed(seed, 'localnet');
  const result2 = importFromHexSeed(seed, 'localnet');

  assert(result1.success && result2.success, 'Both should succeed');
  if (result1.success && result2.success) {
    assertEqual(
      result1.data.info.address,
      result2.data.info.address,
      'Addresses should match'
    );
  }
});

test('importFromHexSeed rejects invalid hex', () => {
  const result = importFromHexSeed('not-valid-hex', 'localnet');
  assert(!result.success, 'Should fail with invalid hex');
});

test('importFromHexSeed rejects wrong length', () => {
  const result = importFromHexSeed('1234abcd', 'localnet');
  assert(!result.success, 'Should fail with wrong length');
});

test('importFromHexSeed accepts 0x prefix', () => {
  const seed = '0x' + LOCALNET_SEEDS['wallet-0'];
  const result = importFromHexSeed(seed, 'localnet');
  assert(result.success, 'Should accept 0x prefix');
});

// Signing Tests
test('signMessage returns signature', () => {
  const created = createWallet('devnet');
  assert(created.success, 'Create should succeed');

  if (created.success) {
    const result = signMessage('Hello, Midnight!', created.data.keys.dustKey);
    assert(result.success, 'Should succeed');
    if (result.success) {
      assert(result.data.signature.startsWith('0x'), 'Signature should be hex');
    }
  }
});

test('signTransaction returns signed tx', () => {
  const created = createWallet('devnet');
  assert(created.success, 'Create should succeed');

  if (created.success) {
    const result = signTransaction({ test: true }, created.data.keys.dustKey);
    assert(result.success, 'Should succeed');
    if (result.success) {
      assert(result.data.signedTx.length > 0, 'Should have signed tx');
    }
  }
});

// ============================================
// Summary
// ============================================

console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log();

process.exit(failed > 0 ? 1 : 0);
