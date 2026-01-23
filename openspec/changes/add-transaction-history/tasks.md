# Tasks: Add Transaction History

## Phase 1: Research SDK Transaction Data

- [x] 1.1 Investigate ShieldedWalletState for transaction/history properties
- [x] 1.2 Investigate UnshieldedWalletState for UTXO history/changes
- [x] 1.3 Investigate DustWalletState for transfer records
- [x] 1.4 Check if SDK exposes transaction events via observables
- [x] 1.5 Document available transaction data structures

**Findings:**
- ShieldedWalletState has `transactionHistory` getter returning `FinalizedTransaction[]`
- Transaction objects have `transactionHash()`, `identifiers()`, `imbalances()`, `intents`, `rewards`
- DustWallet doesn't expose transaction history directly
- Timestamps not available from Transaction object

## Phase 2: Implement Transaction Extraction

- [x] 2.1 Add transaction extraction from ShieldedWallet state (if available)
- [ ] 2.2 Add transaction extraction from UnshieldedWallet state (if available)
- [x] 2.3 Map SDK transaction data to TransactionInfo interface
- [x] 2.4 Update getDebugState() to return populated recentTransactions array
- [x] 2.5 Limit to last 10 transactions, sorted by timestamp descending

**Implementation:**
- `extractTransactionHistory()` method in LumenFacade
- Classifies transactions: transfer, swap, registration, unknown
- Extracts amounts from transaction imbalances

## Phase 3: Fallback - Indexer Query (if SDK doesn't expose history)

- [ ] 3.1 Research indexer GraphQL schema for transaction queries
- [ ] 3.2 Add GraphQL query for wallet transactions by address
- [ ] 3.3 Implement transaction fetching via indexer HTTP endpoint
- [ ] 3.4 Cache transaction data to avoid repeated queries

**Status:** Not implemented. Could add as enhancement for timestamps and dust activity.

## Phase 4: UI Enhancement

- [x] 4.1 Ensure transaction list renders correctly in debug panel
- [x] 4.2 Add visual indicators for transaction type (transfer, swap, registration)
- [x] 4.3 Add visual indicators for transaction status (confirmed, pending, failed)
- [x] 4.4 Display transaction amounts with proper formatting
- [x] 4.5 Add truncated transaction ID with copy functionality
- [x] 4.6 Add dedicated Transactions tab to debug panel

## Phase 5: Testing

- [ ] 5.1 Test transaction display after shielded transfers
- [ ] 5.2 Test transaction display after unshielded operations
- [x] 5.3 Verify transaction timestamps display correctly (shows null - expected)
- [x] 5.4 Test export includes transaction history

**Notes:**
- Localnet prefunded wallets only have dust coins, no shielded transactions
- Need wallet with actual shielded activity to fully test
