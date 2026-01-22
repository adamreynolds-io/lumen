# Capability: Facade Debug (Enhanced)

Developer-facing debug panel with comprehensive wallet state visibility.

## MODIFIED Requirements

### Requirement: Debug Panel Toggle

The popup UI SHALL provide a toggle button to show/hide a debug panel.

#### Scenario: Toggle debug panel on
- **WHEN** user clicks the debug toggle button while debug panel is hidden
- **THEN** the debug panel expands and displays current facade state

#### Scenario: Toggle debug panel off
- **WHEN** user clicks the debug toggle button while debug panel is visible
- **THEN** the debug panel collapses and is hidden

### Requirement: Sync Progress Display

The debug panel SHALL display comprehensive synchronization progress for all wallet types.

#### Scenario: Display sync progress indices
- **WHEN** the debug panel is visible AND the wallet is syncing
- **THEN** display applied index, highest index, highest relevant index, and percentage complete

#### Scenario: Display combined sync status
- **WHEN** the debug panel is visible AND using full WalletFacade
- **THEN** display overall `isSynced` status combining all wallet types

## ADDED Requirements

### Requirement: Detailed Coin Display

The debug panel SHALL display detailed information for each DUST coin.

#### Scenario: Show coin details
- **WHEN** user expands a coin row in the debug panel
- **THEN** display creation time, sequence number, merkle tree index, and backing NIGHT info

#### Scenario: Show dust generation details
- **WHEN** a coin has dust generation info available
- **THEN** display generation time, max capacity, currently generated amount, and rate

### Requirement: Tabbed Wallet Sections

The debug panel SHALL provide tabbed navigation between wallet types.

#### Scenario: Switch between wallet tabs
- **WHEN** user clicks on Dust, Shielded, or Unshielded tab
- **THEN** the corresponding wallet state section is displayed

#### Scenario: Show appropriate tab content
- **WHEN** Dust tab is selected
- **THEN** display DUST balance, coin list with generation details, and dust-specific sync progress

### Requirement: Shielded Wallet Display

The debug panel SHALL display shielded wallet state when using full WalletFacade.

#### Scenario: Show shielded balances
- **WHEN** Shielded tab is selected AND full facade is active
- **THEN** display balances grouped by token type

#### Scenario: Show shielded coin counts
- **WHEN** Shielded tab is selected AND full facade is active
- **THEN** display total, available, and pending coin counts

#### Scenario: Show transaction history
- **WHEN** Shielded tab is selected AND transactions exist
- **THEN** display recent transactions with type, timestamp, and amounts

### Requirement: Unshielded Wallet Display

The debug panel SHALL display unshielded wallet state when using full WalletFacade.

#### Scenario: Show unshielded UTXOs
- **WHEN** Unshielded tab is selected AND full facade is active
- **THEN** display list of UTXOs with token type, value, and creation time

#### Scenario: Show dust registration status
- **WHEN** an UTXO is displayed
- **THEN** indicate whether it is registered for dust generation

### Requirement: Export Full State

The debug panel SHALL provide comprehensive state export.

#### Scenario: Copy full debug state
- **WHEN** user clicks "Export Full State" button
- **THEN** a complete JSON dump of all wallet state is copied to clipboard

#### Scenario: Include all wallet types in export
- **WHEN** full facade is active AND export is triggered
- **THEN** exported JSON includes dust, shielded, and unshielded state sections
