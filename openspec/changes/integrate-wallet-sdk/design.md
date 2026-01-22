## Context

WalletFacade is the official SDK entrypoint that coordinates:
- **DustWallet** - DUST token balance and generation
- **ShieldedWallet** - Private transactions
- **UnshieldedWallet** - Public transactions
- **PolkadotNodeClient** - Node RPC communication
- **IndexerClient** - GraphQL indexer queries
- **ProverClient** - ZK proof generation

The facade uses Effect-TS for async operations, which requires adaptation for Chrome extension context.

## Goals / Non-Goals

**Goals:**
- Use WalletFacade as single wallet entrypoint
- Enable real DUST balance queries
- Enable real transaction signing
- Proper Bech32m address encoding
- Support all configured networks (localnet, devnet, qanet, preview, preprod)

**Non-Goals:**
- Shielded transactions (future phase)
- Full unshielded wallet features (future phase)
- Custom token support

## Decisions

### Decision: WalletFacade as Core

Use `@midnight-ntwrk/wallet-sdk-facade` WalletFacade as the single wallet management interface.

**Rationale:** The facade is the official SDK entrypoint that handles coordination between wallet components, state management, and service integration. Building on the facade ensures compatibility with future SDK updates.

### Decision: Effect-TS Adaptation

Wrap Effect-TS operations with Promise-based APIs for Chrome extension compatibility.

**Rationale:** Chrome extension message passing uses Promises. The SDK's Effect-TS operations need to be run and converted to Promises at the boundary.

### Decision: Service Worker Lifecycle

Initialize WalletFacade in the service worker, persist configuration in chrome.storage, reconnect on service worker activation.

**Rationale:** Chrome MV3 service workers can be terminated. The facade must be reconstructed from persisted seed/network config on each activation.

## Risks / Trade-offs

- **Bundle Size**: SDK dependencies will significantly increase bundle size (~1-2MB) - acceptable for dev wallet
- **Service Worker Limits**: May hit memory/time limits - mitigate with lazy initialization
- **SDK Stability**: Pre-release packages may have breaking changes - pin versions

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│  Popup UI                                               │
│    └── Displays: address, balance, network status       │
├─────────────────────────────────────────────────────────┤
│  Service Worker (Background)                            │
│    └── WalletFacade                                     │
│          ├── DustWallet (balance, generation)           │
│          ├── ShieldedWallet (future)                    │
│          └── UnshieldedWallet (future)                  │
│    └── Clients                                          │
│          ├── PolkadotNodeClient → Node RPC              │
│          ├── IndexerClient → GraphQL Indexer            │
│          └── ProverClient → Proof Server                │
├─────────────────────────────────────────────────────────┤
│  Content Script → Inject Script (window.midnight API)   │
└─────────────────────────────────────────────────────────┘
```

## Open Questions

- What's the minimum SDK subset needed for DUST-only operations?
- How to handle facade state across service worker restarts?
