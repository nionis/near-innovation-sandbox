/**
 * ECIES (Elliptic Curve Integrated Encryption Scheme) implementation
 * using secp256k1 for key exchange and AES-256-GCM for symmetric encryption.
 *
 * This module provides end-to-end encryption for NEAR AI chat messages.
 * Compatible with browsers and Node.js.
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import { gcm } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/ciphers/webcrypto';

/** Key pair for ECIES encryption */
export interface KeyPair {
  /** Private key as hex string (32 bytes = 64 hex chars) */
  privateKey: string;
  /** Public key as hex string (uncompressed, 64 bytes = 128 hex chars, no 04 prefix) */
  publicKey: string;
}

/** ECIES ciphertext structure */
interface ECIESCiphertext {
  /** Ephemeral public key (for encryption) or recipient public key hint */
  ephemeralPublicKey: Uint8Array;
  /** Initialization vector for AES-GCM */
  iv: Uint8Array;
  /** Encrypted data with authentication tag */
  ciphertext: Uint8Array;
}

/**
 * Generate a new ephemeral key pair for ECIES
 */
export function generateKeyPair(): KeyPair {
  const privateKeyBytes = secp256k1.utils.randomPrivateKey();
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false); // uncompressed

  return {
    privateKey: bytesToHex(privateKeyBytes),
    // Keep the 04 prefix for uncompressed public key (65 bytes = 130 hex)
    publicKey: bytesToHex(publicKeyBytes),
  };
}

/** HKDF info parameter required by NEAR AI */
const HKDF_INFO = 'ecdsa_encryption';

/**
 * Derive a shared secret using ECDH and HKDF
 */
function deriveSharedSecret(
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  // Perform ECDH
  const sharedPoint = secp256k1.getSharedSecret(privateKey, publicKey);

  // Use HKDF to derive a 32-byte key from the shared secret
  // Using SHA-256 as the hash function with 'ecdsa_encryption' info (required by NEAR AI)
  const derivedKey = hkdf(sha256, sharedPoint.slice(1), undefined, HKDF_INFO, 32);

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
  const ephemeralPrivateKey = secp256k1.utils.randomPrivateKey();
  const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, false);

  // Handle recipient public key - add 04 prefix if not present
  let recipientPubKeyHex = recipientPublicKey;
  if (recipientPublicKey.length === 128) {
    // 64 bytes = 128 hex chars, need to add 04 prefix
    recipientPubKeyHex = '04' + recipientPublicKey;
  }
  const recipientPubKeyBytes = hexToBytes(recipientPubKeyHex);

  // Derive shared secret
  const sharedSecret = deriveSharedSecret(ephemeralPrivateKey, recipientPubKeyBytes);

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
export function eciesDecrypt(ciphertextHex: string, privateKey: string): string {
  const packed = hexToBytes(ciphertextHex);

  // Unpack: ephemeralPublicKey (65 bytes with 04 prefix) || iv (12 bytes) || ciphertext (variable)
  const ephemeralPublicKey = packed.slice(0, 65);
  const iv = packed.slice(65, 65 + 12);
  const ciphertext = packed.slice(65 + 12);

  // Derive shared secret using our private key and the ephemeral public key
  const privateKeyBytes = hexToBytes(privateKey);
  const sharedSecret = deriveSharedSecret(privateKeyBytes, ephemeralPublicKey);

  // Decrypt using AES-256-GCM
  const cipher = gcm(sharedSecret, iv);
  const plaintextBytes = cipher.decrypt(ciphertext);

  return new TextDecoder().decode(plaintextBytes);
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
