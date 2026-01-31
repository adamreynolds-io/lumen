# Change: Fix Wallet SDK Integration

## Why
The current wallet SDK integration has critical issues discovered by comparing with the official reference implementation (midnight-wallet-cli). Key derivation is missing the Zswap role, wallet initialization methods are incorrect, and transfer functionality is missing.

## What Changes
- **BREAKING**: Update SDK packages from beta to stable 1.0.0
- Fix key derivation to include `Roles.Zswap` for shielded wallet
- Fix wallet initialization to use correct methods (`startWithSecretKeys`, `startWithSecretKey`)
- Add `createKeystore` and `InMemoryTransactionHistoryStorage` for unshielded wallet
- Add proper transfer implementation using facade methods
- Fix NetworkId to use SDK enum instead of strings
- Update cost parameters to match reference implementation

## Impact
- Affected specs: `wallet-sdk-integration`, `wallet-management`
- Affected code: `src/core/wallet.ts`, `src/core/facade.ts`, `src/core/types.ts`, `src/background/service-worker.ts`, `package.json`
