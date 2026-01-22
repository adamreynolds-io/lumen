# Capability: Facade Debug - Transaction History

## MODIFIED Requirements

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
- **THEN** display recent transactions with type, timestamp, status, and amounts
- **AND** transactions are sorted by timestamp descending
- **AND** maximum 10 most recent transactions are shown

#### Scenario: Show transaction details
- **WHEN** a transaction is displayed in the history
- **THEN** show transaction ID (truncated), type (transfer/swap/registration/unknown), status (confirmed/pending/failed), amount, and token type

## ADDED Requirements

### Requirement: Transaction History Extraction

The facade SHALL extract transaction history from SDK wallet states when available.

#### Scenario: Extract transactions from wallet state
- **WHEN** getDebugState() is called AND full facade is active
- **THEN** extract available transaction data from ShieldedWallet and/or UnshieldedWallet state
- **AND** map to TransactionInfo interface with id, type, timestamp, status, amount, tokenType

#### Scenario: Handle missing transaction data
- **WHEN** SDK wallet state does not expose transaction history
- **THEN** return empty recentTransactions array without errors
- **AND** optionally fall back to indexer query if configured

### Requirement: Transaction Type Classification

The facade SHALL classify transactions by type based on available metadata.

#### Scenario: Classify transfer transactions
- **WHEN** a transaction represents a value transfer between addresses
- **THEN** classify as type "transfer"

#### Scenario: Classify swap transactions
- **WHEN** a transaction represents a token swap operation
- **THEN** classify as type "swap"

#### Scenario: Classify registration transactions
- **WHEN** a transaction represents dust registration
- **THEN** classify as type "registration"

#### Scenario: Handle unknown transaction types
- **WHEN** transaction type cannot be determined
- **THEN** classify as type "unknown"
