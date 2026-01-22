# wallet-management

Wallet generation, import, and session storage.

## ADDED Requirements

### Requirement: Generate new wallet

The extension SHALL allow users to generate a new Midnight wallet with a fresh seed phrase.

#### Scenario: Generate wallet from popup
- **WHEN** user clicks "Generate New Wallet" in popup
- **THEN** a new 24-word seed phrase is generated (BIP39)
- **AND** the wallet address is derived and displayed
- **AND** the seed phrase is shown once for user backup
- **AND** keys are held in service worker memory

#### Scenario: Generated wallet is usable
- **WHEN** a wallet has been generated
- **THEN** the wallet can sign transactions
- **AND** dApps can query the wallet address

---

### Requirement: Import wallet from seed phrase

The extension SHALL allow users to import an existing wallet using a seed phrase.

#### Scenario: Import valid seed phrase
- **WHEN** user enters a valid BIP39 seed phrase (12 or 24 words)
- **AND** clicks "Import"
- **THEN** the wallet is derived from the seed
- **AND** the wallet address is displayed
- **AND** keys are held in service worker memory

#### Scenario: Reject invalid seed phrase
- **WHEN** user enters an invalid seed phrase
- **AND** clicks "Import"
- **THEN** an error message is displayed
- **AND** no wallet is loaded

---

### Requirement: Import wallet from private key

The extension SHALL allow users to import a wallet using a raw private key (hex format).

#### Scenario: Import valid private key
- **WHEN** user enters a valid hex private key
- **AND** clicks "Import"
- **THEN** the wallet is loaded with that key
- **AND** the wallet address is displayed

#### Scenario: Reject invalid private key
- **WHEN** user enters an invalid private key
- **THEN** an error message is displayed
- **AND** no wallet is loaded

---

### Requirement: Session-based key storage

The extension SHALL store wallet keys only in service worker memory, never persisted to disk.

#### Scenario: Keys cleared on extension restart
- **WHEN** the extension is restarted or updated
- **THEN** wallet state is cleared
- **AND** user must re-import their wallet

#### Scenario: Keys not written to storage
- **WHEN** a wallet is loaded
- **THEN** private keys are never written to chrome.storage
- **AND** private keys are never written to localStorage

---

### Requirement: Display wallet address

The extension SHALL display the current wallet address in the popup when a wallet is loaded.

#### Scenario: Show address when wallet loaded
- **WHEN** a wallet is loaded
- **AND** user opens the popup
- **THEN** the wallet address is displayed
- **AND** address can be copied to clipboard

#### Scenario: Show no-wallet state
- **WHEN** no wallet is loaded
- **AND** user opens the popup
- **THEN** a message indicates no wallet is loaded
- **AND** options to generate or import are shown
