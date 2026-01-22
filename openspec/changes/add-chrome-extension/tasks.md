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

## Phase 1: Project Setup

- [ ] Initialize npm project with TypeScript
- [ ] Configure tsconfig.json (strict mode, ES2020)
- [ ] Install @midnight-ntwrk/dapp-connector-api from npm
- [ ] Install wallet-sdk packages (stable): address-format, capabilities, hd
- [ ] Install wallet-sdk packages (pre-release): facade, dust-wallet, node-client, utilities
- [ ] Review npm package types to understand exact API shapes
- [ ] Set up esbuild for bundling (background, content, popup, inject)
- [ ] Create manifest.json (Manifest V3)
- [ ] Add npm scripts: build, dev (watch mode)
- [ ] Create directory structure (src/background, src/content, src/popup, src/inject, src/core)
- [ ] Verify extension loads in Chrome with empty scripts

## Phase 2: Core Infrastructure

- [ ] Implement message passing utilities (src/lib/messaging.ts)
- [ ] Define shared types (src/core/types.ts)
- [ ] Create service worker skeleton (src/background/service-worker.ts)
- [ ] Create content script skeleton (src/content/content.ts)
- [ ] Create injected script skeleton (src/inject/inject.ts)
- [ ] Verify message flow: inject → content → service worker → response

## Phase 3: Wallet Core

- [ ] Implement wallet generation (BIP39 seed phrase)
- [ ] Implement wallet import from seed phrase
- [ ] Implement wallet import from private key (hex)
- [ ] Implement address derivation
- [ ] Implement transaction signing
- [ ] Implement message signing
- [ ] Unit tests for wallet operations

## Phase 4: Network Layer

- [ ] Implement RPC client (src/core/network.ts)
- [ ] Implement balance query
- [ ] Implement network configuration storage (chrome.storage)
- [ ] Add preset network URLs (Localnet, DevNet, QANET, Preview, PreProd)
- [ ] Implement connection test
- [ ] Verify RPC calls work from service worker

## Phase 5: dApp Connector API

- [ ] Implement window.midnight object injection
- [ ] Implement enable() / disable()
- [ ] Implement isEnabled()
- [ ] Implement getAddress()
- [ ] Implement getBalance()
- [ ] Implement signTransaction()
- [ ] Implement signMessage()
- [ ] Implement getNetwork()
- [ ] Integration test with mock dApp page

## Phase 6: Popup UI

- [ ] Create popup.html structure
- [ ] Create popup.css styles (minimal, developer-focused)
- [ ] Implement "No Wallet" state view
- [ ] Implement "Generate Wallet" flow with seed phrase display
- [ ] Implement "Import Wallet" flow (seed phrase input)
- [ ] Implement "Import Private Key" flow
- [ ] Display wallet address with copy button
- [ ] Display DUST balance
- [ ] Implement network selector (presets + custom)
- [ ] Implement connection test button
- [ ] Show dApp connection status

## Phase 7: Integration & Polish

- [ ] End-to-end test: generate wallet → connect dApp → sign transaction
- [ ] Test with dapp-connector-api example if available
- [ ] Handle edge cases (network errors, invalid inputs)
- [ ] Add loading states and error messages
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

## Notes

- Keep Midnight SDK integration minimal initially; may need adjustments based on actual SDK APIs
- Validate against actual dapp-connector-api spec once reviewed
- Consider adding dev tools logging for debugging dApp interactions
