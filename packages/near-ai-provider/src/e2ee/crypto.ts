import type { KeyPair } from './types.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';
import { asciiToBytes, randomBytes } from '@noble/curves/utils.js';

/** generate a random key pair */
export function generateKeyPair(): KeyPair {
  const privateKey = randomBytes(32);
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  return { privateKey, publicKey };
}

const HKDF_INFO_NEAR_AI = asciiToBytes('ecdsa_encryption');

/** derive a shared secret */
export function deriveSharedSecret(
  alicePrivateKey: Uint8Array,
  bobPublicKey: Uint8Array
): Uint8Array {
  // Perform ECDH
  const sharedPoint = secp256k1.getSharedSecret(alicePrivateKey, bobPublicKey);

  // Use HKDF to derive a 32-byte key from the shared secret
  // Using SHA-256 as the hash function with 'ecdsa_encryption' info (required by NEAR AI)
  const derivedKey = hkdf(
    sha256,
    sharedPoint.slice(1),
    undefined,
    HKDF_INFO_NEAR_AI,
    32
  );

  return derivedKey;
}

/** encrypt a plaintext string using ECIES to send to a model */
export function encryptForModel(
  modelsPublicKey: Uint8Array,
  plaintext: string
): Uint8Array {
  // Generate ephemeral key pair
  const { privateKey: ephemeralPrivateKey, publicKey: ephemeralPublicKey } =
    generateKeyPair();

  // Derive shared secret
  const sharedSecret = deriveSharedSecret(ephemeralPrivateKey, modelsPublicKey);

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

  return packed;
}

/** decrypt a ciphertext string using ECIES */
export function decryptFromModel(
  ourKeyPair: KeyPair,
  packedCiphertext: Uint8Array
): Uint8Array {
  // Unpack: ephemeralPublicKey (65 bytes with 04 prefix) || iv (12 bytes) || ciphertext (variable)
  const modelsPublicKey = packedCiphertext.slice(0, 65);
  const iv = packedCiphertext.slice(65, 65 + 12);
  const ciphertext = packedCiphertext.slice(65 + 12);

  // Derive shared secret using our private key and the ephemeral public key
  const sharedSecret = deriveSharedSecret(
    ourKeyPair.privateKey,
    modelsPublicKey
  );

  // Decrypt using AES-256-GCM
  const cipher = gcm(sharedSecret, iv);
  const plaintextBytes = cipher.decrypt(ciphertext);

  return plaintextBytes;
}

/** add 0x04 prefix to a public key */
export function toPrefixedPublicKey(publicKey: Uint8Array): Uint8Array {
  return publicKey.length === 64
    ? Uint8Array.from([0x04, ...publicKey])
    : publicKey;
}

/** remove 0x04 prefix from a public key */
export function toUnprefixedPublicKey(publicKey: Uint8Array): Uint8Array {
  return publicKey.length === 65 ? publicKey.slice(1) : publicKey;
}
