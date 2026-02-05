import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { eip191Signer } from 'micro-eth-signer';
import {
  randomBytes,
  bytesToHex,
  hexToBytes,
  utf8ToBytes,
} from '@noble/hashes/utils.js';

/** generate a random nonce */
export function randomNonce(): string {
  return bytesToHex(randomBytes(32));
}

/** compute SHA256 hash of a UTF-8 string */
export function sha256_utf8_str(data: string): string {
  return bytesToHex(sha256(utf8ToBytes(data)));
}

/** compute SHA256 hash of a hex string */
export function sha256_hex_str(data: string): string {
  return bytesToHex(sha256(hexToBytes(data)));
}

/** convert a NEAR account ID to an Ethereum-like address */
export function nearAccountIdToAddress(accountId: string): string {
  const hash = keccak_256(hexToBytes(accountId));
  // take last 20 bytes (40 hex chars) and return as checksummed address
  return '0x' + bytesToHex(hash.slice(-40));
}

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
