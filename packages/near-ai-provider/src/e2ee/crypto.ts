import { secp256k1 } from '@noble/curves/secp256k1.js';
import {
  asciiToBytes,
  hexToBytes,
  randomBytes,
  bytesToHex,
} from '@noble/curves/utils.js';
import { randomNumber } from '@repo/packages-utils/crypto';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { EEFLongWordList } from './words.js';
import type { KeyPair } from './types.js';
import { gcm } from '@noble/ciphers/aes.js';

/* generate a passphrase that includes random numbers */
export function generatePassphrase(numWords: number): string[] {
  const words = new Array(numWords);

  for (let i = 0; i < numWords; i++) {
    const wordIndex = randomNumber(0, EEFLongWordList.length - 1);
    let word = EEFLongWordList[wordIndex];
    word += randomNumber(0, 9).toString();
    words.push(word);
  }

  return words;
}

/** generate a key pair from a passphrase */
export function generateKeyPair(passphrase: string[]): KeyPair {
  const seed = asciiToBytes(passphrase.join('-'));
  const { secretKey: privateKey, publicKey } = secp256k1.keygen(seed);
  return { privateKey, publicKey };
}

const HKDF_INFO = asciiToBytes('ecdsa_encryption');

export function deriveSharedSecret(keyPair: KeyPair): Uint8Array {
  const { privateKey, publicKey } = keyPair;

  // Perform ECDH
  const sharedPoint = secp256k1.getSharedSecret(privateKey, publicKey);

  // Use HKDF to derive a 32-byte key from the shared secret
  // Using SHA-256 as the hash function with 'ecdsa_encryption' info (required by NEAR AI)
  const derivedKey = hkdf(
    sha256,
    sharedPoint.slice(1),
    undefined,
    HKDF_INFO,
    32
  );

  return derivedKey;
}

/**
 * Encrypt plaintext using ECIES
 *
 * @param plaintext - The plaintext string to encrypt
 * @param recipientPublicKey - Recipient's public key (hex, 64 bytes without 04 prefix OR 65 bytes with prefix)
 * @returns Hex-encoded ciphertext
 */
export function eciesEncrypt(
  plaintext: string,
  recipientPublicKey: string
): string {
  // Generate ephemeral key pair for this encryption
  const { secretKey: ephemeralPrivateKey, publicKey: ephemeralPublicKey } =
    secp256k1.keygen();

  // Handle recipient public key - add 04 prefix if not present
  let recipientPubKeyHex = recipientPublicKey;
  if (recipientPublicKey.length === 128) {
    // 64 bytes = 128 hex chars, need to add 04 prefix
    recipientPubKeyHex = '04' + recipientPublicKey;
  }
  const recipientPubKeyBytes = hexToBytes(recipientPubKeyHex);

  // Derive shared secret
  const sharedSecret = deriveSharedSecret({
    privateKey: ephemeralPrivateKey,
    publicKey: recipientPubKeyBytes,
  });

  // Generate random IV (12 bytes for AES-GCM)
  const iv = randomBytes(12);

  // Encrypt using AES-256-GCM
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const cipher = gcm(sharedSecret, iv);
  const ciphertext = cipher.encrypt(plaintextBytes);

  // Pack: ephemeralPublicKey (65 bytes with 04 prefix) || iv (12 bytes) || ciphertext (variable)
  const packed = new Uint8Array(
    ephemeralPublicKey.length + iv.length + ciphertext.length
  );
  packed.set(ephemeralPublicKey, 0);
  packed.set(iv, ephemeralPublicKey.length);
  packed.set(ciphertext, ephemeralPublicKey.length + iv.length);

  return bytesToHex(packed);
}

/**
 * Decrypt ECIES ciphertext
 *
 * @param ciphertextHex - Hex-encoded ciphertext from eciesEncrypt
 * @param privateKey - Recipient's private key (hex, 32 bytes = 64 hex chars)
 * @returns Decrypted plaintext string
 */
export function eciesDecrypt(
  ciphertextHex: string,
  privateKey: string
): string {
  const packed = hexToBytes(ciphertextHex);

  // Unpack: ephemeralPublicKey (65 bytes with 04 prefix) || iv (12 bytes) || ciphertext (variable)
  const ephemeralPublicKey = packed.slice(0, 65);
  const iv = packed.slice(65, 65 + 12);
  const ciphertext = packed.slice(65 + 12);

  // Derive shared secret using our private key and the ephemeral public key
  const privateKeyBytes = hexToBytes(privateKey);
  const sharedSecret = deriveSharedSecret({
    privateKey: privateKeyBytes,
    publicKey: ephemeralPublicKey,
  });

  // Decrypt using AES-256-GCM
  const cipher = gcm(sharedSecret, iv);
  const plaintextBytes = cipher.decrypt(ciphertext);

  return new TextDecoder().decode(plaintextBytes);
}
