/**
 * Wallet Facade
 *
 * Provides a simplified interface to the wallet-sdk for wallet operations.
 * Integrates DustWallet, ShieldedWallet, and UnshieldedWallet via WalletFacade.
 */

import { DustWallet, DustWalletState } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { ShieldedWallet, ShieldedWalletState } from '@midnight-ntwrk/wallet-sdk-shielded';
import { UnshieldedWallet, UnshieldedWalletState } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { WalletFacade, FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustSecretKey, ZswapSecretKeys, LedgerParameters } from '@midnight-ntwrk/ledger-v7';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  type ServiceHealth,
  checkNodeHealth,
  checkIndexerHealth,
  checkProverHealth,
} from './network.js';

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

/** Keys required for full wallet functionality */
export interface WalletKeys {
  /** HD-derived dust key (32 bytes) */
  dustKey: Uint8Array;
  /** HD-derived shielded key (32 bytes) for ZswapSecretKeys */
  shieldedKey: Uint8Array;
  /** Public key for unshielded wallet */
  unshieldedPublicKey: Uint8Array;
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

/** Shielded wallet debug state */
export interface ShieldedDebugState {
  /** Balances by token type */
  balances: Record<string, string>;
  /** Total coin count */
  coinCount: number;
  /** Shielded address */
  address: string | null;
  /** Sync progress */
  syncProgress: SyncProgress | null;
}

/** Unshielded wallet debug state */
export interface UnshieldedDebugState {
  /** Balance */
  balance: string;
  /** UTXO count */
  utxoCount: number;
  /** Registration status */
  isRegistered: boolean;
  /** Sync progress */
  syncProgress: SyncProgress | null;
}

/** Transaction info for history display */
export interface TransactionInfo {
  /** Transaction ID (hex) */
  id: string;
  /** Transaction type */
  type: 'transfer' | 'swap' | 'registration' | 'unknown';
  /** Timestamp (ISO) */
  timestamp: string | null;
  /** Status */
  status: 'confirmed' | 'pending' | 'failed';
  /** Amount (if applicable) */
  amount: string | null;
  /** Token type (if applicable) */
  tokenType: string | null;
}

export interface DebugState {
  /** Whether facade is started */
  facadeStarted: boolean;
  /** Dust wallet sync progress */
  syncProgress: SyncProgress | null;
  /** Dust balance breakdown (serializable strings) */
  balance: SerializableBalance | null;
  /** Dust coin count */
  coinCount: number;
  /** Facade start timestamp */
  facadeStartTime: string | null;
  /** Shielded wallet state (if available) */
  shielded: ShieldedDebugState | null;
  /** Unshielded wallet state (if available) */
  unshielded: UnshieldedDebugState | null;
  /** Recent transactions (if available) */
  recentTransactions: TransactionInfo[];
}

export interface ConnectionStatus {
  /** Node RPC health */
  node: ServiceHealth;
  /** Indexer health */
  indexer: ServiceHealth;
  /** Prover health */
  prover: ServiceHealth;
}

// ============================================
// Wallet Facade
// ============================================

/**
 * Full wallet facade integrating DustWallet, ShieldedWallet, and UnshieldedWallet.
 */
export class LumenFacade {
  private walletFacade: WalletFacade | null = null;
  private dustWallet: ReturnType<ReturnType<typeof DustWallet>['startWithSeed']> | null = null;
  private shieldedWallet: ReturnType<ReturnType<typeof ShieldedWallet>['startWithShieldedSeed']> | null = null;
  private unshieldedWallet: ReturnType<ReturnType<typeof UnshieldedWallet>['startWithPublicKey']> | null = null;
  private config: FacadeConfig;
  private keys: WalletKeys;
  /** Timestamp when facade was started */
  private startTime: Date | null = null;
  /** Whether full facade mode is enabled */
  private fullFacadeEnabled = false;

  constructor(config: FacadeConfig, keys: WalletKeys) {
    this.config = config;
    this.keys = keys;
  }

