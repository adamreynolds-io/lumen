/**
 * Wallet initialization - follows midnight-wallet-cli pattern
 *
 * Provides wallet initialization from seed, creating all three wallet types
 * and the WalletFacade instance.
 */

import * as ledger from '@midnight-ntwrk/ledger-v7';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type KeyStore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';

// ============================================
// Types
// ============================================

export interface EnvironmentConfig {
  networkId: NetworkId.NetworkId;
  indexerHttpUrl: string;
  indexerWsUrl: string;
  nodeWsUrl: string;
  provingServerUrl: string;
}

export interface WalletSecretKeys {
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
}

export interface WalletInitResult {
  facade: WalletFacade;
  networkId: NetworkId.NetworkId;
  secretKeys: WalletSecretKeys;
  unshieldedKeystore: KeyStore;
}

// ============================================
// Wallet Initialization
// ============================================

/**
 * Initialize and start the wallet facade with all three wallets.
 *
 * Follows the midnight-wallet-cli reference implementation exactly.
 *
 * @param seed - The wallet seed as a Uint8Array (64 bytes)
 * @param envConfig - The environment configuration
 * @returns The initialized and started WalletFacade with secret keys for transfers
 */
export async function initializeWallet(
  seed: Uint8Array,
  envConfig: EnvironmentConfig
): Promise<WalletInitResult> {
  // Step 1: Initialize HD wallet from seed
  const hdWallet = HDWallet.fromSeed(seed);

  if (hdWallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HDWallet from seed');
  }

  // Step 2: Derive keys for all three wallet types
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') {
    throw new Error('Failed to derive keys from HD wallet');
  }

  // Clear sensitive data from HD wallet
  hdWallet.hdWallet.clear();

  // Step 3: Create secret keys for each wallet type
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(derivationResult.keys[Roles.NightExternal], envConfig.networkId);

  // Step 4: Create wallet configuration
  const config = {
    networkId: envConfig.networkId,
    indexerClientConnection: {
      indexerHttpUrl: envConfig.indexerHttpUrl,
      indexerWsUrl: envConfig.indexerWsUrl,
    },
    provingServerUrl: new URL(envConfig.provingServerUrl),
    relayURL: new URL(envConfig.nodeWsUrl),
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000_000n,
      feeBlocksMargin: 5,
    },
  };

  // Step 5: Initialize each wallet
  const shieldedWallet = ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys);
  const dustWallet = DustWallet(config).startWithSecretKey(
    dustSecretKey,
    ledger.LedgerParameters.initialParameters().dust
  );
  const unshieldedWallet = UnshieldedWallet({
    ...config,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));

  // Step 6: Create and start the wallet facade
  const facade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  await facade.start(shieldedSecretKeys, dustSecretKey);

  return {
    facade,
    networkId: config.networkId,
    secretKeys: { shieldedSecretKeys, dustSecretKey },
    unshieldedKeystore,
  };
}
