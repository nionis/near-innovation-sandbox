import { sha256 } from '@noble/hashes/sha2.js';
import {
  randomBytes,
  bytesToHex,
  hexToBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';

/** generate a random nonce */
export function randomNonce(): string {
  return bytesToHex(randomBytes(32));
}

/** generate a random number between min and max */
export function randomNumber(min: number, max: number): number {
  // EFForg/OpenWireless
  // ref https://github.com/EFForg/OpenWireless/blob/master/app/js/diceware.js
  let rval = 0;
  const range = max - min + 1;
  const bitsNeeded = Math.ceil(Math.log2(range));
  if (bitsNeeded > 53) {
    throw new Error('We cannot generate numbers larger than 53 bits.');
  }

  const bytesNeeded = Math.ceil(bitsNeeded / 8);
  const mask = Math.pow(2, bitsNeeded) - 1;
  // 7776 -> (2^13 = 8192) -1 == 8191 or 0x00001111 11111111

  // Fill a byte array with N random numbers
  const byteArray = new Uint8Array(randomBytes(bytesNeeded));

  let p = (bytesNeeded - 1) * 8;
  for (let i = 0; i < bytesNeeded; i++) {
    rval += byteArray[i]! * Math.pow(2, p);
    p -= 8;
  }

  // Use & to apply the mask and reduce the number of recursive lookups
  rval = rval & mask;

  if (rval >= range) {
    // Integer out of acceptable range
    return randomNumber(min, max);
  }

  // Return an integer that falls within the range
  return min + rval;
}

/** compute SHA256 hash of a UTF-8 string */
export function sha256_utf8_str(data: string): string {
  return bytesToHex(sha256(utf8ToBytes(data)));
}

/** compute SHA256 hash of a hex string */
export function sha256_hex_str(data: string): string {
  return bytesToHex(sha256(hexToBytes(data)));
}