  /**
   * Initialize the wallet and start syncing with the network.
   * @param enableFullFacade If true, also starts ShieldedWallet and UnshieldedWallet
   */
  async start(enableFullFacade = false): Promise<void> {
    if (this.dustWallet) {
      return; // Already started
    }

    this.fullFacadeEnabled = enableFullFacade;

    // Common configuration
    const commonConfig = {
      networkId: this.config.networkId,
      indexerClientConnection: {
        indexerHttpUrl: this.config.indexerHttpUrl,
        indexerWsUrl: this.config.indexerWsUrl,
      },
    };

    // DustWallet configuration
    const dustConfig = {
      ...commonConfig,
      costParameters: {
        feePerByte: 1n,
        feeBase: 1000n,
      },
      relayURL: new URL(this.config.nodeUrl),
      provingServerUrl: new URL(this.config.proverUrl),
    };

    // Create DustWallet
    const DustWalletClass = DustWallet(dustConfig);
    const dustParameters = LedgerParameters.initialParameters().dust;
    this.dustWallet = DustWalletClass.startWithSeed(this.keys.dustKey, dustParameters);
    const dustSecretKey = DustSecretKey.fromSeed(this.keys.dustKey);
    await this.dustWallet.start(dustSecretKey);

    console.log('[Facade] DustWallet started');

    // Start full facade if enabled
    if (enableFullFacade) {
      try {
        // ShieldedWallet configuration
        const shieldedConfig = {
          ...commonConfig,
          provingServerUrl: new URL(this.config.proverUrl),
          relayUrl: new URL(this.config.nodeUrl),
        };

        // Create ShieldedWallet
        const ShieldedWalletClass = ShieldedWallet(shieldedConfig);
        this.shieldedWallet = ShieldedWalletClass.startWithShieldedSeed(this.keys.shieldedKey);

        // Create ZswapSecretKeys for starting shielded wallet
        const zswapSecretKeys = ZswapSecretKeys.fromSeed(this.keys.shieldedKey);

        // UnshieldedWallet configuration
        const unshieldedConfig = {
          ...commonConfig,
          relayUrl: new URL(this.config.nodeUrl),
        };

        // Create UnshieldedWallet with public key
        const UnshieldedWalletClass = UnshieldedWallet(unshieldedConfig);
        // UnshieldedWallet needs a public key - derive from shielded keys
        const publicKey = zswapSecretKeys.coinPublicKey;
        this.unshieldedWallet = UnshieldedWalletClass.startWithPublicKey(publicKey);

        // Create full WalletFacade
        this.walletFacade = new WalletFacade(
          this.shieldedWallet,
          this.unshieldedWallet,
          this.dustWallet
        );

        // Start the full facade
        await this.walletFacade.start(zswapSecretKeys, dustSecretKey);

        console.log('[Facade] Full WalletFacade started');
      } catch (error) {
        console.warn('[Facade] Failed to start full facade, continuing with DustWallet only:', error);
        this.fullFacadeEnabled = false;
      }
    }

    // Record start time
    this.startTime = new Date();
  }

  /**
   * Stop the wallet and disconnect from the network.
   */
  async stop(): Promise<void> {
    if (this.walletFacade) {
      await this.walletFacade.stop();
      this.walletFacade = null;
      this.shieldedWallet = null;
      this.unshieldedWallet = null;
    }

    if (this.dustWallet) {
      await this.dustWallet.stop();
      this.dustWallet = null;
    }

    this.startTime = null;
    console.log('[Facade] Wallet stopped');
  }

  /**
   * Get the current DUST balance.
   */
  async getBalance(): Promise<DustBalance> {
    if (!this.dustWallet) {
      throw new Error('Wallet not started. Call start() first.');
    }

    const state = await this.dustWallet.waitForSyncedState();
    const total = state.walletBalance(new Date());
    const pendingCoins = state.pendingCoins;
    const pending = pendingCoins.reduce((sum, coin) => sum + coin.initialValue, 0n);
    const available = total - pending;

    return { total, available, pending };
  }

  /**
   * Get the current dust wallet state without waiting for full sync.
   */
  async getCurrentState(): Promise<DustWalletState | null> {
    if (!this.dustWallet) {
      return null;
    }

    try {
      const state = await firstValueFrom(this.dustWallet.state.pipe(take(1)));
      return state;
    } catch {
      return null;
    }
  }

  /**
   * Get the current shielded wallet state.
   */
  async getShieldedState(): Promise<ShieldedWalletState | null> {
    if (!this.shieldedWallet) {
      return null;
    }

    try {
      const state = await firstValueFrom(this.shieldedWallet.state.pipe(take(1)));
      return state;
    } catch {
      return null;
    }
  }

  /**
   * Get the current unshielded wallet state.
   */
  async getUnshieldedState(): Promise<UnshieldedWalletState | null> {
    if (!this.unshieldedWallet) {
      return null;
    }

    try {
      const state = await firstValueFrom(this.unshieldedWallet.state.pipe(take(1)));
      return state;
    } catch {
      return null;
    }
  }

  /**
   * Get balance from current state without waiting for sync.
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
    const dustSecretKey = DustSecretKey.fromSeed(this.keys.dustKey);
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
   * Check if full facade mode is enabled.
   */
  isFullFacadeEnabled(): boolean {
    return this.fullFacadeEnabled && this.walletFacade !== null;
  }

