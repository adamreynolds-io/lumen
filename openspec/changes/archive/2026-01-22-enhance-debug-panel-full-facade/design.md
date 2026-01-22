# Design: Enhanced Debug Panel with Full WalletFacade

## Context

Lumen currently uses DustWallet directly for DUST operations. The wallet-sdk provides a higher-level WalletFacade that combines:
- **ShieldedWallet**: For shielded (private) transactions and balances
- **UnshieldedWallet**: For unshielded UTXOs and public transactions
- **DustWallet**: For DUST token (gas) management

Using the full facade provides comprehensive visibility for QA testing.

## Goals

- Expose all wallet state data available from the SDK
- Provide detailed coin information including dust generation details
- Show shielded and unshielded wallet state
- Display transaction history for debugging
- Maintain backward compatibility with existing wallet operations

## Non-Goals

- Production-ready UI design (developer tool)
- Full transaction building UI (separate feature)
- Persistent state storage (stays in-memory)

## Architecture

### Current Architecture
```
popup.ts → service-worker.ts → LumenFacade → DustWallet → SDK
```

### New Architecture
```
popup.ts → service-worker.ts → LumenFacade → WalletFacade
                                                 ├── ShieldedWallet
                                                 ├── UnshieldedWallet
                                                 └── DustWallet
```

## Key Decisions

### 1. Key Derivation for Full Facade
**Decision**: Derive all required keys from the HD wallet seed.

| Key Type | HD Path | Usage |
|----------|---------|-------|
| DustKey | `m/purpose/coin/account/Dust/0` | DustWallet, gas payments |
| ZswapSecretKeys | `m/purpose/coin/account/NightExternal/0` + `NightInternal/0` | ShieldedWallet |
| PublicKey | Derived from ZswapSecretKeys | UnshieldedWallet |

### 2. WalletFacade Configuration
**Decision**: Use the same network configuration for all three wallets.

```typescript
const config = {
  networkId: 'localnet',
  indexerClientConnection: { indexerHttpUrl, indexerWsUrl },
  relayURL: nodeUrl,
  provingServerUrl: proverUrl,
};

const shieldedWallet = ShieldedWallet(config).startWithShieldedSeed(seed);
const unshieldedWallet = UnshieldedWallet(config).startWithPublicKey(publicKey);
const dustWallet = DustWallet(config).startWithSeed(dustKey, dustParameters);

const facade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
```

### 3. Debug State Structure
**Decision**: Return a comprehensive nested structure.

```typescript
interface FullDebugState {
  timestamp: string;
  isSynced: boolean;
  facadeStartTime: string | null;

  dust: {
    address: string;
    balance: { total: string; available: string; pending: string };
    coins: DetailedCoinInfo[];
    syncProgress: SyncProgress;
  };

  shielded: {
    address: string;
    balances: Record<string, string>; // token type → balance
    coinCounts: { total: number; available: number; pending: number };
    transactionHistory: TransactionInfo[];
    syncProgress: SyncProgress;
  };

  unshielded: {
    address: string;
    balances: Record<string, string>;
    utxos: UtxoInfo[];
    syncProgress: SyncProgress;
  };

  connection: ConnectionStatus;
}
```

### 4. UI Layout
**Decision**: Tabbed interface within the debug panel.

```
┌─────────────────────────────────────────┐
│ Debug Info                    [Copy All]│
├─────────────────────────────────────────┤
│ [Dust] [Shielded] [Unshielded] [Sync]   │
├─────────────────────────────────────────┤
│ ┌─ Dust Tab ──────────────────────────┐ │
│ │ Balance: 12,500,000,000             │ │
│ │ Coins (3):                          │ │
│ │  ▶ 5,000,000 - spendable            │ │
│ │    Created: 2024-01-22 10:30:00     │ │
│ │    Seq: 1, MT Index: 12345          │ │
│ │    Generation: 100/day, Cap: 1000   │ │
│ │  ▶ 5,000,000 - spendable            │ │
│ │  ▶ 2,500,000 - pending              │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Data Models

### DetailedCoinInfo (Dust)
```typescript
interface DetailedCoinInfo {
  value: string;
  status: 'spendable' | 'pending';
  createdAt: string;           // ISO timestamp
  sequenceNumber: number;
  merkleTreeIndex: string;
  backingNightNonce: string;
  // Generation details (if available)
  generation?: {
    generatedTime: string | null;
    maxCapacity: string;
    maxCapReachedAt: string;
    currentlyGenerated: string;
    rate: string;
  };
}
```

### TransactionInfo (Shielded)
```typescript
interface TransactionInfo {
  hash: string;
  type: 'transfer' | 'swap' | 'unknown';
  timestamp: string;
  inputs: { tokenType: string; amount: string }[];
  outputs: { tokenType: string; amount: string }[];
}
```

### UtxoInfo (Unshielded)
```typescript
interface UtxoInfo {
  hash: string;
  tokenType: string;
  value: string;
  createdAt: string;
  registeredForDust: boolean;
}
```

## Risks / Trade-offs

- **Risk**: Full facade increases memory usage and sync time
  - **Mitigation**: Only affects debug/dev use case, acceptable trade-off

- **Risk**: More complex key derivation
  - **Mitigation**: Follow exact SDK patterns from testkit-js

- **Risk**: SDK API changes in pre-release packages
  - **Mitigation**: Pin versions, test thoroughly

## Migration Plan

1. Phase 1 can be deployed independently (enhanced DustWallet only)
2. Phase 2-4 deployed together as full facade upgrade
3. Existing wallet operations continue to work during migration

## Open Questions

- Should we persist serialized wallet state for faster restart? (Defer - adds complexity)
- Should shielded transaction history be paginated? (Start with last 10, add pagination if needed)
