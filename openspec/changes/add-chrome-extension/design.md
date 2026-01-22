# Design: Chrome Extension Architecture

## Overview

Lumen is a Manifest V3 Chrome extension with four main components communicating via Chrome's message passing API.

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome Browser                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    messages    ┌──────────────────────┐   │
│  │   Popup UI   │◄──────────────►│   Service Worker     │   │
│  │  (popup.html)│                │   (background.ts)    │   │
│  └──────────────┘                │                      │   │
│                                  │  - Wallet state      │   │
│                                  │  - Signing ops       │   │
│                                  │  - Network calls     │   │
│  ┌──────────────┐    messages    │                      │   │
│  │Content Script│◄──────────────►│                      │   │
│  │ (content.ts) │                └──────────────────────┘   │
│  └──────┬───────┘                                           │
│         │ window.postMessage                                │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ Injected     │  ← window.midnight (dApp connector API)   │
│  │ (inject.ts)  │                                           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Service Worker (background.ts)

The service worker is the source of truth for wallet state:

- **Wallet State**: Holds the active wallet (keys in memory, never persisted to disk)
- **Signing**: All cryptographic operations happen here
- **Network**: RPC calls to Midnight nodes
- **Session Management**: Wallet cleared on extension restart (MV3 limitation)

Key decision: Keep keys only in service worker memory. Never write to chrome.storage for initial version.

### Content Script (content.ts)

Bridge between web pages and the extension:

- Injects the dApp connector script into page context
- Relays messages between injected script and service worker
- Validates message origins for security

### Injected Script (inject.ts)

Exposes `window.midnight` API to dApps:

- Implements midnight-dapp-connector-api interface
- Communicates with content script via `window.postMessage`
- No direct access to extension APIs (isolated context)

### Popup UI (popup.html + popup.ts)

Developer interface for wallet management:

- Plain HTML/CSS (no framework)
- Shows current wallet address and DUST balance
- Generate new wallet / import existing
- Network configuration (RPC endpoint)
- Connection status indicator

## Message Flow

### dApp Connection Request

```
1. dApp calls window.midnight.enable()
2. inject.ts posts message to content.ts
3. content.ts sends chrome.runtime.sendMessage to service worker
4. Service worker checks state, returns { enabled: true, address: "..." }
5. Response flows back through content.ts → inject.ts → dApp
```

### Transaction Signing

```
1. dApp calls window.midnight.signTransaction(tx)
2. Message relayed to service worker
3. Service worker signs with in-memory key
4. Signed transaction returned to dApp
```

## Directory Structure

```
src/
├── manifest.json           # Extension manifest (V3)
├── background/
│   └── service-worker.ts   # Main background script
├── content/
│   └── content.ts          # Content script
├── inject/
│   └── inject.ts           # Injected dApp connector
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.ts            # Popup logic
│   └── popup.css           # Styles
├── core/
│   ├── wallet.ts           # Wallet operations (generate, import, sign)
│   ├── network.ts          # RPC client
│   └── types.ts            # Shared types
└── lib/
    └── messaging.ts        # Message passing utilities
```

## Build Setup

- **TypeScript**: Strict mode, ES2020 target
- **esbuild**: Fast bundling for each entry point
- **No framework**: Keep dependencies minimal

### NPM Dependencies

Lumen uses **publicly published npm packages** from `@midnight-ntwrk` on npmjs.com.

**Core packages (stable releases available):**
```json
{
  "dependencies": {
    "@midnight-ntwrk/dapp-connector-api": "^x.x.x",
    "@midnight-ntwrk/wallet-sdk-address-format": "^x.x.x",
    "@midnight-ntwrk/wallet-sdk-capabilities": "^x.x.x",
    "@midnight-ntwrk/wallet-sdk-hd": "^x.x.x"
  }
}
```

**Extended packages (pre-release only - API may change):**
```json
{
  "dependencies": {
    "@midnight-ntwrk/wallet-sdk-facade": "x.x.x-beta.x",
    "@midnight-ntwrk/wallet-sdk-dust-wallet": "x.x.x-beta.x",
    "@midnight-ntwrk/wallet-sdk-node-client": "x.x.x-beta.x",
    "@midnight-ntwrk/wallet-sdk-utilities": "x.x.x-beta.x"
  }
}
```

Additional pre-release packages available if needed:
- `wallet-sdk-abstractions`, `wallet-sdk-indexer-client`, `wallet-sdk-prover-client`
- `wallet-sdk-runtime`, `wallet-sdk-shielded`, `wallet-sdk-unshielded-state`, `wallet-sdk-unshielded-wallet`

**Important**: Only use packages published to https://www.npmjs.com/org/midnight-ntwrk - no private registries or GitHub package installs.

Build outputs:
- `dist/background.js` - Service worker bundle
- `dist/content.js` - Content script bundle
- `dist/inject.js` - Injected script bundle
- `dist/popup/` - Popup assets

## Security Considerations

### Initial Version (Development Use)

- Keys stored in service worker memory only (cleared on restart)
- No encryption at rest (nothing persisted)
- Basic origin validation for messages
- Suitable for Localnet/DevNet/QANET/Preview/PreProd with test funds only

### Future Enhancements (Production)

- Encrypted key storage with user password
- Hardware wallet integration
- Stricter CSP policies
- Security audit

## Trade-offs

| Decision | Rationale |
|----------|-----------|
| In-memory keys only | Simpler, safer for dev tool; avoids encryption complexity |
| No React/framework | Minimal bundle, faster load, fewer dependencies |
| esbuild over webpack | Faster builds, simpler config |
| Single wallet at a time | Covers QA use case; multi-wallet adds complexity |

## Open Questions (To Resolve in Phase 0)

1. **Service Worker Compatibility**: Verify wallet-sdk packages work in service worker context (no DOM) - **Phase 0 spike will answer this**
2. **dApp Connector Spec**: Review exact API shape from `@midnight-ntwrk/dapp-connector-api` types - **Review during Phase 0**
3. **Pre-release Stability**: Determine acceptable pre-release versions for wallet-sdk-facade, dust-wallet, node-client
4. **Minimal Package Set**: Identify the minimum packages needed for core wallet functionality

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Auto-approve dApp connections | Developer tool - no user prompt needed |
| Standardized error codes | Predictable dApp error handling (NO_WALLET, SESSION_EXPIRED, etc.) |
| 24-word seed generation | Higher entropy; accept 12 or 24 on import |
| Phase 0 SDK spike | Go/no-go gate before committing to implementation |
