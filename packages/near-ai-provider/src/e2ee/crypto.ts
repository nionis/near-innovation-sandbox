import type { KeyPair } from './types.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';
import { asciiToBytes, randomBytes } from '@noble/curves/utils.js';

const HKDF_INFO_E2EE_KEYPAIR = asciiToBytes('e2ee_keypair');

/** generate a key pair from a passphrase */
export function generateKeyPair(passphrase: string[]): KeyPair {
  const passphraseBytes = asciiToBytes(passphrase.join('-'));
  const privateKey = hkdf(
    sha256,
    passphraseBytes,
    undefined,
    HKDF_INFO_E2EE_KEYPAIR,
    32
  );
  const publicKey = secp256k1.getPublicKey(privateKey, false);

  return { privateKey, publicKey };
}

const HKDF_INFO_NEAR_AI = asciiToBytes('ecdsa_encryption');

/** derive a shared secret from a key pair */
export function deriveSharedSecret(
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  // Perform ECDH
  const sharedPoint = secp256k1.getSharedSecret(secretKey, publicKey);

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

/** encrypt a plaintext string using ECIES */
export function eciesEncrypt(
  recipientPublicKey: Uint8Array,
  plaintext: string
): Uint8Array {
  // Generate ephemeral key pair for this encryption
  const { secretKey: ephemeralPrivateKey, publicKey: ephemeralPublicKey } =
    secp256k1.keygen();

  // Derive shared secret
  const sharedSecret = deriveSharedSecret(
    ephemeralPrivateKey,
    recipientPublicKey
  );

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
export function eciesDecrypt(
  secretKey: Uint8Array,
  packedCiphertext: Uint8Array
): Uint8Array {
  // Unpack: ephemeralPublicKey (65 bytes with 04 prefix) || iv (12 bytes) || ciphertext (variable)
  const ephemeralPublicKey = packedCiphertext.slice(0, 65);
  const iv = packedCiphertext.slice(65, 65 + 12);
  const ciphertext = packedCiphertext.slice(65 + 12);

  // Derive shared secret using our private key and the ephemeral public key
  const sharedSecret = deriveSharedSecret(secretKey, ephemeralPublicKey);

  // Decrypt using AES-256-GCM
  const cipher = gcm(sharedSecret, iv);
  const plaintextBytes = cipher.decrypt(ciphertext);

  return plaintextBytes;
}
