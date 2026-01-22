# Tasks: Enhance Debug Panel with Full WalletFacade

## Phase 1: Enhanced Coin Details (DustWallet)

- [x] 1.1 Update CoinInfo interface with detailed fields (ctime, seq, mtIndex, backingNight)
- [x] 1.2 Add DustGenerationInfo interface (dtime, maxCap, generatedNow, rate)
- [x] 1.3 Update getCoins() to return detailed coin data using availableCoinsWithFullInfo()
- [x] 1.4 Fix sync progress to use SDK's ProgressUpdate fields (appliedIndex, highestIndex, highestRelevantIndex)
- [x] 1.5 Update popup UI to display detailed coin info in expandable rows
- [x] 1.6 Test detailed coin display on localnet

## Phase 2: Full WalletFacade Integration ✅

- [x] 2.1 Add @midnight-ntwrk/wallet-sdk-facade dependency (already present)
- [x] 2.2 Add @midnight-ntwrk/wallet-sdk-shielded dependency
- [x] 2.3 Add @midnight-ntwrk/wallet-sdk-unshielded-wallet dependency
- [x] 2.4 Update facade to derive ZswapSecretKeys from shielded key
- [x] 2.5 Refactor facade.ts to create full WalletFacade (ShieldedWallet + UnshieldedWallet + DustWallet)
- [x] 2.6 Update facade configuration to include all required services
- [x] 2.7 Expose FacadeState with shielded, unshielded, and dust state
- [ ] 2.8 Test WalletFacade initialization and sync on localnet (pending manual test)

## Phase 3: Enhanced Debug State Types

- [ ] 3.1 Add ShieldedDebugState interface (balances by token type, coin counts, address, progress)
- [ ] 3.2 Add UnshieldedDebugState interface (balances, UTXOs, registration status)
- [ ] 3.3 Add TransactionInfo interface for transaction history display
- [ ] 3.4 Update DebugState to include shielded, unshielded, and dust sections
- [ ] 3.5 Add getFullDebugState() method returning comprehensive state
- [ ] 3.6 Update service worker handlers for new debug state

## Phase 4: Enhanced Debug UI

- [x] 4.1 Add tabbed sections for Dust / Shielded / Unshielded in debug panel
- [x] 4.2 Add expandable coin rows showing generation details
- [ ] 4.3 Add shielded balances section with token type breakdown
- [ ] 4.4 Add unshielded UTXOs section with registration status
- [ ] 4.5 Add transaction history section (last 10 transactions)
- [x] 4.6 Update sync progress to show all index values
- [x] 4.7 Add "Export Full State" button for complete JSON dump
- [x] 4.8 Style new sections with consistent design

## Phase 5: Testing

- [ ] 5.1 Test full facade initialization on localnet
- [ ] 5.2 Verify shielded wallet sync and balance display
- [ ] 5.3 Verify unshielded wallet UTXO display
- [ ] 5.4 Test transaction history after transfers
- [ ] 5.5 Test network switching with full facade
- [ ] 5.6 Test copy/export functionality with full state
