/**
 * Dust Deregistration - follows midnight-wallet-cli pattern
 *
 * Handles deregistering NIGHT UTXOs from dust generation.
 */

import type { WalletFacade, UtxoWithMeta } from '@midnight-ntwrk/wallet-sdk-facade';
import { PublicKey, type KeyStore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';

// ============================================
// Types
// ============================================

export interface DustDeregistrationParams {
  nightUtxos: UtxoWithMeta[];
}

export type DustDeregistrationResult =
  | { success: true; txId: string }
  | { success: false; error: string };

// ============================================
// Dust Deregistration Execution
// ============================================

/**
 * Execute dust deregistration for Night UTXOs.
 *
 * Follows the midnight-wallet-cli reference implementation exactly.
 *
 * @param facade - The WalletFacade instance
 * @param params - Deregistration parameters (nightUtxos)
 * @param unshieldedKeystore - Keystore for signing
 * @returns Deregistration result with transaction ID or error
 */
export async function executeDustDeregistration(
  facade: WalletFacade,
  params: DustDeregistrationParams,
  unshieldedKeystore: KeyStore
): Promise<DustDeregistrationResult> {
  try {
    if (params.nightUtxos.length === 0) {
      return {
        success: false,
        error: 'At least one Night UTXO is required for deregistration',
      };
    }

    // Step 1: Create dust deregistration recipe
    const recipe = await facade.deregisterFromDustGeneration(
      params.nightUtxos,
      PublicKey.fromKeyStore(unshieldedKeystore),
      (payload) => unshieldedKeystore.signData(payload)
    );

    // Step 2: Finalize (generate proofs)
    const provenTx = await facade.finalizeRecipe(recipe);

    // Step 3: Submit to network
    const txId = await facade.submitTransaction(provenTx);

    return { success: true, txId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during dust deregistration',
    };
  }
}
