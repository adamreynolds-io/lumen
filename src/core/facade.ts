/**
 * Lumen Facade
 *
 * Thin wrapper around wallet-sdk-facade that holds state and delegates
 * to the lib functions. Follows the midnight-wallet-cli pattern.
 */

import type { WalletFacade, FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';
import type { KeyStore, TransactionHistoryEntry } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import type { DustWalletState } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import type { ShieldedWalletState } from '@midnight-ntwrk/wallet-sdk-shielded';
import type { UnshieldedWalletState } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import type * as ledger from '@midnight-ntwrk/ledger-v7';
import { ShieldedAddress, UnshieldedAddress, DustAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { firstValueFrom } from 'rxjs';
import { take, timeout } from 'rxjs/operators';

import {
  initializeWallet,
  executeTransfer,
  executeDustRegistration,
  executeDustDeregistration,
  type EnvironmentConfig,
  type WalletSecretKeys,
  type TransferParams as LibTransferParams,
  type TransferResult as LibTransferResult,
} from '../lib/index.js';

import {
  type ServiceHealth,
  checkNodeHealth,
  checkIndexerHealth,
  checkProverHealth,
} from './network.js';
import { toSdkNetworkId, type NetworkId } from './types.js';

// ============================================
// Types
// ============================================

export interface FacadeConfig {
  networkId: string;
  indexerHttpUrl: string;
  indexerWsUrl: string;
  nodeUrl: string;
  proverUrl: string;
}

// Re-export for backward compatibility
export type TransferParams = LibTransferParams;
export type TransferResult = LibTransferResult;

export interface DustRegistrationParams {
  utxoIds: string[];
  dustReceiverAddress?: string;
}

export interface DustRegistrationResult {
  success: boolean;
  txId?: string;
  error?: string;
}

export interface DustDeregistrationParams {
  utxoIds: string[];
}

export interface DustDeregistrationResult {
  success: boolean;
  txId?: string;
  error?: string;
}

export interface NightUtxoInfo {
  id: string;
  value: string;
  registeredForDustGeneration: boolean;
  tokenType: string;
}

export interface WalletAddresses {
  shielded: string | null;
  unshielded: string | null;
  dust: string | null;
}

export interface DustBalance {
  total: bigint;
  available: bigint;
  pending: bigint;
}

export interface SyncProgress {
  percentage: number;
  appliedIndex: number;
  highestIndex: number;
  highestRelevantIndex: number;
  isComplete: boolean;
}

export interface SerializableBalance {
  total: string;
  available: string;
  pending: string;
}

export interface ShieldedDebugState {
  balances: Record<string, string>;
  coinCount: number;
  address: string | null;
  syncProgress: SyncProgress | null;
}

export interface UnshieldedDebugState {
  balance: string;
  utxoCount: number;
  isRegistered: boolean;
  syncProgress: SyncProgress | null;
}

export interface TransactionInfo {
  id: string;
  type: 'transfer' | 'swap' | 'registration' | 'unknown';
  timestamp: string | null;
  status: 'confirmed' | 'pending' | 'failed';
  amount: string | null;
  tokenType: string | null;
}

export interface DustGenerationInfo {
  generationTime: string | null;
  maxCapacity: string;
  maxCapReachedAt: string;
  currentlyGenerated: string;
  rate: string;
}

export interface CoinInfo {
  value: string;
  status: 'spendable' | 'pending' | 'spent';
  createdAt: string | null;
  sequenceNumber: number | null;
  merkleTreeIndex: string | null;
  backingNightNonce: string | null;
  generation: DustGenerationInfo | null;
}

export interface DebugState {
  facadeStarted: boolean;
  syncProgress: SyncProgress | null;
  balance: SerializableBalance | null;
  coinCount: number;
  facadeStartTime: string | null;
  shielded: ShieldedDebugState | null;
  unshielded: UnshieldedDebugState | null;
  recentTransactions: TransactionInfo[];
}

export interface ConnectionStatus {
  node: ServiceHealth;
  indexer: ServiceHealth;
  prover: ServiceHealth;
}

// ============================================
// Lumen Facade
// ============================================

/**
 * Thin wrapper around WalletFacade that follows midnight-wallet-cli pattern.
 */
export class LumenFacade {
  private walletFacade: WalletFacade | null = null;
  private secretKeys: WalletSecretKeys | null = null;
  private unshieldedKeystore: KeyStore | null = null;
  private config: FacadeConfig;
  private startTime: Date | null = null;

  constructor(config: FacadeConfig) {
    this.config = config;
  }

  /**
   * Initialize and start the wallet.
   */
  async start(seed: Uint8Array): Promise<void> {
    if (this.walletFacade) {
      return; // Already started
    }

    const envConfig: EnvironmentConfig = {
      networkId: toSdkNetworkId(this.config.networkId as NetworkId),
      indexerHttpUrl: this.config.indexerHttpUrl,
      indexerWsUrl: this.config.indexerWsUrl,
      nodeWsUrl: this.config.nodeUrl,
      provingServerUrl: this.config.proverUrl,
    };

    const result = await initializeWallet(seed, envConfig);

    this.walletFacade = result.facade;
    this.secretKeys = result.secretKeys;
    this.unshieldedKeystore = result.unshieldedKeystore;
    this.startTime = new Date();

    console.log('[LumenFacade] Wallet started');
  }

  /**
   * Stop the wallet.
   */
  async stop(): Promise<void> {
    if (this.walletFacade) {
      await this.walletFacade.stop();
      this.walletFacade = null;
      this.secretKeys = null;
      this.unshieldedKeystore = null;
      this.startTime = null;
      console.log('[LumenFacade] Wallet stopped');
    }
  }

  /**
   * Check if wallet is started.
   */
  isStarted(): boolean {
    return this.walletFacade !== null;
  }

  // ============================================
  // Wallet Operations (delegate to lib functions)
  // ============================================

  /**
   * Transfer tokens.
   */
  async transfer(params: TransferParams): Promise<TransferResult> {
    if (!this.walletFacade || !this.secretKeys) {
      return { success: false, error: 'Wallet not started' };
    }

    return executeTransfer(
      this.walletFacade,
      params,
      this.secretKeys,
      this.unshieldedKeystore ?? undefined
    );
  }

  /**
   * Register NIGHT UTXOs for dust generation.
   */
  async registerForDust(params: DustRegistrationParams): Promise<DustRegistrationResult> {
    if (!this.walletFacade || !this.unshieldedKeystore) {
      return { success: false, error: 'Wallet not started' };
    }

    const state = await this.getUnshieldedState();
    if (!state?.availableCoins || state.availableCoins.length === 0) {
      return { success: false, error: 'No UTXOs available' };
    }

    // Filter available coins by the requested UTXO IDs
    const selectedUtxos = state.availableCoins.filter((coin) => {
      const utxoId = coin.utxo?.hash?.toString() ?? '';
      return params.utxoIds.includes(utxoId);
    });

    if (selectedUtxos.length === 0) {
      return { success: false, error: 'Selected UTXOs not found' };
    }

    return executeDustRegistration(
      this.walletFacade,
      { nightUtxos: selectedUtxos, dustReceiverAddress: params.dustReceiverAddress },
      this.unshieldedKeystore
    );
  }

  /**
   * Deregister NIGHT UTXOs from dust generation.
   */
  async deregisterFromDust(params: DustDeregistrationParams): Promise<DustDeregistrationResult> {
    if (!this.walletFacade || !this.unshieldedKeystore) {
      return { success: false, error: 'Wallet not started' };
    }

    const state = await this.getUnshieldedState();
    if (!state?.availableCoins || state.availableCoins.length === 0) {
      return { success: false, error: 'No UTXOs available' };
    }

    // Filter available coins by the requested UTXO IDs
    const selectedUtxos = state.availableCoins.filter((coin) => {
      const utxoId = coin.utxo?.hash?.toString() ?? '';
      return params.utxoIds.includes(utxoId);
    });

    if (selectedUtxos.length === 0) {
      return { success: false, error: 'Selected UTXOs not found' };
    }

    return executeDustDeregistration(
      this.walletFacade,
      { nightUtxos: selectedUtxos },
      this.unshieldedKeystore
    );
  }

  // ============================================
  // State Queries
  // ============================================

  private async getDustState(): Promise<DustWalletState | null> {
    if (!this.walletFacade) return null;
    try {
      const facadeState = await firstValueFrom(this.walletFacade.state().pipe(take(1)));
      return facadeState.dust;
    } catch {
      return null;
    }
  }

  private async getShieldedState(): Promise<ShieldedWalletState | null> {
    if (!this.walletFacade) return null;
    try {
      const facadeState = await firstValueFrom(this.walletFacade.state().pipe(take(1)));
      return facadeState.shielded;
    } catch {
      return null;
    }
  }

  private async getUnshieldedState(): Promise<UnshieldedWalletState | null> {
    if (!this.walletFacade) return null;
    try {
      const facadeState = await firstValueFrom(this.walletFacade.state().pipe(take(1)));
      return facadeState.unshielded;
    } catch {
      return null;
    }
  }

  async getBalance(): Promise<DustBalance | null> {
    const state = await this.getDustState();
    if (!state) return null;

    const total = state.walletBalance(new Date());
    const pending = state.pendingCoins.reduce((sum, coin) => sum + coin.initialValue, 0n);
    return { total, available: total - pending, pending };
  }

  async getBalanceNonBlocking(): Promise<DustBalance | null> {
    return this.getBalance();
  }

  async getWalletAddresses(): Promise<WalletAddresses> {
    const result: WalletAddresses = { shielded: null, unshielded: null, dust: null };

    if (!this.walletFacade) return result;

    try {
      // Get combined state from facade.state() like wallet-cli does
      // Add timeout to avoid hanging if state hasn't emitted yet
      const state = await firstValueFrom(
        this.walletFacade.state().pipe(
          take(1),
          timeout(5000)
        )
      );

      // Use SDK codec methods to encode addresses
      // Must use SDK network ID (e.g., "undeployed") not config string (e.g., "localnet")
      const sdkNetworkId = toSdkNetworkId(this.config.networkId as NetworkId);

      if (state.shielded?.address) {
        result.shielded = ShieldedAddress.codec.encode(sdkNetworkId, state.shielded.address).asString();
      }

      if (state.unshielded?.address) {
        result.unshielded = UnshieldedAddress.codec.encode(sdkNetworkId, state.unshielded.address).asString();
      }

      if (state.dust?.address) {
        result.dust = DustAddress.codec.encode(sdkNetworkId, state.dust.address).asString();
      }
    } catch (e) {
      // Timeout or error - addresses not available yet
      console.warn('[LumenFacade] Could not get addresses from state:', e);
    }

    return result;
  }

  private formatAddress(address: unknown, prefix: string): string | null {
    if (!address) return null;

    // Handle various address formats from SDK
    if (typeof address === 'string') return address;

    const addr = address as Record<string, unknown>;

    // Try coinPublicKey (shielded)
    const cpk = addr.coinPublicKey ?? addr.publicKey ?? addr.bytes;
    if (cpk instanceof Uint8Array) {
      return `${prefix}${Array.from(cpk).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40)}`;
    }
    if (typeof cpk === 'bigint') {
      return `${prefix}${cpk.toString(16).padStart(64, '0').slice(0, 40)}`;
    }

    return null;
  }

  async getUnregisteredNightUtxos(): Promise<NightUtxoInfo[]> {
    const state = await this.getUnshieldedState();
    if (!state?.availableCoins) return [];

    // Available coins from unshielded wallet that can be registered for dust
    return state.availableCoins.map((coin) => ({
      id: coin.utxo?.hash?.toString() ?? '',
      value: (coin.utxo?.value ?? 0n).toString(),
      registeredForDustGeneration: false,
      tokenType: 'NIGHT',
    }));
  }

  async getRegisteredNightUtxos(): Promise<NightUtxoInfo[]> {
    // Registered UTXOs are tracked in the dust wallet, not unshielded
    const dustState = await this.getDustState();
    if (!dustState?.availableCoins) return [];

    // Return dust coins as "registered" since they're generating dust
    return dustState.availableCoins.map((coin) => ({
      id: coin.backingNight?.toString() ?? '',
      value: coin.initialValue.toString(),
      registeredForDustGeneration: true,
      tokenType: 'NIGHT',
    }));
  }

  // ============================================
  // Debug State
  // ============================================

  private extractSyncProgress(progress: {
    appliedIndex?: bigint;
    highestIndex?: bigint;
    highestRelevantIndex?: bigint;
    isStrictlyComplete?: () => boolean;
  }): SyncProgress {
    const appliedIndex = Number(progress.appliedIndex ?? 0);
    const highestIndex = Number(progress.highestIndex ?? 0);
    const highestRelevantIndex = Number(progress.highestRelevantIndex ?? 0);

    const isComplete =
      typeof progress.isStrictlyComplete === 'function'
        ? progress.isStrictlyComplete()
        : highestIndex > 0 && appliedIndex >= highestIndex;

    const percentage = isComplete
      ? 100
      : highestIndex > 0
        ? Math.round((appliedIndex / highestIndex) * 100)
        : 0;

    return { percentage, appliedIndex, highestIndex, highestRelevantIndex, isComplete };
  }

  async getDebugState(): Promise<DebugState> {
    if (!this.walletFacade) {
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

    const dustState = await this.getDustState();
    const balance = await this.getBalance();

    return {
      facadeStarted: true,
      syncProgress: dustState?.progress ? this.extractSyncProgress(dustState.progress) : null,
      balance: balance
        ? {
            total: balance.total.toString(),
            available: balance.available.toString(),
            pending: balance.pending.toString(),
          }
        : null,
      coinCount: dustState?.availableCoins?.length ?? 0,
      facadeStartTime: this.startTime?.toISOString() ?? null,
      shielded: await this.getShieldedDebugState(),
      unshielded: await this.getUnshieldedDebugState(),
      recentTransactions: await this.extractTransactionHistory(),
    };
  }

  private async getShieldedDebugState(): Promise<ShieldedDebugState | null> {
    const state = await this.getShieldedState();
    if (!state) return null;

    const balances: Record<string, string> = {};
    for (const [tokenType, amount] of Object.entries(state.balances ?? {})) {
      balances[tokenType] = (amount as bigint).toString();
    }

    // Use SDK codec to encode address (must use SDK network ID)
    let address: string | null = null;
    if (state.address) {
      try {
        const sdkNetworkId = toSdkNetworkId(this.config.networkId as NetworkId);
        address = ShieldedAddress.codec.encode(sdkNetworkId, state.address).asString();
      } catch {
        address = this.formatAddress(state.address, 'zswap1');
      }
    }

    return {
      balances,
      coinCount: state.totalCoins?.length ?? 0,
      address,
      syncProgress: state.state?.progress ? this.extractSyncProgress(state.state.progress) : null,
    };
  }

  private async getUnshieldedDebugState(): Promise<UnshieldedDebugState | null> {
    const state = await this.getUnshieldedState();
    if (!state) return null;

    // Get NIGHT balance from balances record (NIGHT token ID is all zeros)
    const NIGHT_TOKEN_ID = '0000000000000000000000000000000000000000000000000000000000000000';
    const nightBalance = state.balances?.[NIGHT_TOKEN_ID] ?? 0n;

    return {
      balance: nightBalance.toString(),
      utxoCount: state.totalCoins?.length ?? 0,
      isRegistered: (state.totalCoins?.length ?? 0) > 0,
      syncProgress: state.progress ? this.extractSyncProgress(state.progress) : null,
    };
  }

  /**
   * Extract transaction history from SDK wallets (following wallet-cli pattern).
   */
  private async extractTransactionHistory(): Promise<TransactionInfo[]> {
    if (!this.walletFacade) return [];

    const transactions: TransactionInfo[] = [];

    try {
      // Get shielded transactions from ShieldedWalletState.transactionHistory
      const shieldedState = await this.getShieldedState();
      if (shieldedState?.transactionHistory) {
        for (const tx of shieldedState.transactionHistory as ledger.FinalizedTransaction[]) {
          try {
            const hash = tx.transactionHash?.()?.toString() ?? '';
            const identifiers = tx.identifiers?.() ?? [];

            // Classify transaction type from identifiers
            let type: TransactionInfo['type'] = 'unknown';
            const idStr = identifiers.join(',').toLowerCase();
            if (idStr.includes('transfer')) {
              type = 'transfer';
            } else if (idStr.includes('swap')) {
              type = 'swap';
            } else if (idStr.includes('register') || idStr.includes('dust')) {
              type = 'registration';
            }

            // Extract amount from imbalances (segment 0)
            let amount: string | null = null;
            let tokenType: string | null = null;
            try {
              const imbalances = tx.imbalances?.(0);
              if (imbalances && imbalances.size > 0) {
                const firstEntry = imbalances.entries().next().value;
                if (firstEntry) {
                  tokenType = String(firstEntry[0]);
                  amount = String(firstEntry[1]);
                }
              }
            } catch {
              // Imbalances not available
            }

            transactions.push({
              id: hash,
              type,
              timestamp: null, // Shielded transactions don't have timestamps in SDK
              status: 'confirmed',
              amount,
              tokenType,
            });
          } catch {
            // Skip malformed transaction
          }
        }
      }
    } catch (e) {
      console.warn('[LumenFacade] Error extracting shielded transactions:', e);
    }

    try {
      // Get unshielded transactions from UnshieldedWalletState.transactionHistory.getAll()
      const unshieldedState = await this.getUnshieldedState();
      if (unshieldedState?.transactionHistory) {
        const entries: TransactionHistoryEntry[] = [];
        for await (const entry of unshieldedState.transactionHistory.getAll()) {
          entries.push(entry);
          if (entries.length >= 50) break; // Limit iteration
        }

        for (const entry of entries) {
          // Classify transaction type from identifiers
          let type: TransactionInfo['type'] = 'unknown';
          const idStr = (entry.identifiers ?? []).join(',').toLowerCase();
          if (idStr.includes('transfer')) {
            type = 'transfer';
          } else if (idStr.includes('swap')) {
            type = 'swap';
          } else if (idStr.includes('register') || idStr.includes('dust')) {
            type = 'registration';
          }

          // Map status
          let status: TransactionInfo['status'] = 'confirmed';
          if (entry.status === 'FAILURE') {
            status = 'failed';
          } else if (entry.status === 'PARTIAL_SUCCESS') {
            status = 'pending';
          }

          transactions.push({
            id: entry.hash,
            type,
            timestamp: entry.timestamp?.toISOString() ?? null,
            status,
            amount: entry.fees?.toString() ?? null,
            tokenType: 'NIGHT', // Unshielded is always NIGHT
          });
        }
      }
    } catch (e) {
      console.warn('[LumenFacade] Error extracting unshielded transactions:', e);
    }

    // Sort by timestamp (newest first), nulls last
    transactions.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Return last 10
    return transactions.slice(0, 10);
  }

  async getCoins(): Promise<CoinInfo[]> {
    const state = await this.getDustState();
    if (!state) return [];

    const coins: CoinInfo[] = [];
    const now = new Date();

    try {
      for (const fullInfo of state.availableCoinsWithFullInfo(now)) {
        // Use generatedNow as the coin value (following wallet-cli pattern)
        // This is the actual current dust value, not initialValue
        const currentValue = fullInfo.generatedNow ?? fullInfo.token.initialValue ?? 0n;
        coins.push({
          value: currentValue.toString(),
          status: 'spendable',
          createdAt: fullInfo.token.ctime?.toISOString() ?? null,
          sequenceNumber: fullInfo.token.seq ?? null,
          merkleTreeIndex: fullInfo.token.mtIndex?.toString() ?? null,
          backingNightNonce: fullInfo.token.backingNight?.toString() ?? null,
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

  async getConnectionStatus(): Promise<ConnectionStatus> {
    const now = new Date().toISOString();
    const unknownHealth: ServiceHealth = {
      status: 'unknown',
      latency: null,
      lastChecked: null,
      error: null,
    };

    if (!this.walletFacade) {
      return { node: unknownHealth, indexer: unknownHealth, prover: unknownHealth };
    }

    const [nodeResult, indexerResult, proverResult] = await Promise.all([
      checkNodeHealth(this.config.nodeUrl),
      checkIndexerHealth(this.config.indexerHttpUrl),
      checkProverHealth(this.config.proverUrl),
    ]);

    const toHealth = (r: { success: boolean; latency: number; error?: string }): ServiceHealth => ({
      status: r.success ? 'healthy' : 'unhealthy',
      latency: r.latency,
      lastChecked: now,
      error: r.error ?? null,
    });

    return {
      node: toHealth(nodeResult),
      indexer: toHealth(indexerResult),
      prover: toHealth(proverResult),
    };
  }
}

// ============================================
// Factory Functions
// ============================================

export function createFacade(config: FacadeConfig): LumenFacade {
  return new LumenFacade(config);
}

export function createFacadeConfig(
  networkId: string,
  nodeUrl: string,
  indexerUrl: string,
  indexerWsUrl: string,
  proverUrl: string
): FacadeConfig {
  return { networkId, nodeUrl, indexerHttpUrl: indexerUrl, indexerWsUrl, proverUrl };
}
