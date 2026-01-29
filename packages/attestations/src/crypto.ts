import crypto from 'crypto';
import { ethers } from 'ethers';

/**
 * Compute SHA256 hash of a string
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify ECDSA signature matches the expected signing address
 */
export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): { valid: boolean; recoveredAddress: string } {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    const valid =
      recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    return { valid, recoveredAddress };
  } catch (error) {
    return { valid: false, recoveredAddress: '' };
  }
}

/**
 * Compare signature text with computed hashes
 */
export function compareHashes(
  signatureText: string,
  requestHash: string,
  responseHash: string
): boolean {
  const expectedText = `${requestHash}:${responseHash}`;
  return signatureText === expectedText;
}

/**
 * Compute combined proof hash for on-chain storage
 */
export function computeProofHash(
  requestHash: string,
  responseHash: string,
  signature: string
): string {
  return sha256(`${requestHash}:${responseHash}:${signature}`);
}
