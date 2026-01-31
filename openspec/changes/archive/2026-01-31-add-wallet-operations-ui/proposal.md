# Change: Add Wallet Operations UI

## Why

The plugin UI is missing key wallet operation features that the reference implementation (midnight-wallet-cli) provides. Users cannot perform transfers, manage dust registration, change settings after wallet import, or view all wallet addresses. This limits the plugin's usefulness for QA testing and as a reference implementation.

## What Changes

### New Features
- **Transfer UI**: Multi-step flow for executing shielded and unshielded token transfers
- **Dust Registration UI**: Register NIGHT UTXOs for dust generation
- **Dust Deregistration UI**: Deregister UTXOs from dust generation
- **Settings Panel**: Change network and URLs after wallet is loaded
- **Full Wallet Address Display**: Show all three wallet addresses (shielded, unshielded, dust) prominently

### UI Structure
- Add a new "Actions" section with buttons for Transfer, Register Dust, Deregister Dust
- Add a Settings button in the header that opens a settings modal/panel
- Enhance the wallet info section to show all three addresses with copy buttons

## Impact

- Affected specs: `popup-ui` (new capability)
- Affected code:
  - `src/popup/popup.html` - Add new UI elements
  - `src/popup/popup.ts` - Add event handlers and flows
  - `src/popup/popup.css` - Add styles for new components
  - `src/background/service-worker.ts` - May need new message handlers for dust registration/deregistration
  - `src/core/facade.ts` - May need dust registration/deregistration methods

## Reference

Based on feature parity analysis with: https://github.com/agronmurtezi/midnight-wallet-cli

### CLI Features to Match
| Feature | CLI | Plugin (Current) | Plugin (Proposed) |
|---------|-----|------------------|-------------------|
| Transfer (shielded) | Yes | Backend only | Full UI |
| Transfer (unshielded) | Yes | Backend only | Full UI |
| Dust Registration | Yes | No | Full UI |
| Dust Deregistration | Yes | No | Full UI |
| Settings (post-import) | Yes | No | Full UI |
| All Wallet Addresses | Yes | Dust only | All 3 |
