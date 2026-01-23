# Change: Integrate Full Wallet SDK via WalletFacade

## Why

The current wallet implementation uses only `wallet-sdk-hd` for key derivation with placeholder signing operations and stubbed balance queries. This limits functionality to basic key management without real blockchain interaction.

WalletFacade from `@midnight-ntwrk/wallet-sdk-facade` is the official high-level entrypoint that orchestrates all wallet operations - DUST balance queries, shielded/unshielded transactions, address encoding, and proper signing.

## What Changes

- **Replace manual key management** with WalletFacade as the single wallet entrypoint
- **Add proper balance queries** via DustWallet (accessed through facade)
- **Add proper address encoding** using wallet-sdk-address-format with Bech32m
- **Add real transaction signing** through the facade's transaction methods
- **Integrate with network services** (node via PolkadotNodeClient, indexer, prover)
- **BREAKING**: Address format changes from `mn_loc_xxx` to proper Bech32m encoding

## Impact

- Affected code:
  - `src/core/wallet.ts` - Replace with facade-based implementation
  - `src/core/network.ts` - Integrate PolkadotNodeClient for balance/tx
  - `src/background/index.ts` - Manage facade lifecycle
  - `src/popup/` - Update to use facade state
- Dependencies: Add facade, dust-wallet, node-client, indexer-client, prover-client packages
- Bundle size: Will increase significantly due to SDK dependencies
