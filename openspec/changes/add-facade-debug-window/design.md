# Design: Wallet Facade Debug Window

## Context

Lumen is a developer/QA wallet. Visibility into internal state is essential for:
- Debugging sync issues when testing dApps
- Verifying coin inventory after transactions
- Diagnosing connection problems to localnet/devnet
- Generating bug reports with full state snapshot

## Goals

- Provide real-time visibility into DustWallet state
- Non-intrusive UI that doesn't clutter normal wallet usage
- Easy export of debug info for bug reports

## Non-Goals

- Production-ready UI polish (this is a developer tool)
- Performance optimization of debug queries (developer use case)
- Persistent debug settings across sessions

## Decisions

### 1. Debug Panel Location
**Decision**: Collapsible panel within the existing popup, toggled via a small debug icon in the header.

**Alternatives considered**:
- Separate debug page (`debug.html`): More space but requires navigation, breaks flow
- DevTools panel: Requires complex setup, not as accessible
- Always-visible section: Clutters UI for users who don't need debug info

**Rationale**: Toggle panel keeps debug info one click away without adding navigation overhead.

### 2. State Exposure Pattern
**Decision**: Add discrete `getDebugState()`, `getCoins()`, `getConnectionStatus()` methods to facade, exposed via service worker handlers.

**Rationale**:
- Separation of concerns (debug methods vs operational methods)
- Can be called on-demand when debug panel opens
- Aligns with existing message-passing architecture

### 3. Real-time Updates
**Decision**: Debug panel fetches state on open and refreshes every 1 second while visible.

**Alternatives considered**:
- Push updates via existing balance broadcast: Adds overhead even when debug panel closed
- Manual refresh only: Less useful for watching sync progress

**Rationale**: Polling while visible is simple and sufficient for debug use case.

## Data Model

### DebugState
```typescript
interface DebugState {
  // Facade status
  facadeStarted: boolean;

  // Sync progress
  syncProgress: {
    percentage: number;      // 0-100
    currentBlock: number;
    targetBlock: number;
    isComplete: boolean;
  };

  // Balance breakdown
  balance: {
    total: string;
    available: string;
    pending: string;
  };

  // Coin inventory
  coinCount: number;

  // Timestamps
  lastSyncTime: string | null;
  facadeStartTime: string | null;
}
```

### CoinInfo
```typescript
interface CoinInfo {
  value: string;           // Amount in smallest unit
  status: 'spendable' | 'pending' | 'spent';
  createdAt: string;       // Block height or timestamp
}
```

### ConnectionStatus
```typescript
interface ConnectionStatus {
  indexerWs: 'connected' | 'connecting' | 'disconnected' | 'error';
  nodeRpc: 'connected' | 'disconnected' | 'error';
  lastError: string | null;
}
```

## UI Wireframe

```
+----------------------------------+
| Lumen Wallet           [🔧] [X]  |  <- Debug toggle icon
+----------------------------------+
| Address: dust1abc...xyz    [Copy]|
| Balance: 12,500,000 DUST   [⟳]  |
| Network: [Localnet ▼]            |
+----------------------------------+
| [Debug Panel - when open]        |
| -------------------------------- |
| Sync: ████████░░ 80% (1200/1500) |
| Status: Syncing...               |
| -------------------------------- |
| Balance Breakdown:               |
|   Total:     12,500,000          |
|   Available: 12,500,000          |
|   Pending:   0                   |
| -------------------------------- |
| Coins (3):                       |
|   • 5,000,000 - spendable        |
|   • 5,000,000 - spendable        |
|   • 2,500,000 - spendable        |
| -------------------------------- |
| Connection:                      |
|   Indexer WS: 🟢 Connected       |
|   Node RPC:   🟢 Connected       |
| -------------------------------- |
| [Copy Debug Info]                |
+----------------------------------+
```

## Risks / Trade-offs

- **Risk**: Debug queries might slow down sync
  - **Mitigation**: Use non-blocking state access, cache results

- **Risk**: Debug panel code increases bundle size
  - **Mitigation**: Acceptable for developer tool; can lazy-load if needed later

## Open Questions

- Should debug info be available when no wallet is loaded? (Probably yes, show connection status at minimum)
- Should we log facade events to a circular buffer for historical view? (Defer to future enhancement)
