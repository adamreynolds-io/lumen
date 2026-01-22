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

export interface SyncProgress {
  /** Percentage complete (0-100) */
  percentage: number;
  /** Applied index (blocks processed by wallet) */
  appliedIndex: number;
  /** Highest index (latest block on chain) */
  highestIndex: number;
  /** Highest relevant index (latest block with wallet activity) */
  highestRelevantIndex: number;
  /** Whether sync is complete */
  isComplete: boolean;
}

/** Dust generation details for a coin */
export interface DustGenerationInfo {
  /** When dust generation started */
  generationTime: string | null;
  /** Maximum dust capacity */
  maxCapacity: string;
  /** When max capacity will be reached */
  maxCapReachedAt: string;
  /** Currently generated dust amount */
  currentlyGenerated: string;
  /** Generation rate */
  rate: string;
}

export interface CoinInfo {
  /** Coin value in smallest unit */
  value: string;
  /** Coin status */
  status: 'spendable' | 'pending' | 'spent';
  /** Creation time (ISO timestamp) */
  createdAt: string | null;
  /** Sequence number */
  sequenceNumber: number | null;
  /** Merkle tree index */
  merkleTreeIndex: string | null;
  /** Backing NIGHT nonce (hex) */
  backingNightNonce: string | null;
  /** Dust generation details (if available) */
  generation: DustGenerationInfo | null;
}

/** Serializable balance for debug panel (uses strings instead of bigints) */
export interface SerializableBalance {
  total: string;
  available: string;
  pending: string;
}

export interface DebugState {
  /** Whether facade is started */
  facadeStarted: boolean;
  /** Sync progress details */
  syncProgress: SyncProgress | null;
  /** Balance breakdown (serializable strings) */
  balance: SerializableBalance | null;
  /** Number of coins */
  coinCount: number;
  /** Facade start timestamp */
  facadeStartTime: string | null;
}

export interface ConnectionStatus {
  /** Indexer WebSocket status */
  indexerWs: 'connected' | 'connecting' | 'disconnected' | 'unknown';
  /** Node RPC status */
  nodeRpc: 'unknown';
  /** Last error message if any */
  lastError: string | null;
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
  /** Timestamp when facade was started */
  private startTime: Date | null = null;

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

    // Record start time
    this.startTime = new Date();

