import type { Receipt } from './types.js';
import { verifySignature } from './crypto.js';

/** verify model attestation */
export async function verifyModelAttestation(
  receipt: Receipt
): Promise<{ verified: boolean; errors: string[] }> {
  const errors: string[] = [];

  // verify the ECDSA signature
  const signatureText = `${receipt.requestHash}:${receipt.responseHash}`;

  const signatureResult = verifySignature(
    signatureText,
    receipt.signature,
    receipt.signingAddress
  );

  if (!signatureResult.valid) {
    errors.push('signature verification failed');
  }

  const addressMatch =
    signatureResult.recoveredAddress.toLowerCase() ===
    receipt.signingAddress.toLowerCase();

  if (!addressMatch) {
    errors.push('recovered address does not match signing address');
  }

  return {
    verified: errors.length === 0,
    errors: errors,
  };
}
