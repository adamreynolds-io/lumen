/**
 * Wallet Facade
 *
 * Provides a simplified interface to the wallet-sdk for DUST operations.
 * Uses DustWallet for balance queries and basic operations.
 */

import { DustWallet, DustWalletState } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { DustSecretKey, LedgerParameters } from '@midnight-ntwrk/ledger-v7';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

// ============================================
// Types
// ============================================

export interface FacadeConfig {
  /** Network identifier (localnet, devnet, etc.) */
  networkId: string;
  /** Indexer HTTP URL for GraphQL queries */
  indexerHttpUrl: string;
  /** Indexer WebSocket URL for subscriptions */
  indexerWsUrl: string;
  /** Node RPC URL for transaction submission */
  nodeUrl: string;
  /** Prover URL for ZK proof generation */
  proverUrl: string;
}

export interface DustBalance {
  /** Total balance including pending */
  total: bigint;
  /** Available balance (confirmed) */
  available: bigint;
  /** Pending balance (unconfirmed) */
  pending: bigint;
}

// ============================================
// Wallet Facade
// ============================================

/**
 * Simplified wallet facade for DUST operations.
 * Wraps the wallet-sdk's DustWallet for easier use in the extension.
 */
export class LumenFacade {
  private dustWallet: ReturnType<ReturnType<typeof DustWallet>['startWithSeed']> | null = null;
  private config: FacadeConfig;
  /** HD-derived dust key (32 bytes) from HDWallet.selectRole(Dust).deriveKeyAt(0) */
  private dustKey: Uint8Array;

  constructor(config: FacadeConfig, dustKey: Uint8Array) {
    this.config = config;
    this.dustKey = dustKey;
  }

  /**
   * Initialize the wallet and start syncing with the network.
   */
  async start(): Promise<void> {
    if (this.dustWallet) {
      return; // Already started
    }

    // Configuration for DustWallet
    const config = {
      networkId: this.config.networkId,
      costParameters: {
        feePerByte: 1n,
        feeBase: 1000n,
      },
      indexerClientConnection: {
        indexerHttpUrl: this.config.indexerHttpUrl,
        indexerWsUrl: this.config.indexerWsUrl,
      },
      relayURL: new URL(this.config.nodeUrl),
      provingServerUrl: new URL(this.config.proverUrl),
    };

    // Create DustWallet class with configuration
    const DustWalletClass = DustWallet(config);

    // Get DustParameters from ledger initial parameters (same as testkit-js)
    const dustParameters = LedgerParameters.initialParameters().dust;

    // Start wallet from HD-derived dust key (32 bytes)
    this.dustWallet = DustWalletClass.startWithSeed(this.dustKey, dustParameters);

    // Create secret key for syncing
    const dustSecretKey = DustSecretKey.fromSeed(this.dustKey);

    // Start syncing
    await this.dustWallet.start(dustSecretKey);

    console.log('[Facade] DustWallet started and syncing');
  }

  /**
   * Stop the wallet and disconnect from the network.
   */
  async stop(): Promise<void> {
    if (this.dustWallet) {
      await this.dustWallet.stop();
      this.dustWallet = null;
      console.log('[Facade] DustWallet stopped');
    }
  }

  /**
   * Get the current DUST balance.
   * Waits for the wallet to sync before returning.
   */
  async getBalance(): Promise<DustBalance> {
    if (!this.dustWallet) {
      throw new Error('Wallet not started. Call start() first.');
    }

    // Wait for synced state
    const state = await this.dustWallet.waitForSyncedState();

    // walletBalance returns total balance as bigint (includes generated dust)
    const total = state.walletBalance(new Date());

    // Calculate pending from pending coins
    const pendingCoins = state.pendingCoins;
    const pending = pendingCoins.reduce((sum, coin) => sum + coin.initialValue, 0n);

    // Available = total - pending
    const available = total - pending;

    return {
      total,
      available,
      pending,
    };
  }

  /**
   * Get the current wallet state without waiting for full sync.
   * Returns null if wallet is not initialized.
   */
  async getCurrentState(): Promise<DustWalletState | null> {
    if (!this.dustWallet) {
      return null;
    }

    try {
      // Get the latest state from the observable
      const state = await firstValueFrom(
        this.dustWallet.state.pipe(take(1))
      );
      return state;
    } catch {
      return null;
    }
  }

  /**
   * Get balance from current state without waiting for sync.
   * Returns null if wallet is not ready or no state available.
   */
  async getBalanceNonBlocking(): Promise<DustBalance | null> {
    const state = await this.getCurrentState();
    if (!state) {
      return null;
    }

    try {
      const total = state.walletBalance(new Date());
      const pendingCoins = state.pendingCoins;
      const pending = pendingCoins.reduce((sum, coin) => sum + coin.initialValue, 0n);
      const available = total - pending;

      return { total, available, pending };
    } catch {
      return null;
    }
  }

  /**
   * Get the DUST address for this wallet.
   */
  getDustAddress(): string {
    // Derive from the HD-derived dust key
    const dustSecretKey = DustSecretKey.fromSeed(this.dustKey);
    // The public key is a bigint, convert to hex for display
    return `dust_${dustSecretKey.publicKey.toString(16).padStart(64, '0')}`;
  }

  /**
   * Check if the wallet is currently syncing.
   */
  async isSyncing(): Promise<boolean> {
    const state = await this.getCurrentState();
    if (!state) {
      return false;
    }
    return !state.progress.isStrictlyComplete();
  }

  /**
   * Check if the facade is started.
   */
  isStarted(): boolean {
    return this.dustWallet !== null;
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new LumenFacade instance.
 * @param config Network configuration
 * @param dustKey HD-derived dust key (32 bytes) from HDWallet.selectRole(Dust).deriveKeyAt(0)
 */
export function createFacade(config: FacadeConfig, dustKey: Uint8Array): LumenFacade {
  return new LumenFacade(config, dustKey);
}

/**
 * Create facade configuration from network URLs.
 */
export function createFacadeConfig(
  networkId: string,
  nodeUrl: string,
  indexerUrl: string,
  indexerWsUrl: string,
  proverUrl: string
): FacadeConfig {
  return {
    networkId,
    nodeUrl,
    indexerHttpUrl: indexerUrl,
    indexerWsUrl,
    proverUrl,
  };
}
