import type { KeyPair } from './types.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';
import { asciiToBytes, randomBytes } from '@noble/curves/utils.js';

const HKDF_INFO_E2EE_KEYPAIR = asciiToBytes('e2ee_keypair');

/** generate a key pair from a passphrase */
export function generateKeyPairFromPassphrase(passphrase: string[]): KeyPair {
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
  ourKeyPair: KeyPair,
  modelsPublicKey: Uint8Array,
  plaintext: string
): Uint8Array {
  // Derive shared secret
  const sharedSecret = deriveSharedSecret(
    ourKeyPair.privateKey,
    modelsPublicKey
  );

  // Generate random IV (12 bytes for AES-GCM)
  const iv = randomBytes(12);

  // Encrypt using AES-256-GCM
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const cipher = gcm(sharedSecret, iv);
  const ciphertext = cipher.encrypt(plaintextBytes);

  // Pack: ephemeralPublicKey (65 bytes with 04 prefix) || iv (12 bytes) || ciphertext (variable)
  const packed = new Uint8Array(
    ourKeyPair.publicKey.length + iv.length + ciphertext.length
  );
  packed.set(ourKeyPair.publicKey, 0);
  packed.set(iv, ourKeyPair.publicKey.length);
  packed.set(ciphertext, ourKeyPair.publicKey.length + iv.length);

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
