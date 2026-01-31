## 1. Package Updates
- [x] 1.1 Update package.json to use stable SDK 1.0.0
- [x] 1.2 Remove individual beta packages, use transitive dependencies from facade
- [x] 1.3 Run npm install and verify build works

## 2. Type System Updates
- [x] 2.1 Add NetworkId enum mapping in types.ts
- [x] 2.2 Add toSdkNetworkId() helper function
- [x] 2.3 Update network config constants

## 3. Key Derivation Fixes
- [x] 3.1 Update WalletKeys interface to include zswapKey and zswapSecretKeys
- [x] 3.2 Update deriveKeys() to use selectRoles([Zswap, NightExternal, Dust])
- [x] 3.3 Add hdWallet.clear() after derivation for security
- [x] 3.4 Update createWallet and importFromMnemonic functions

## 4. Facade Initialization Fixes
- [x] 4.1 Add createKeystore and InMemoryTransactionHistoryStorage imports
- [x] 4.2 Add unshieldedKeystore field to LumenFacade
- [x] 4.3 Rewrite start() to use correct initialization methods
- [x] 4.4 Fix cost parameters to match reference
- [x] 4.5 Fix wallet construction order (shielded, unshielded, dust)

## 5. Transfer Implementation
- [x] 5.1 Add TransferParams and TransferResult types
- [x] 5.2 Implement transfer() method using facade.transferTransaction
- [x] 5.3 Add signing for unshielded transfers
- [x] 5.4 Add finalization and submission

## 6. Service Worker Updates
- [x] 6.1 Update initializeFacade() to pass correct keys structure
- [x] 6.2 Update securelyWipeKeys() to wipe zswapKey
- [x] 6.3 Add transfer message handler

## 7. Cleanup
- [x] 7.1 Remove or update placeholder signing functions
- [x] 7.2 Update tests for new key structure
- [x] 7.3 Test against preprod network (manual verification required)
