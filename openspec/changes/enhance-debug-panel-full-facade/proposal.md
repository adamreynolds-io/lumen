# Change: Enhance Debug Panel with Full WalletFacade

## Why

The current debug panel uses a simplified DustWallet-only approach that:
- Shows limited coin information (just value and status)
- Cannot display shielded or unshielded wallet state
- Missing detailed sync progress indices
- No transaction history visibility

Upgrading to the full WalletFacade from `@midnight-ntwrk/wallet-sdk-facade` will provide comprehensive visibility into all wallet state for QA and debugging purposes.

## What Changes

### Phase 1: Enhanced Coin Details (DustWallet)
- Add detailed coin properties: creation time, sequence number, merkle tree index, backing NIGHT info
- Add dust generation details: generation time, max capacity, current generated amount, rate
- Fix sync progress to use actual SDK indices (appliedIndex, highestIndex, etc.)

### Phase 2: Full WalletFacade Integration
- Replace DustWallet-only facade with full WalletFacade
- Add ShieldedWallet for shielded balances and transaction history
- Add UnshieldedWallet for UTXO management
- Expose combined FacadeState with `isSynced` property

### Phase 3: Enhanced Debug UI
- Show detailed coin information in expandable rows
- Add shielded/unshielded balance sections
- Show transaction history (recent transactions)
- Add sync progress with all index values
- Show token type balances (not just DUST)

## Impact

- Affected specs: `facade-debug` (MODIFIED)
- Affected code:
  - `src/core/facade.ts` - Major refactor to use WalletFacade
  - `src/core/wallet.ts` - Add ZswapSecretKeys derivation
  - `src/background/service-worker.ts` - Update handlers for new state
  - `src/popup/popup.html` - Enhanced debug panel sections
  - `src/popup/popup.ts` - New debug display logic
  - `src/popup/popup.css` - Styles for expanded debug panel
  - `package.json` - Add wallet-sdk-facade dependency
