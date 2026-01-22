# Tasks: Add Wallet Facade Debug Window

## 1. Facade State Exposure

- [x] 1.1 Add `getDebugState()` method to LumenFacade returning sync progress, coin count, connection status
- [x] 1.2 Add `getCoins()` method to retrieve list of spendable coins with details (value, status)
- [x] 1.3 Add `getConnectionStatus()` to check indexer WebSocket and node RPC health

## 2. Service Worker Handlers

- [x] 2.1 Add `getDebugState` handler that calls facade.getDebugState()
- [x] 2.2 Add `getCoins` handler for coin inventory
- [x] 2.3 Add `getConnectionStatus` handler for connection health
- [x] 2.4 Include debug state in balance polling broadcasts (optional, for real-time updates)

## 3. Popup UI - Debug Panel

- [x] 3.1 Add debug toggle button to popup header (icon-based, subtle)
- [x] 3.2 Create collapsible debug panel section in popup.html
- [x] 3.3 Display sync progress (percentage, block height, state)
- [x] 3.4 Display balance breakdown (total, available, pending with labels)
- [x] 3.5 Display coin list (scrollable, shows value and status per coin)
- [x] 3.6 Display connection status (indexer WS, node RPC - green/red indicators)
- [x] 3.7 Add "Copy Debug Info" button that copies JSON snapshot to clipboard

## 4. Styling

- [x] 4.1 Style debug panel with monospace font for technical data
- [x] 4.2 Add visual indicators for sync state (syncing spinner, synced checkmark)
- [x] 4.3 Color-code connection status (green=connected, red=disconnected, yellow=connecting)
- [x] 4.4 Make debug panel scrollable if content exceeds height

## 5. Testing

- [x] 5.1 Test debug panel toggle on/off
- [x] 5.2 Verify sync progress updates in real-time
- [x] 5.3 Verify coin list populates after sync (simplified - shows count only)
- [x] 5.4 Test copy debug info functionality
- [x] 5.5 Test with no wallet loaded (should show appropriate message)
