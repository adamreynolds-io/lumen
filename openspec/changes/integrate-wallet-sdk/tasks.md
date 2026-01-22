# Tasks: Integrate Full Wallet SDK

## 1. Dependencies and Setup

- [x] 1.1 Add wallet-sdk-dust-wallet for DUST operations (used instead of full facade)
- [x] 1.2 Add wallet-sdk-address-format for Bech32m encoding
- [x] 1.3 Add ledger-v7 for DustSecretKey
- [x] 1.4 Add Node.js polyfills for browser (crypto-browserify, stream-browserify, buffer, assert)
- [x] 1.5 Create WASM plugin for esbuild (inline as base64 for service worker)
- [x] 1.6 Verify build succeeds with new dependencies

## 2. Core Wallet Refactor

- [x] 2.1 Create `src/core/facade.ts` - LumenFacade wrapper for DustWallet
- [x] 2.2 Update address formatting to use wallet-sdk-address-format (DustAddress.encodePublicKey)
- [x] 2.3 Add DustSecretKey to WalletKeys for SDK operations
- [x] 2.4 Implement facade-based balance queries (getBalance with total/available/pending)

## 3. Service Worker Integration

- [x] 3.1 Initialize LumenFacade on wallet load
- [x] 3.2 Handle facade lifecycle (start, stop, reinitialize on network change)
- [x] 3.3 Update refreshBalance handler to use facade.getBalance()
- [x] 3.4 Update clearWallet to stop facade
- [x] 3.5 Update setNetwork to reinitialize facade when network changes

## 4. Testing

- [x] 4.1 Test wallet creation with facade
- [x] 4.2 Test balance query on localnet with prefunded wallet
- [ ] 4.3 Test network switching
- [ ] 4.4 Test service worker restart recovery

## 5. Auto-refresh Balance

- [x] 5.1 Add getBalanceNonBlocking() to facade
- [x] 5.2 Add balance polling interval (1 second)
- [x] 5.3 Broadcast balance updates to popup
- [x] 5.4 Initialize facade automatically on wallet import

## Implementation Notes

- Using DustWallet directly instead of full WalletFacade (simpler for DUST-only operations)
- WASM files are inlined as base64 to work in Chrome extension service workers
- V1Builder pattern used to configure DustWallet with sync, proving, submission services
- Facade wraps Effect-TS operations with Promise-based interface
- Balance query uses `waitForSyncedState().walletBalance(new Date())`
