# network-config

Custom RPC endpoint configuration for Midnight networks.

## ADDED Requirements

### Requirement: Configure RPC endpoint

The extension SHALL allow users to configure a custom RPC endpoint URL.

#### Scenario: Set custom RPC URL
- **WHEN** user enters a valid RPC URL in settings
- **AND** clicks "Save"
- **THEN** the URL is persisted to chrome.storage
- **AND** subsequent network calls use this URL

#### Scenario: Validate RPC URL format
- **WHEN** user enters an invalid URL
- **THEN** an error is displayed
- **AND** the invalid URL is not saved

---

### Requirement: Persist network configuration

The extension SHALL persist network configuration across browser restarts.

#### Scenario: RPC URL survives restart
- **WHEN** user has configured a custom RPC URL
- **AND** browser is restarted
- **THEN** the RPC URL is restored from chrome.storage
- **AND** the extension uses the saved URL

---

### Requirement: Default RPC endpoint

The extension SHALL provide a sensible default RPC endpoint.

#### Scenario: First launch uses default
- **WHEN** extension is installed fresh
- **AND** no custom RPC is configured
- **THEN** DevNet is selected as the default network

---

### Requirement: Display current network

The extension SHALL display the current network/RPC configuration in the popup.

#### Scenario: Show network in popup
- **WHEN** user opens the popup
- **THEN** the current RPC endpoint is displayed
- **AND** connection status (connected/disconnected) is shown

---

### Requirement: Network connection test

The extension SHALL provide a way to test connectivity to the configured RPC endpoint.

#### Scenario: Test successful connection
- **WHEN** user clicks "Test Connection"
- **AND** the RPC endpoint is reachable
- **THEN** a success message is displayed

#### Scenario: Test failed connection
- **WHEN** user clicks "Test Connection"
- **AND** the RPC endpoint is unreachable
- **THEN** an error message is displayed with details

---

### Requirement: Preset network options

The extension SHALL provide preset options for Midnight networks (no Mainnet).

#### Scenario: Select Localnet preset
- **WHEN** user selects "Localnet" from network dropdown
- **THEN** the Localnet RPC URL is populated (localhost)
- **AND** user can save the selection

#### Scenario: Select DevNet preset
- **WHEN** user selects "DevNet" from network dropdown
- **THEN** the DevNet RPC URL is populated

#### Scenario: Select QANET preset
- **WHEN** user selects "QANET" from network dropdown
- **THEN** the QANET RPC URL is populated

#### Scenario: Select Preview preset
- **WHEN** user selects "Preview" from network dropdown
- **THEN** the Preview RPC URL is populated

#### Scenario: Select PreProd preset
- **WHEN** user selects "PreProd" from network dropdown
- **THEN** the PreProd RPC URL is populated

#### Scenario: Select custom option
- **WHEN** user selects "Custom" from network dropdown
- **THEN** user can enter any RPC URL manually
