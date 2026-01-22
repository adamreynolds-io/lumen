# Change: Add Wallet Facade Debug Window

## Why

Developers and QA teams need visibility into the wallet facade's internal state when testing dApps against Lumen. Currently, debugging requires checking browser console logs. A dedicated debug panel would provide real-time insight into:
- Wallet sync progress and state
- Coin/UTXO inventory
- Connection health to indexer and node
- Balance breakdown (total, available, pending)

This aligns with Lumen's purpose as a **QA testing tool** and **reference implementation**.

## What Changes

- Add a new debug panel accessible from the popup UI (toggle button)
- Expose detailed facade state via new service worker message handlers
- Display real-time sync progress, coin list, and connection status
- Provide copy-to-clipboard for debug information (useful for bug reports)

## Impact

- Affected specs: New capability `facade-debug`
- Affected code:
  - `src/popup/popup.html` - Add debug panel container and toggle button
  - `src/popup/popup.ts` - Add debug panel logic and state updates
  - `src/popup/popup.css` - Style the debug panel
  - `src/background/service-worker.ts` - Add debug state handlers
  - `src/core/facade.ts` - Expose additional state inspection methods
