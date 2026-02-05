import { eip191Signer } from 'micro-eth-signer';
import { sha256_utf8_str } from '@repo/packages-utils/crypto';

/** verify ECDSA signature matches the expected signing address */
export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): { valid: boolean; recoveredAddress: string } {
  try {
    const recoveredAddress = eip191Signer.recoverPublicKey(signature, message);
    const valid =
      recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    return { valid, recoveredAddress };
  } catch (error) {
    console.error('error verifying signature', error);
    return { valid: false, recoveredAddress: '' };
  }
}

/** compare signature text with computed hashes */
export function compareHashes(
  signatureText: string,
  requestHash: string,
  responseHash: string
): boolean {
  const expectedText = `${requestHash}:${responseHash}`;
  return signatureText === expectedText;
}

/** compute combined proof hash for on-chain storage */
export function computeProofHash(
  requestHash: string,
  responseHash: string,
  signature: string
): string {
  return sha256_utf8_str(`${requestHash}:${responseHash}:${signature}`);
}
