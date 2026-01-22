# dapp-connector

Implementation of midnight-dapp-connector-api for dApp interoperability.

## ADDED Requirements

### Requirement: Auto-approve dApp connections

The extension SHALL auto-approve all dApp connection requests without user confirmation (developer tool behavior).

#### Scenario: dApp connects without prompt
- **WHEN** a dApp calls window.midnight.enable()
- **AND** a wallet is loaded
- **THEN** the connection is approved automatically
- **AND** no user confirmation dialog is shown

Note: This is appropriate for a developer/QA tool. Production wallets should prompt for user consent.

---

### Requirement: Standardized error codes

The extension SHALL return standardized error codes for all rejection cases.

#### Scenario: Error codes are predictable
- **WHEN** any dApp connector method fails
- **THEN** the rejection includes an `errorCode` property
- **AND** the error code is one of: `NO_WALLET`, `SESSION_EXPIRED`, `NETWORK_ERROR`, `INVALID_TX`, `USER_REJECTED`, `UNKNOWN_ERROR`

#### Scenario: Error includes descriptive message
- **WHEN** any dApp connector method fails
- **THEN** the rejection includes a human-readable `message` property

---

### Requirement: Expose window.midnight API

The extension SHALL inject a `window.midnight` object into web pages that implements the dApp connector interface.

#### Scenario: API available on page load
- **WHEN** a web page loads with the extension installed
- **THEN** window.midnight is defined
- **AND** window.midnight.isLumen returns true

#### Scenario: API not available without extension
- **WHEN** a web page loads without the extension
- **THEN** window.midnight is undefined

---

### Requirement: Enable wallet connection

The extension SHALL implement `window.midnight.enable()` to establish a connection between dApp and wallet.

#### Scenario: Enable with wallet loaded
- **WHEN** a wallet is loaded
- **AND** dApp calls window.midnight.enable()
- **THEN** the call resolves with { enabled: true, address: "<wallet-address>" }

#### Scenario: Enable without wallet loaded
- **WHEN** no wallet is loaded
- **AND** dApp calls window.midnight.enable()
- **THEN** the call rejects with an error indicating no wallet available

---

### Requirement: Check connection state

The extension SHALL implement `window.midnight.isEnabled()` to check current connection state.

#### Scenario: Check when connected
- **WHEN** wallet is connected to the dApp
- **AND** dApp calls window.midnight.isEnabled()
- **THEN** the call resolves with true

#### Scenario: Check when not connected
- **WHEN** wallet is not connected
- **AND** dApp calls window.midnight.isEnabled()
- **THEN** the call resolves with false

---

### Requirement: Get wallet address

The extension SHALL implement `window.midnight.getAddress()` to retrieve the connected wallet address.

#### Scenario: Get address when connected
- **WHEN** wallet is connected
- **AND** dApp calls window.midnight.getAddress()
- **THEN** the call resolves with the wallet address string

#### Scenario: Get address when not connected
- **WHEN** wallet is not connected
- **AND** dApp calls window.midnight.getAddress()
- **THEN** the call rejects with an error

---

### Requirement: Get DUST balance

The extension SHALL implement `window.midnight.getBalance()` to query the wallet's DUST balance.

#### Scenario: Get balance when connected
- **WHEN** wallet is connected
- **AND** dApp calls window.midnight.getBalance()
- **THEN** the call resolves with the DUST balance as a string (to handle large numbers)

#### Scenario: Get balance with network error
- **WHEN** wallet is connected but network is unreachable
- **AND** dApp calls window.midnight.getBalance()
- **THEN** the call rejects with a network error

---

### Requirement: Sign transaction

The extension SHALL implement `window.midnight.signTransaction(tx)` to sign transactions.

#### Scenario: Sign valid transaction
- **WHEN** wallet is connected
- **AND** dApp calls window.midnight.signTransaction(unsignedTx)
- **THEN** the transaction is signed with the wallet's private key
- **AND** the signed transaction is returned

#### Scenario: Sign without wallet
- **WHEN** no wallet is connected
- **AND** dApp calls window.midnight.signTransaction(tx)
- **THEN** the call rejects with an error

---

### Requirement: Sign arbitrary message

The extension SHALL implement `window.midnight.signMessage(message)` for signing arbitrary data.

#### Scenario: Sign message when connected
- **WHEN** wallet is connected
- **AND** dApp calls window.midnight.signMessage("Hello")
- **THEN** the message is signed
- **AND** the signature is returned

---

### Requirement: Get network info

The extension SHALL implement `window.midnight.getNetwork()` to return current network configuration.

#### Scenario: Get network info
- **WHEN** dApp calls window.midnight.getNetwork()
- **THEN** the call resolves with { rpcUrl: "<configured-url>", networkId: "<id>" }

---

### Requirement: Disconnect wallet

The extension SHALL implement `window.midnight.disable()` to disconnect from the current dApp.

#### Scenario: Disconnect active connection
- **WHEN** wallet is connected
- **AND** dApp calls window.midnight.disable()
- **THEN** the connection is terminated
- **AND** window.midnight.isEnabled() returns false
