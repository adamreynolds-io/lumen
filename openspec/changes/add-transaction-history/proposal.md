# Change: Implement Transaction History Display

## Why

The debug panel has UI scaffolding for transaction history but returns an empty array.
Users need visibility into recent transactions for debugging wallet behavior and verifying
transfers completed successfully.

## What Changes

- Investigate Midnight SDK wallet state structures for transaction data
- Extract transaction history from ShieldedWallet and/or UnshieldedWallet state
- Map SDK transaction data to TransactionInfo interface
- Display transactions in debug panel with type, status, amount, and timestamp
- Support filtering/display by wallet type (shielded vs unshielded)

## Impact

- Affected specs: `facade-debug`
- Affected code: `src/core/facade.ts` (getDebugState), `src/popup/popup.ts` (renderTransactions)

## Notes

The SDK may not expose transaction history directly. This proposal includes research
to determine what transaction data is available from:
- `ShieldedWalletState`
- `UnshieldedWalletState`
- `DustWalletState`
- Indexer GraphQL queries (as fallback)
