/**
 * Wallet SDK Library
 *
 * Clean abstractions over the Midnight wallet-sdk-facade following
 * the midnight-wallet-cli reference implementation pattern.
 */

export {
  initializeWallet,
  type EnvironmentConfig,
  type WalletSecretKeys,
  type WalletInitResult,
} from './wallet.js';

export {
  executeTransfer,
  type TransferParams,
  type TransferResult,
  type TransferSecretKeys,
} from './transfer.js';

export {
  executeDustRegistration,
  type DustRegistrationParams,
  type DustRegistrationResult,
} from './dustRegistration.js';

export {
  executeDustDeregistration,
  type DustDeregistrationParams,
  type DustDeregistrationResult,
} from './dustDeregistration.js';
