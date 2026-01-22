/**
 * Network Layer Unit Tests
 *
 * Run with: npx tsx test/network.test.ts
 *
 * Note: These tests focus on sync operations that don't require network.
 * Actual RPC tests require a running Midnight node.
 */

import {
  getRpcUrl,
  getNetworkPresets,
  getNetworkPreset,
  isValidRpcUrl,
} from '../src/core/network.js';

import { NETWORKS } from '../src/core/types.js';

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

console.log('\n=== Network Layer Unit Tests ===\n');

// getRpcUrl Tests
test('getRpcUrl returns correct URL for devnet', () => {
  const url = getRpcUrl('devnet');
  assertEqual(url, NETWORKS.devnet.rpcUrl, 'DevNet RPC URL');
});

test('getRpcUrl returns correct URL for localnet', () => {
  const url = getRpcUrl('localnet');
  assertEqual(url, 'http://localhost:9944', 'Localnet RPC URL');
});

test('getRpcUrl returns correct URL for qanet', () => {
  const url = getRpcUrl('qanet');
  assertEqual(url, NETWORKS.qanet.rpcUrl, 'QANET RPC URL');
});

test('getRpcUrl returns correct URL for preview', () => {
  const url = getRpcUrl('preview');
  assertEqual(url, NETWORKS.preview.rpcUrl, 'Preview RPC URL');
});

test('getRpcUrl returns correct URL for preprod', () => {
  const url = getRpcUrl('preprod');
  assertEqual(url, NETWORKS.preprod.rpcUrl, 'PreProd RPC URL');
});

test('getRpcUrl returns custom URL when provided', () => {
  const customUrl = 'https://my-custom-node.example.com';
  const url = getRpcUrl('custom', customUrl);
  assertEqual(url, customUrl, 'Custom RPC URL');
});

test('getRpcUrl throws for custom without URL', () => {
  let threw = false;
  try {
    getRpcUrl('custom');
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Should throw for custom without URL');
});

// getNetworkPresets Tests
test('getNetworkPresets returns all 5 networks', () => {
  const presets = getNetworkPresets();
  assertEqual(presets.length, 5, 'Preset count');
});

test('getNetworkPresets includes all expected networks', () => {
  const presets = getNetworkPresets();
  const ids = presets.map((p) => p.id);
  assert(ids.includes('localnet'), 'Should include localnet');
  assert(ids.includes('devnet'), 'Should include devnet');
  assert(ids.includes('qanet'), 'Should include qanet');
  assert(ids.includes('preview'), 'Should include preview');
  assert(ids.includes('preprod'), 'Should include preprod');
});

// getNetworkPreset Tests
test('getNetworkPreset returns correct config for devnet', () => {
  const preset = getNetworkPreset('devnet');
  assertEqual(preset.id, 'devnet', 'ID');
  assertEqual(preset.name, 'DevNet', 'Name');
  assert(preset.rpcUrl.includes('devnet'), 'RPC URL should contain devnet');
});

// isValidRpcUrl Tests
test('isValidRpcUrl accepts http URL', () => {
  assert(isValidRpcUrl('http://localhost:9944'), 'Should accept http');
});

test('isValidRpcUrl accepts https URL', () => {
  assert(isValidRpcUrl('https://rpc.devnet.midnight.network'), 'Should accept https');
});

test('isValidRpcUrl accepts ws URL', () => {
  assert(isValidRpcUrl('ws://localhost:9944'), 'Should accept ws');
});

test('isValidRpcUrl accepts wss URL', () => {
  assert(isValidRpcUrl('wss://rpc.devnet.midnight.network'), 'Should accept wss');
});

test('isValidRpcUrl rejects ftp URL', () => {
  assert(!isValidRpcUrl('ftp://example.com'), 'Should reject ftp');
});

test('isValidRpcUrl rejects invalid URL', () => {
  assert(!isValidRpcUrl('not-a-url'), 'Should reject invalid URL');
});

test('isValidRpcUrl rejects empty string', () => {
  assert(!isValidRpcUrl(''), 'Should reject empty string');
});

// ============================================
// Summary
// ============================================

console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log();

process.exit(failed > 0 ? 1 : 0);
