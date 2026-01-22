# Proposal: Add Chrome Extension

## Summary

Implement the Lumen developer wallet as a Chrome extension (Manifest V3) that enables QA teams and developers to test Midnight dApps against devnet/testnet environments.

## Motivation

QA teams need a reliable, configurable wallet to validate releases of the dapp-connector-api and wallet-sdk. Currently there is no lightweight developer-focused wallet for testing. Lumen fills this gap as both a testing tool and a reference implementation for wallet builders.

## Scope

### In Scope

- Chrome Extension Manifest V3 structure (service worker, popup, content scripts)
- Wallet management: generate new wallets, import from seed phrase or private key
- Full dApp connector implementation (connect, balance, transaction signing)
- Custom RPC endpoint configuration for any Midnight network
- Minimal developer-focused UI (no framework, plain HTML/CSS/TS)
- Secure in-memory key storage (session-based, not persistent for initial version)

### Out of Scope

- Persistent encrypted key storage (future enhancement)
- Hardware wallet support
- Production-grade security audit
- Chrome Web Store publishing
- Local service mode (separate proposal)

## Approach

Build a minimal but complete Chrome extension following Manifest V3 patterns:

1. **Service Worker**: Background script handling wallet state and signing operations
2. **Content Script**: Injects dApp connector API into web pages
3. **Popup UI**: Developer interface for wallet management and network config
4. **Message Passing**: Secure communication between components

The wallet will implement the dapp-connector-api specification for dApp interoperability.

## Capabilities

| Capability | Description |
|------------|-------------|
| extension-core | Chrome extension infrastructure and build setup |
| wallet-management | Key generation, import, and session storage |
| dapp-connector | Full dapp-connector-api implementation |
| network-config | Custom RPC endpoint configuration |

## Risks

- **Midnight SDK compatibility**: SDK packages may have DOM/Node dependencies incompatible with service workers. Mitigated by Phase 0 spike.
- **MV3 service worker lifecycle**: Chrome terminates idle service workers (~30s), causing wallet state loss. Mitigated by clear session expiry UX and standardized error codes.
- **Key security**: In-memory storage is volatile; users must re-import on restart. Acceptable for dev tool.

## Mitigations

| Risk | Mitigation |
|------|------------|
| SDK incompatibility | Phase 0 go/no-go spike before implementation |
| Session loss confusion | SESSION_EXPIRED error code + popup indicator |
| dApp error handling | Standardized error codes across all methods |

## Success Criteria

- Extension loads in Chrome without errors
- Can generate a new wallet and view address
- Can import wallet from seed phrase
- dApps can detect and connect to Lumen
- Can sign test transactions on configured network
- QA can switch between devnet/testnet/custom endpoints
