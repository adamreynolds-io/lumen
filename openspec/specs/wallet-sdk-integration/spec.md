# Wallet SDK Integration

## Purpose

Integrate the Midnight Wallet SDK (`@midnight-ntwrk/wallet-sdk-facade`) to provide a unified interface for wallet operations including balance queries, token transfers, and dust management. Uses SDK 1.0.0 stable release with correct key derivation, cost parameters, and network ID handling.
## Requirements
### Requirement: WalletFacade Entrypoint

The wallet SHALL use WalletFacade from `@midnight-ntwrk/wallet-sdk-facade` version 1.0.0 (stable) as the single entrypoint for all wallet operations. Key derivation SHALL include Zswap, NightExternal, and Dust roles.

#### Scenario: Facade initialization from seed with correct key derivation
- **GIVEN** a valid 64-byte seed
- **AND** network configuration (node URL, indexer URL, prover URL)
- **WHEN** the wallet is initialized
- **THEN** three keys are derived: Zswap, NightExternal, and Dust
- **AND** ZswapSecretKeys are created from the Zswap key
- **AND** DustSecretKey is created from the Dust key
- **AND** UnshieldedKeystore is created from the NightExternal key
- **AND** WalletFacade is created with (shieldedWallet, unshieldedWallet, dustWallet) order
- **AND** the facade connects to configured network services

#### Scenario: HD wallet cleared after derivation
- **GIVEN** a valid seed
- **WHEN** keys are derived
- **THEN** HDWallet.clear() is called to wipe sensitive data

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

### Requirement: Token Transfer

The wallet SHALL support transferring shielded and unshielded tokens using the WalletFacade transfer methods.

#### Scenario: Shielded token transfer
- **GIVEN** an initialized wallet with full facade enabled
- **AND** sufficient shielded token balance
- **WHEN** a shielded transfer is requested
- **THEN** transferTransaction() creates a recipe
- **AND** finalizeRecipe() generates proofs
- **AND** submitTransaction() broadcasts to network
- **AND** transaction ID is returned

#### Scenario: Unshielded token transfer
- **GIVEN** an initialized wallet with full facade enabled
- **AND** sufficient unshielded token balance
- **WHEN** an unshielded transfer is requested
- **THEN** transferTransaction() creates a recipe
- **AND** signRecipe() signs with unshielded keystore
- **AND** finalizeRecipe() generates proofs
- **AND** submitTransaction() broadcasts to network
- **AND** transaction ID is returned

### Requirement: NetworkId Enum Usage

The wallet SHALL use the SDK's NetworkId enum type instead of string identifiers.

#### Scenario: Network ID conversion
- **GIVEN** a string network ID (localnet, devnet, qanet, preview, preprod)
- **WHEN** the SDK network ID is needed
- **THEN** the string is converted to NetworkId.NetworkId enum value
- **AND** custom networks use NetworkId.NetworkId.Undeployed

### Requirement: Correct Cost Parameters

The wallet SHALL use the correct cost parameters for transaction fee estimation.

#### Scenario: Fee overhead configuration
- **GIVEN** wallet configuration
- **WHEN** cost parameters are set
- **THEN** additionalFeeOverhead is 300_000_000_000_000_000n
- **AND** feeBlocksMargin is 5

