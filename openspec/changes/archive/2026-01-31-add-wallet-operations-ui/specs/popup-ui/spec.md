## ADDED Requirements

### Requirement: Wallet Address Display
The popup UI SHALL display all three wallet addresses (shielded, unshielded, dust) when a wallet is loaded, each with a copy-to-clipboard button.

#### Scenario: All addresses visible after wallet load
- **WHEN** user loads or imports a wallet
- **THEN** the UI displays the shielded address (zswap1...), unshielded address (night1...), and dust address (dust1...)
- **AND** each address has a copy button

#### Scenario: Copy shielded address
- **WHEN** user clicks the copy button next to the shielded address
- **THEN** the shielded address is copied to clipboard
- **AND** a success confirmation is shown

### Requirement: Token Transfer
The popup UI SHALL provide a multi-step transfer flow for sending tokens to recipient addresses, supporting both shielded and unshielded transfers.

#### Scenario: Initiate shielded transfer
- **WHEN** user clicks Transfer and selects "Shielded"
- **THEN** the UI shows available shielded token balances for selection

#### Scenario: Complete transfer flow
- **WHEN** user selects token type, token ID, enters amount, enters recipient address, and confirms
- **THEN** the transaction is submitted to the network
- **AND** a success message with transaction ID is displayed

#### Scenario: Transfer validation - insufficient balance
- **WHEN** user enters an amount greater than available balance
- **THEN** the UI shows an error and prevents proceeding

#### Scenario: Transfer validation - invalid address
- **WHEN** user enters an invalid recipient address
- **THEN** the UI shows an error and prevents proceeding

#### Scenario: Cancel transfer
- **WHEN** user presses Cancel or Back at any step
- **THEN** the transfer flow is cancelled and user returns to wallet view

### Requirement: Dust Registration
The popup UI SHALL allow users to register NIGHT UTXOs for dust generation.

#### Scenario: View unregistered UTXOs
- **WHEN** user clicks "Register Dust"
- **THEN** the UI displays a list of unregistered NIGHT UTXOs available for registration

#### Scenario: Register selected UTXOs
- **WHEN** user selects one or more UTXOs, optionally edits dust receiver address, and confirms
- **THEN** the registration transaction is submitted
- **AND** a success message with transaction ID is displayed

#### Scenario: No UTXOs available for registration
- **WHEN** user clicks "Register Dust" but has no unregistered NIGHT UTXOs
- **THEN** the UI displays a message indicating no UTXOs are available

### Requirement: Dust Deregistration
The popup UI SHALL allow users to deregister NIGHT UTXOs from dust generation.

#### Scenario: View registered UTXOs
- **WHEN** user clicks "Deregister Dust"
- **THEN** the UI displays a list of registered NIGHT UTXOs that can be deregistered

#### Scenario: Deregister selected UTXOs
- **WHEN** user selects one or more registered UTXOs and confirms
- **THEN** the deregistration transaction is submitted
- **AND** a success message with transaction ID is displayed

#### Scenario: No UTXOs available for deregistration
- **WHEN** user clicks "Deregister Dust" but has no registered NIGHT UTXOs
- **THEN** the UI displays a message indicating no UTXOs are available

### Requirement: Settings Panel
The popup UI SHALL provide a settings panel for changing network configuration after wallet import.

#### Scenario: Open settings
- **WHEN** user clicks the settings button (gear icon)
- **THEN** a settings panel is displayed with current configuration

#### Scenario: Change environment
- **WHEN** user selects a different environment from the dropdown
- **THEN** the indexer, node, and prover URLs are updated to that environment's defaults

#### Scenario: Edit custom URLs
- **WHEN** user edits the indexer URL, node URL, or prover URL fields
- **THEN** the changes are staged for application

#### Scenario: Apply settings
- **WHEN** user clicks "Apply" after making changes
- **THEN** the wallet facade is stopped and restarted with new configuration
- **AND** a confirmation message is shown

#### Scenario: Reset to defaults
- **WHEN** user clicks "Reset to Defaults"
- **THEN** all URLs are reset to the selected environment's default values

#### Scenario: View network ID
- **WHEN** settings panel is open
- **THEN** the current network ID is displayed as read-only information
