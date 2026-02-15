import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';
import { asciiToBytes, randomBytes } from '@noble/curves/utils.js';

export const SHARE_API_URL =
  'https://near-innovation-sandbox-attest-web.vercel.app';

const HKDF_INFO_PASSPHRASE_ENCRYPTION = asciiToBytes('passphrase_encryption');

/** Derive a 32-byte encryption key from a passphrase */
function deriveKeyFromPassphrase(passphrase: string[]): Uint8Array {
  const passphraseBytes = asciiToBytes(passphrase.join('-'));
  return hkdf(
    sha256,
    passphraseBytes,
    undefined,
    HKDF_INFO_PASSPHRASE_ENCRYPTION,
    32
  );
}

/** Encrypt a string using passphrase-based AES-256-GCM encryption */
export function encryptString(
  plaintext: string,
  passphrase: string[]
): Uint8Array {
  // Derive encryption key from passphrase
  const key = deriveKeyFromPassphrase(passphrase);

  // Generate random IV (12 bytes for AES-GCM)
  const iv = randomBytes(12);

  // Encrypt using AES-256-GCM
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(plaintextBytes);

  // Pack: iv (12 bytes) || ciphertext (variable)
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(ciphertext, iv.length);

  return packed;
}

/** Decrypt a string using passphrase-based AES-256-GCM decryption */
export function decryptString(
  encrypted: Uint8Array,
  passphrase: string[]
): string {
  // Derive encryption key from passphrase
  const key = deriveKeyFromPassphrase(passphrase);

  // Unpack: iv (12 bytes) || ciphertext (variable)
  const iv = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);

  // Decrypt using AES-256-GCM
  const cipher = gcm(key, iv);
  const plaintextBytes = cipher.decrypt(ciphertext);

  // Decode bytes to UTF-8 string
  return new TextDecoder().decode(plaintextBytes);
}

/** upload a binary to the share API */
export async function uploadBinary(
  shareApiUrl: string,
  payload: {
    requestHash: string;
    responseHash: string;
    signature: string;
    binary: Uint8Array;
  },
  options?: {
    fetch?: typeof fetch;
  }
): Promise<{ id: string }> {
  const response = await (options?.fetch ?? fetch)(
    `${shareApiUrl}/api/share/store`,
    {
      method: 'POST',
      body: JSON.stringify({
        requestHash: payload.requestHash,
        responseHash: payload.responseHash,
        signature: payload.signature,
        binary: Buffer.from(payload.binary).toString('base64'),
      }),
    }
  );
  return response.json();
}

/** download a binary from the share API */
export async function downloadBinary(
  shareApiUrl: string,
  id: string,
  options?: {
    fetch?: typeof fetch;
  }
): Promise<Uint8Array> {
  const response = await (options?.fetch ?? fetch)(
    `${shareApiUrl}/api/share/${id}`
  );
  if (!response.ok) {
    throw new Error(`Failed to download binary: ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