  /**
   * Extract sync progress from a wallet state's progress object.
   */
  private extractSyncProgress(progress: { appliedIndex?: bigint; highestIndex?: bigint; highestRelevantIndex?: bigint; isStrictlyComplete?: () => boolean }): SyncProgress {
    const appliedIndex = Number(progress.appliedIndex ?? 0);
    const highestIndex = Number(progress.highestIndex ?? 0);
    const highestRelevantIndex = Number(progress.highestRelevantIndex ?? 0);

    let isComplete = false;
    if (typeof progress.isStrictlyComplete === 'function') {
      isComplete = progress.isStrictlyComplete();
    } else {
      isComplete = (highestIndex > 0 && appliedIndex >= highestIndex) || (highestIndex === 0 && appliedIndex > 0);
    }

    const percentage = isComplete
      ? 100
      : highestIndex > 0
        ? Math.round((appliedIndex / highestIndex) * 100)
        : 0;

    return {
      percentage: isComplete ? 100 : percentage,
      appliedIndex,
      highestIndex,
      highestRelevantIndex,
      isComplete,
    };
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
        shielded: null,
        unshielded: null,
        recentTransactions: [],
      };
    }

    // Get dust wallet state
    const dustState = await this.getCurrentState();
    let syncProgress: SyncProgress | null = null;
    if (dustState) {
      syncProgress = this.extractSyncProgress(dustState.progress);
    }

    // Get balance
    const rawBalance = await this.getBalanceNonBlocking();
    const balance: SerializableBalance | null = rawBalance
      ? {
          total: rawBalance.total.toString(),
          available: rawBalance.available.toString(),
          pending: rawBalance.pending.toString(),
        }
      : null;

    const coinCount = dustState?.availableCoins?.length ?? 0;

    // Get shielded state if available
    let shielded: ShieldedDebugState | null = null;
    if (this.fullFacadeEnabled) {
      const shieldedState = await this.getShieldedState();
      if (shieldedState) {
        const balances: Record<string, string> = {};
        for (const [tokenType, amount] of Object.entries(shieldedState.balances ?? {})) {
          balances[tokenType] = (amount as bigint).toString();
        }

        // Extract address string from SDK address object (has coinPublicKey property)
        let addressStr: string | null = null;
        if (shieldedState.address) {
          const addr = shieldedState.address as { coinPublicKey?: unknown };
          const cpk = addr.coinPublicKey;

          if (cpk instanceof Uint8Array) {
            addressStr = Array.from(cpk).map(b => b.toString(16).padStart(2, '0')).join('');
          } else if (Array.isArray(cpk)) {
            addressStr = cpk.map((b: number) => b.toString(16).padStart(2, '0')).join('');
          } else if (typeof cpk === 'bigint') {
            addressStr = cpk.toString(16).padStart(64, '0');
          } else if (typeof cpk === 'string') {
            addressStr = cpk;
          } else if (cpk && typeof cpk === 'object') {
            const cpkObj = cpk as Record<string, unknown>;
            if (cpkObj.bytes instanceof Uint8Array) {
              addressStr = Array.from(cpkObj.bytes).map(b => b.toString(16).padStart(2, '0')).join('');
            } else if (typeof cpkObj.toHex === 'function') {
              addressStr = (cpkObj.toHex as () => string)();
            } else {
              // Find first Uint8Array property
              for (const val of Object.values(cpkObj)) {
                if (val instanceof Uint8Array) {
                  addressStr = Array.from(val).map(b => b.toString(16).padStart(2, '0')).join('');
                  break;
                }
              }
            }
          }
        }

        shielded = {
          balances,
          coinCount: shieldedState.totalCoins?.length ?? 0,
          address: addressStr,
          syncProgress: shieldedState.state?.progress ? this.extractSyncProgress(shieldedState.state.progress) : null,
        };
      }
    }

    // Get unshielded state if available
    let unshielded: UnshieldedDebugState | null = null;
    if (this.fullFacadeEnabled) {
      const unshieldedState = await this.getUnshieldedState();
      if (unshieldedState) {
        unshielded = {
          balance: (unshieldedState.balance ?? 0n).toString(),
          utxoCount: unshieldedState.utxos?.length ?? 0,
          isRegistered: unshieldedState.isRegistered ?? false,
          syncProgress: unshieldedState.state?.progress ? this.extractSyncProgress(unshieldedState.state.progress) : null,
        };
      }
    }

    // Extract transaction history from shielded wallet
    const recentTransactions = await this.extractTransactionHistory();

