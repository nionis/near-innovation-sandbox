import { randomBytes, bytesToHex } from '@noble/ciphers/utils.js';

export function generateNonce(): string {
  return bytesToHex(randomBytes(32));
}
