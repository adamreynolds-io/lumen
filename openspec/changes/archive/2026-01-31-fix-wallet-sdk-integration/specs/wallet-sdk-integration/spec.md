## MODIFIED Requirements

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

## ADDED Requirements

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
