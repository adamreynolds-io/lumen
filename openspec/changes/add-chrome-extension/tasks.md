# Tasks: Add Chrome Extension

## Phase 0: SDK Compatibility Spike ✅

- [x] Create minimal test project with service worker entry point
- [x] Import @midnight-ntwrk/wallet-sdk-hd in service worker context
- [x] Verify BIP39 seed generation works (no DOM/Node dependencies)
- [x] Verify key derivation and address generation work
- [x] Test basic signing operation
- [x] Document any polyfills or workarounds required
- [x] Go/no-go decision: confirm architecture is viable

**Result**: GO - SDK is fully compatible with service worker context. See `docs/phase0-spike-results.md`.

## Phase 1: Project Setup ✅

- [x] Initialize npm project with TypeScript
- [x] Configure tsconfig.json (strict mode, ES2020)
- [x] Install @midnight-ntwrk/dapp-connector-api from npm
- [x] Install wallet-sdk packages (stable): address-format, capabilities, hd
- [x] Install wallet-sdk packages (pre-release): facade, dust-wallet, node-client, utilities
- [x] Review npm package types to understand exact API shapes
- [x] Set up esbuild for bundling (background, content, popup, inject)
- [x] Create manifest.json (Manifest V3)
- [x] Add npm scripts: build, dev (watch mode)
- [x] Create directory structure (src/background, src/content, src/popup, src/inject, src/core)
- [x] Verify extension loads in Chrome with empty scripts

**Note**: Using latest beta versions for all @midnight-ntwrk packages.

## Phase 2: Core Infrastructure ✅

- [x] Implement message passing utilities (src/lib/messaging.ts)
- [x] Define shared types (src/core/types.ts)
- [x] Create service worker skeleton (src/background/service-worker.ts)
- [x] Create content script skeleton (src/content/content.ts)
- [x] Create injected script skeleton (src/inject/inject.ts)
- [x] Verify message flow: inject → content → service worker → response

**Verified**: Test page at `test/dapp-test.html` confirms full message flow working.

## Phase 3: Wallet Core ✅

- [x] Implement wallet generation (BIP39 seed phrase)
- [x] Implement wallet import from seed phrase
- [x] Implement wallet import from private key (hex)
- [x] Implement address derivation
- [x] Implement transaction signing
- [x] Implement message signing
- [x] Unit tests for wallet operations

**Implementation Notes**:
- Created `src/core/wallet.ts` using @midnight-ntwrk/wallet-sdk-hd for HD wallet operations
- Uses @scure/bip39 for mnemonic-to-seed derivation (SDK's mnemonicToSeed had different signature)
- Address formatting uses hex format with network prefix (mn_dev_, mn_loc_, etc.) - browser-compatible bech32m encoding deferred due to SDK WASM dependencies
- All 21 unit tests passing in `test/wallet.test.ts`

## Phase 4: Network Layer ✅

- [x] Implement RPC client (src/core/network.ts)
- [x] Implement balance query
- [x] Implement network configuration storage (chrome.storage)
- [x] Add preset network URLs (Localnet, DevNet, QANET, Preview, PreProd)
- [x] Implement connection test
- [x] Verify RPC calls work from service worker

**Implementation Notes**:
- Uses @polkadot/api (same as wallet-sdk-node-client) for RPC communication
- Connection caching to avoid reconnecting for each request
- Supports HTTP, HTTPS, WS, and WSS protocols
- Balance query via Substrate's system.account storage
- Network config persisted to chrome.storage.local
- All 17 unit tests passing in `test/network.test.ts`

## Phase 5: dApp Connector API ✅

- [x] Implement window.midnight object injection
- [x] Implement enable() / disable()
- [x] Implement isEnabled()
- [x] Implement getAddress()
- [x] Implement getBalance()
- [x] Implement signTransaction()
- [x] Implement signMessage()
- [x] Implement getNetwork()
- [x] Integration test with mock dApp page

**Implementation Notes**:
- Full implementation of @midnight-ntwrk/dapp-connector-api specification
- InitialAPI pattern: window.midnight['lumen-wallet'] with rdns, name, icon, apiVersion, connect()
- ConnectedAPI with all methods: getDustAddress, getUnshieldedAddress, getDustBalance, signData, getConfiguration, getConnectionStatus, etc.
- Proper APIError handling with dapp-connector-api error codes
- Shielded operations return empty/not-implemented (developer wallet focus)
- Test page updated to demonstrate full API flow

## Phase 6: Popup UI ✅

- [x] Create popup.html structure
- [x] Create popup.css styles (minimal, developer-focused)
- [x] Implement "No Wallet" state view
- [x] Implement "Generate Wallet" flow with seed phrase display
- [x] Implement "Import Wallet" flow (seed phrase input)
- [x] Implement "Import Private Key" flow
- [x] Implement "Import Hex Seed" flow (localnet prefunded wallets)
- [x] Display wallet address with copy button
- [x] Display DUST balance with refresh button
- [x] Implement network selector (presets + custom, in both no-wallet and wallet states)
- [x] Implement connection test button (shows block height)
- [x] Implement localnet prefunded wallet quick-import buttons

**Implementation Notes**:
- Network selector available before wallet import to select target network
- Localnet shows quick-import buttons for prefunded wallets (0-3)
- Hex seed import for custom 32-byte or 64-byte seeds
- Balance refresh button with loading state
- Connection test displays block height on success

## Phase 7: Integration & Polish

- [x] Manual test page for dApp connector (test/dapp-test.html)
- [ ] End-to-end test with actual Midnight dApp
- [x] Handle edge cases (network errors, invalid inputs)
- [x] Add loading states and error messages
- [ ] README with usage instructions

## Dependencies

- Phase 0 must complete before any other phase (go/no-go gate)
- Phase 1 depends on Phase 0
- Phase 2 depends on Phase 1
- Phase 3 depends on Phase 2 (needs messaging types for wallet state)
- Phase 4 depends on Phase 2 (needs messaging)
- Phase 5 depends on Phase 2, 3, 4
- Phase 6 depends on Phase 2, 3, 4
- Phase 7 depends on all previous phases

## Phase 8: Security Hardening ✅

- [x] Fix wildcard postMessage vulnerability (use specific origin)
- [x] Add HTML escaping to prevent XSS from blockchain data
- [x] Add origin validation for dApp requests with approved origins tracking
- [x] Restrict sensitive methods to popup-only access
- [x] Add secure key wiping with random overwrite
- [x] Add rate limiting (100 req/min per origin) to service worker
- [x] Remove sensitive console logging in production
- [x] Fix message timeout memory leak
- [x] Add exponential backoff to balance polling with circuit breaker
- [x] Strengthen origin validation (block dangerous protocols)
- [x] Fix clearWallet to always wipe keys via try-finally
- [x] Add SHA-256 integrity check for stored network config
- [x] Add private IP blocking for custom URLs
- [x] Use generic error messages to prevent info leakage
- [x] Add response size limits to health checks
- [x] Add confirmation dialog before copying debug info
- [x] Trigger key wipe on uncaught errors

**Implementation Notes**:
- Comprehensive security review identified 5 Critical, 3 High, 4 Medium, 5 Low severity issues
- All issues addressed with defense-in-depth approach
- Key security features: rate limiting, origin validation, secure key wiping, XSS prevention

## Notes

- Keep Midnight SDK integration minimal initially; may need adjustments based on actual SDK APIs
- Validate against actual dapp-connector-api spec once reviewed
- Consider adding dev tools logging for debugging dApp interactions
