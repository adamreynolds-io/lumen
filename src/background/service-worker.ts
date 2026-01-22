/**
 * Phase 0: SDK Compatibility Spike
 *
 * This service worker tests whether @midnight-ntwrk/wallet-sdk-hd
 * works in a Chrome extension service worker context (no DOM).
 */

import {
  generateMnemonicWords,
  generateRandomSeed,
  validateMnemonic,
  joinMnemonicWords,
  HDWallet,
  Roles,
} from '@midnight-ntwrk/wallet-sdk-hd';

console.log('[Lumen] Service worker starting...');

interface SpikeResult {
  test: string;
  passed: boolean;
  details: string;
  error?: unknown;
}

const results: SpikeResult[] = [];

function logResult(result: SpikeResult): void {
  results.push(result);
  const status = result.passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[Lumen] ${status}: ${result.test}`);
  console.log(`[Lumen]   ${result.details}`);
  if (result.error) {
    console.error('[Lumen]   Error:', result.error);
  }
}

// Test 1: Can we generate mnemonic words?
function testMnemonicGeneration(): SpikeResult {
  console.log('[Lumen] Test 1: Generating mnemonic words...');
  try {
    const words = generateMnemonicWords();
    const wordCount = words.length;
    const isValid = validateMnemonic(joinMnemonicWords(words));

    return {
      test: 'Mnemonic Generation',
      passed: wordCount === 24 && isValid,
      details: `Generated ${wordCount} words, valid=${isValid}`,
    };
  } catch (error) {
    return {
      test: 'Mnemonic Generation',
      passed: false,
      details: 'Failed to generate mnemonic',
      error,
    };
  }
}

// Test 2: Can we generate a random seed?
function testSeedGeneration(): SpikeResult {
  console.log('[Lumen] Test 2: Generating random seed...');
  try {
    const seed = generateRandomSeed();
    const seedLength = seed.length;

    return {
      test: 'Seed Generation',
      passed: seedLength > 0,
      details: `Generated seed of ${seedLength} bytes`,
    };
  } catch (error) {
    return {
      test: 'Seed Generation',
      passed: false,
      details: 'Failed to generate seed',
      error,
    };
  }
}

// Test 3: Can we create HD wallet from seed?
function testHDWalletCreation(): SpikeResult {
  console.log('[Lumen] Test 3: Creating HD wallet from seed...');
  try {
    const seed = generateRandomSeed();
    const walletResult = HDWallet.fromSeed(seed);

    if (walletResult.type === 'seedOk') {
      return {
        test: 'HD Wallet Creation',
        passed: true,
        details: 'HDWallet created successfully from seed',
      };
    } else {
      return {
        test: 'HD Wallet Creation',
        passed: false,
        details: `HDWallet creation failed: ${walletResult.type}`,
        error: walletResult.error,
      };
    }
  } catch (error) {
    return {
      test: 'HD Wallet Creation',
      passed: false,
      details: 'Exception during HD wallet creation',
      error,
    };
  }
}

// Test 4: Can we derive keys for different roles?
function testKeyDerivation(): SpikeResult {
  console.log('[Lumen] Test 4: Deriving keys for all roles...');
  try {
    const seed = generateRandomSeed();
    const walletResult = HDWallet.fromSeed(seed);

    if (walletResult.type !== 'seedOk') {
      return {
        test: 'Key Derivation',
        passed: false,
        details: 'Could not create wallet for key derivation test',
      };
    }

    const wallet = walletResult.hdWallet;
    const account = wallet.selectAccount(0);
    const derivedKeys: string[] = [];

    // Test all roles
    const roleTests = [
      { name: 'Dust', role: Roles.Dust },
      { name: 'NightExternal', role: Roles.NightExternal },
      { name: 'NightInternal', role: Roles.NightInternal },
      { name: 'Zswap', role: Roles.Zswap },
      { name: 'Metadata', role: Roles.Metadata },
    ];

    for (const { name, role } of roleTests) {
      const roleKey = account.selectRole(role);
      const keyResult = roleKey.deriveKeyAt(0);

      if (keyResult.type === 'keyDerived') {
        derivedKeys.push(`${name}(${keyResult.key.length}b)`);
      } else {
        return {
          test: 'Key Derivation',
          passed: false,
          details: `Failed to derive ${name} key: ${keyResult.type}`,
        };
      }
    }

    return {
      test: 'Key Derivation',
      passed: derivedKeys.length === 5,
      details: `Derived keys: ${derivedKeys.join(', ')}`,
    };
  } catch (error) {
    return {
      test: 'Key Derivation',
      passed: false,
      details: 'Exception during key derivation',
      error,
    };
  }
}

// Test 5: Validate known mnemonic
function testMnemonicValidation(): SpikeResult {
  console.log('[Lumen] Test 5: Validating mnemonic...');
  try {
    // Generate and validate
    const words = generateMnemonicWords();
    const mnemonic = joinMnemonicWords(words);
    const isValid = validateMnemonic(mnemonic);

    // Test invalid mnemonic
    const invalidMnemonic = 'invalid words that are not a real mnemonic phrase';
    const isInvalid = !validateMnemonic(invalidMnemonic);

    return {
      test: 'Mnemonic Validation',
      passed: isValid && isInvalid,
      details: `Valid mnemonic accepted=${isValid}, invalid rejected=${isInvalid}`,
    };
  } catch (error) {
    return {
      test: 'Mnemonic Validation',
      passed: false,
      details: 'Exception during validation',
      error,
    };
  }
}

// Run all tests
function runSpike(): void {
  console.log('[Lumen] ========================================');
  console.log('[Lumen] Phase 0: SDK Compatibility Spike');
  console.log('[Lumen] Environment: Chrome Extension Service Worker');
  console.log('[Lumen] ========================================');

  logResult(testMnemonicGeneration());
  logResult(testSeedGeneration());
  logResult(testHDWalletCreation());
  logResult(testKeyDerivation());
  logResult(testMnemonicValidation());

  console.log('[Lumen] ========================================');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`[Lumen] Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('[Lumen] GO: SDK is compatible with service worker context');
  } else {
    console.log('[Lumen] NO-GO: SDK has compatibility issues');
  }
  console.log('[Lumen] ========================================');
}

// Run on service worker activation
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Lumen] Extension installed');
  runSpike();
});

// Also run immediately for reloads
runSpike();