    console.log('[Facade] DustWallet started and syncing');
  }

  /**
   * Stop the wallet and disconnect from the network.
   */
  async stop(): Promise<void> {
    if (this.dustWallet) {
      await this.dustWallet.stop();
      this.dustWallet = null;
      this.startTime = null;
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
    const progress = state.progress;
    if (typeof progress.isStrictlyComplete === 'function') {
      return !progress.isStrictlyComplete();
    }
    // Fall back: consider syncing if appliedIndex < highestIndex
    const appliedIndex = Number(progress.appliedIndex ?? 0);
    const highestIndex = Number(progress.highestIndex ?? 0);
    return highestIndex > 0 && appliedIndex < highestIndex;
  }

  /**
   * Check if the facade is started.
   */
  isStarted(): boolean {
    return this.dustWallet !== null;
  }

  /**
   * Get debug state for the debug panel.
   */
  async getDebugState(): Promise<DebugState> {
    const facadeStarted = this.dustWallet !== null;

    if (!facadeStarted) {
      return {
        facadeStarted: false,
        syncProgress: null,
        balance: null,
        coinCount: 0,
        facadeStartTime: null,
      };
    }

    const state = await this.getCurrentState();

    // Get sync progress using SDK's ProgressUpdate fields
    let syncProgress: SyncProgress | null = null;
    if (state) {
      const progress = state.progress;

      // SDK ProgressUpdate has: appliedIndex, highestIndex, highestRelevantIndex
      const appliedIndex = Number(progress.appliedIndex ?? 0);
      const highestIndex = Number(progress.highestIndex ?? 0);
      const highestRelevantIndex = Number(progress.highestRelevantIndex ?? 0);

      // Check if sync is complete - try method first, fall back to property check
      let isComplete = false;
      if (typeof progress.isStrictlyComplete === 'function') {
        isComplete = progress.isStrictlyComplete();
      } else {
        // Fall back: consider complete if appliedIndex >= highestIndex
        // If highestIndex is 0 but we have appliedIndex, consider synced (localnet edge case)
        isComplete = (highestIndex > 0 && appliedIndex >= highestIndex) || (highestIndex === 0 && appliedIndex > 0);
      }

      // Calculate percentage, handling edge case where highestIndex is 0
      const percentage = isComplete
        ? 100
        : highestIndex > 0
          ? Math.round((appliedIndex / highestIndex) * 100)
          : 0;

      syncProgress = {
        percentage: isComplete ? 100 : percentage,
        appliedIndex,
        highestIndex,
        highestRelevantIndex,
        isComplete,
      };
    }

    // Get balance (convert bigints to strings for serialization)
    const rawBalance = await this.getBalanceNonBlocking();
    const balance: SerializableBalance | null = rawBalance
      ? {
          total: rawBalance.total.toString(),
          available: rawBalance.available.toString(),
          pending: rawBalance.pending.toString(),
        }
      : null;

    // Get coin count
    const coinCount = state?.availableCoins?.length ?? 0;

    return {
      facadeStarted,
      syncProgress,
      balance,
      coinCount,
      facadeStartTime: this.startTime?.toISOString() ?? null,
    };
  }

  /**
   * Get list of coins for debug display with full details.
   */
  async getCoins(): Promise<CoinInfo[]> {
    const state = await this.getCurrentState();
    if (!state) {
      return [];
    }

    const coins: CoinInfo[] = [];
    const now = new Date();

    // Get available coins with full generation info
    try {
      const fullInfoCoins = state.availableCoinsWithFullInfo(now);
      for (const fullInfo of fullInfoCoins) {
        const token = fullInfo.token;
        coins.push({
          value: token.initialValue.toString(),
          status: 'spendable',
          createdAt: token.ctime?.toISOString() ?? null,
          sequenceNumber: token.seq ?? null,
          merkleTreeIndex: token.mtIndex?.toString() ?? null,
          backingNightNonce: token.backingNight?.toString() ?? null,
          generation: {
            generationTime: fullInfo.dtime?.toISOString() ?? null,
            maxCapacity: fullInfo.maxCap?.toString() ?? '0',
            maxCapReachedAt: fullInfo.maxCapReachedAt?.toISOString() ?? '',
            currentlyGenerated: fullInfo.generatedNow?.toString() ?? '0',
            rate: fullInfo.rate?.toString() ?? '0',
          },
        });
      }
    } catch {
      // Fallback to basic coin info if availableCoinsWithFullInfo fails
      for (const coin of state.availableCoins ?? []) {
        coins.push({
          value: coin.initialValue.toString(),
          status: 'spendable',
          createdAt: coin.ctime?.toISOString() ?? null,
          sequenceNumber: coin.seq ?? null,
          merkleTreeIndex: coin.mtIndex?.toString() ?? null,
          backingNightNonce: coin.backingNight?.toString() ?? null,
          generation: null,
        });
      }
    }

    // Add pending coins (don't have generation info yet)
    for (const coin of state.pendingCoins ?? []) {
      coins.push({
        value: coin.initialValue.toString(),
        status: 'pending',
        createdAt: coin.ctime?.toISOString() ?? null,
        sequenceNumber: coin.seq ?? null,
        merkleTreeIndex: coin.mtIndex?.toString() ?? null,
        backingNightNonce: coin.backingNight?.toString() ?? null,
        generation: null,
      });
    }

    return coins;
  }

  /**
   * Get connection status for debug display.
   * Note: Limited info available from DustWallet - mainly inferring from state availability.
   */
  async getConnectionStatus(): Promise<ConnectionStatus> {
    if (!this.dustWallet) {
      return {
        indexerWs: 'disconnected',
        nodeRpc: 'unknown',
        lastError: null,
      };
    }

    // Try to get state - if we can, we're connected
    const state = await this.getCurrentState();

    return {
      indexerWs: state ? 'connected' : 'connecting',
      nodeRpc: 'unknown', // DustWallet doesn't expose node connection status directly
      lastError: null,
    };
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
