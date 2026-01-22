# Tasks: Add Transaction History

## Phase 1: Research SDK Transaction Data

- [ ] 1.1 Investigate ShieldedWalletState for transaction/history properties
- [ ] 1.2 Investigate UnshieldedWalletState for UTXO history/changes
- [ ] 1.3 Investigate DustWalletState for transfer records
- [ ] 1.4 Check if SDK exposes transaction events via observables
- [ ] 1.5 Document available transaction data structures

## Phase 2: Implement Transaction Extraction

- [ ] 2.1 Add transaction extraction from ShieldedWallet state (if available)
- [ ] 2.2 Add transaction extraction from UnshieldedWallet state (if available)
- [ ] 2.3 Map SDK transaction data to TransactionInfo interface
- [ ] 2.4 Update getDebugState() to return populated recentTransactions array
- [ ] 2.5 Limit to last 10 transactions, sorted by timestamp descending

## Phase 3: Fallback - Indexer Query (if SDK doesn't expose history)

- [ ] 3.1 Research indexer GraphQL schema for transaction queries
- [ ] 3.2 Add GraphQL query for wallet transactions by address
- [ ] 3.3 Implement transaction fetching via indexer HTTP endpoint
- [ ] 3.4 Cache transaction data to avoid repeated queries

## Phase 4: UI Enhancement

- [ ] 4.1 Ensure transaction list renders correctly in debug panel
- [ ] 4.2 Add visual indicators for transaction type (transfer, swap, registration)
- [ ] 4.3 Add visual indicators for transaction status (confirmed, pending, failed)
- [ ] 4.4 Display transaction amounts with proper formatting
- [ ] 4.5 Add truncated transaction ID with copy functionality

## Phase 5: Testing

- [ ] 5.1 Test transaction display after shielded transfers
- [ ] 5.2 Test transaction display after unshielded operations
- [ ] 5.3 Verify transaction timestamps display correctly
- [ ] 5.4 Test export includes transaction history