    return {
      facadeStarted,
      syncProgress,
      balance,
      coinCount,
      facadeStartTime: this.startTime?.toISOString() ?? null,
      shielded,
      unshielded,
      recentTransactions,
    };
  }

  /**
   * Extract transaction history from shielded and unshielded wallet states.
   * Returns up to 10 most recent transactions, sorted by timestamp.
   */
  private async extractTransactionHistory(): Promise<TransactionInfo[]> {
    if (!this.fullFacadeEnabled) {
      return [];
    }

    const transactions: TransactionInfo[] = [];

    // Extract from shielded wallet
    try {
      const shieldedState = await this.getShieldedState();
      if (shieldedState?.transactionHistory?.length > 0) {
        const recentTxs = shieldedState.transactionHistory.slice(-10).reverse();

        for (const tx of recentTxs) {
          try {
            const txHash = typeof tx.transactionHash === 'function'
              ? tx.transactionHash()
              : String(tx);

            let txType: TransactionInfo['type'] = 'unknown';
            let amount: string | null = null;
            let tokenType: string | null = null;

            if (tx.rewards) {
              txType = 'registration';
            } else if (tx.intents && tx.intents.size > 0) {
              txType = 'swap';
            } else {
              txType = 'transfer';
            }

            try {
              const imbalances = typeof tx.imbalances === 'function' ? tx.imbalances(0) : null;
              if (imbalances && imbalances.size > 0) {
                for (const [token, value] of imbalances.entries()) {
                  if (value !== 0n) {
                    amount = (value < 0n ? -value : value).toString();
                    tokenType = String(token);
                    break;
                  }
                }
              }
            } catch {
              // Imbalances not available
            }

            transactions.push({
              id: txHash,
              type: txType,
              timestamp: null,
              status: 'confirmed',
              amount,
              tokenType,
            });
          } catch (err) {
            console.warn('[Facade] Failed to process shielded transaction:', err);
          }
        }
      }
    } catch (err) {
      console.warn('[Facade] Failed to extract shielded transaction history:', err);
    }

    // Extract from unshielded wallet
    try {
      const unshieldedState = await this.getUnshieldedState();
      if (unshieldedState?.transactionHistory) {
        const txHistory = unshieldedState.transactionHistory;
        // getAll() returns AsyncIterableIterator
        if (typeof txHistory.getAll === 'function') {
          const entries: Array<{
            hash: string;
            timestamp: Date;
            status: 'SUCCESS' | 'FAILURE' | 'PARTIAL_SUCCESS';
            fees: bigint | null;
          }> = [];

          // Collect entries from async iterator
          for await (const entry of txHistory.getAll()) {
            entries.push(entry);
            if (entries.length >= 10) break; // Limit
          }

          for (const entry of entries) {
            const statusMap: Record<string, TransactionInfo['status']> = {
              'SUCCESS': 'confirmed',
              'FAILURE': 'failed',
              'PARTIAL_SUCCESS': 'confirmed',
            };

            transactions.push({
              id: entry.hash,
              type: 'transfer', // Unshielded are typically transfers
              timestamp: entry.timestamp?.toISOString() ?? null,
              status: statusMap[entry.status] ?? 'confirmed',
              amount: entry.fees?.toString() ?? null,
              tokenType: 'tDUST',
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Facade] Failed to extract unshielded transaction history:', err);
    }

    // Sort by timestamp (if available), most recent first
    transactions.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Return up to 10
    return transactions.slice(0, 10);
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
   */
  async getConnectionStatus(): Promise<ConnectionStatus> {
    const now = new Date().toISOString();

    const unknownHealth: ServiceHealth = {
      status: 'unknown',
      latency: null,
      lastChecked: null,
      error: null,
    };

    if (!this.dustWallet) {
      return {
        node: unknownHealth,
        indexer: unknownHealth,
        prover: unknownHealth,
      };
    }

    const [nodeResult, indexerResult, proverResult] = await Promise.all([
      checkNodeHealth(this.config.nodeUrl),
      checkIndexerHealth(this.config.indexerHttpUrl),
      checkProverHealth(this.config.proverUrl),
    ]);

    const toServiceHealth = (result: { success: boolean; latency: number; error?: string }): ServiceHealth => ({
      status: result.success ? 'healthy' : 'unhealthy',
      latency: result.latency,
      lastChecked: now,
      error: result.error ?? null,
    });

    return {
      node: toServiceHealth(nodeResult),
      indexer: toServiceHealth(indexerResult),
      prover: toServiceHealth(proverResult),
    };
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new LumenFacade instance.
 * @param config Network configuration
 * @param keys Wallet keys (dustKey required, shieldedKey and unshieldedPublicKey for full facade)
 */
export function createFacade(config: FacadeConfig, keys: WalletKeys): LumenFacade {
  return new LumenFacade(config, keys);
}

/**
 * Create a new LumenFacade instance with just dust key (backward compatible).
 * @param config Network configuration
 * @param dustKey HD-derived dust key (32 bytes)
 */
export function createDustOnlyFacade(config: FacadeConfig, dustKey: Uint8Array): LumenFacade {
  return new LumenFacade(config, {
    dustKey,
    shieldedKey: dustKey, // Placeholder, won't be used if full facade not enabled
    unshieldedPublicKey: new Uint8Array(32),
  });
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
