# Capability: Facade Debug

Developer-facing debug panel for inspecting wallet facade internal state.

## ADDED Requirements

### Requirement: Debug Panel Toggle

The popup UI SHALL provide a toggle button to show/hide a debug panel.

#### Scenario: Toggle debug panel on
- **WHEN** user clicks the debug toggle button while debug panel is hidden
- **THEN** the debug panel expands and displays current facade state

#### Scenario: Toggle debug panel off
- **WHEN** user clicks the debug toggle button while debug panel is visible
- **THEN** the debug panel collapses and is hidden

### Requirement: Sync Progress Display

The debug panel SHALL display the current synchronization progress of the DustWallet.

#### Scenario: Display sync progress while syncing
- **WHEN** the debug panel is visible AND the wallet is syncing
- **THEN** display a progress indicator showing percentage complete, current block, and target block

#### Scenario: Display sync complete state
- **WHEN** the debug panel is visible AND the wallet sync is complete
- **THEN** display a "Synced" indicator with a checkmark

#### Scenario: Display no wallet state
- **WHEN** the debug panel is visible AND no wallet is loaded
- **THEN** display "No wallet loaded" message

### Requirement: Balance Breakdown Display

The debug panel SHALL display a detailed breakdown of the wallet balance.

#### Scenario: Show balance breakdown
- **WHEN** the debug panel is visible AND a wallet is loaded AND synced
- **THEN** display total balance, available balance, and pending balance as separate labeled values

### Requirement: Coin Inventory Display

The debug panel SHALL display the list of coins (UTXOs) in the wallet.

#### Scenario: Show coin list
- **WHEN** the debug panel is visible AND a wallet is loaded AND has coins
- **THEN** display a scrollable list showing each coin's value and status (spendable/pending)

#### Scenario: Show empty coin list
- **WHEN** the debug panel is visible AND a wallet is loaded AND has no coins
- **THEN** display "No coins" message

### Requirement: Connection Status Display

The debug panel SHALL display the connection status to network services.

#### Scenario: Show connected status
- **WHEN** the debug panel is visible AND indexer WebSocket is connected
- **THEN** display a green indicator with "Connected" label

#### Scenario: Show disconnected status
- **WHEN** the debug panel is visible AND indexer WebSocket is disconnected
- **THEN** display a red indicator with "Disconnected" label

### Requirement: Copy Debug Info

The debug panel SHALL provide a button to copy debug information to clipboard.

#### Scenario: Copy debug info
- **WHEN** user clicks "Copy Debug Info" button
- **THEN** a JSON snapshot of all debug state is copied to clipboard AND a success message is shown

### Requirement: Real-time Updates

The debug panel SHALL update its displayed information in real-time while visible.

#### Scenario: Auto-refresh while visible
- **WHEN** the debug panel is visible
- **THEN** debug information refreshes automatically every 1 second
