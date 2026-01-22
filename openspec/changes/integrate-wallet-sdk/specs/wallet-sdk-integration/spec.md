## ADDED Requirements

### Requirement: WalletFacade Entrypoint

The wallet SHALL use WalletFacade from `@midnight-ntwrk/wallet-sdk-facade` as the single entrypoint for all wallet operations.

#### Scenario: Facade initialization from seed
- **GIVEN** a valid 64-byte seed
- **AND** network configuration (node URL, indexer URL, prover URL)
- **WHEN** the wallet is initialized
- **THEN** a WalletFacade instance is created
- **AND** the facade connects to configured network services

#### Scenario: Facade provides DUST wallet access
- **GIVEN** an initialized WalletFacade
- **WHEN** DUST balance is requested
- **THEN** the balance is retrieved via facade.state.dustWallet

### Requirement: DUST Balance Query

The wallet SHALL query DUST token balance using the DustWallet accessed through WalletFacade.

#### Scenario: Query balance on connected network
- **GIVEN** an initialized wallet with facade
- **AND** the network is connected
- **WHEN** balance is queried
- **THEN** the current DUST balance is returned from DustWallet state

#### Scenario: Balance unavailable when disconnected
- **GIVEN** an initialized wallet
- **WHEN** the network is disconnected
- **THEN** balance query returns an error or cached value

### Requirement: Bech32m Address Encoding

The wallet SHALL encode addresses using Bech32m format via `@midnight-ntwrk/wallet-sdk-address-format`.

#### Scenario: Format DUST address
- **GIVEN** a derived DUST public key
- **AND** a network ID
- **WHEN** the address is formatted
- **THEN** a valid Bech32m-encoded address is returned
- **AND** the address includes the appropriate network prefix

### Requirement: Network Service Clients

The wallet SHALL use SDK-provided clients for network communication.

#### Scenario: Node client initialization
- **GIVEN** a node RPC URL
- **WHEN** PolkadotNodeClient is initialized
- **THEN** the client connects to the specified node

#### Scenario: Indexer client initialization
- **GIVEN** an indexer GraphQL URL
- **WHEN** IndexerClient is initialized
- **THEN** the client can query the indexer

### Requirement: Service Worker Lifecycle

The wallet facade SHALL be reconstructed when the Chrome service worker restarts.

#### Scenario: Facade recovery after service worker restart
- **GIVEN** a wallet was previously initialized
- **AND** the seed is persisted in chrome.storage
- **WHEN** the service worker restarts
- **THEN** WalletFacade is reconstructed from the persisted seed
- **AND** the wallet resumes normal operation

## MODIFIED Requirements

### Requirement: Wallet Import

The wallet SHALL import existing wallets from mnemonic, private key, or hex seed and initialize them through WalletFacade.

#### Scenario: Import from mnemonic
- **GIVEN** a valid 24-word BIP39 mnemonic
- **WHEN** the user imports the wallet
- **THEN** a seed is derived from the mnemonic
- **AND** WalletFacade is initialized with the seed

#### Scenario: Import prefunded localnet wallet
- **GIVEN** a prefunded localnet hex seed
- **WHEN** the user imports the wallet
- **THEN** WalletFacade is initialized with the seed
- **AND** the DUST balance reflects the prefunded amount
