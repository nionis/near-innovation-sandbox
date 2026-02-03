/**
 * Model public key fetching and caching for E2EE
 *
 * Fetches model public keys from the NEAR AI attestation endpoint
 * and caches them to avoid repeated network requests.
 */

import { NEAR_AI_BASE_URL } from '@repo/packages-near';

/** Information about a model's public key */
export interface ModelKeyInfo {
  /** Public key in hex format (64 bytes without 04 prefix) */
  publicKey: string;
  /** Signing address derived from the public key */
  signingAddress: string;
  /** Timestamp when the key was fetched */
  fetchedAt: number;
}

/** Attestation response from NEAR AI Cloud */
interface AttestationResponse {
  gateway_attestation: {
    signing_address: string;
    signing_algo: string;
  };
  model_attestations: Array<{
    signing_address: string;
    signing_algo: string;
    signing_public_key: string;
  }>;
}

/** Cache for model public keys */
const modelKeyCache = new Map<string, ModelKeyInfo>();

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Generate a random nonce for attestation requests
 */
function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Fetch model public key directly from the attestation endpoint
 *
 * @param model - Model ID (e.g., 'deepseek-ai/DeepSeek-V3.1')
 * @param signingAlgo - Signing algorithm (currently only 'ecdsa' supported)
 * @returns Model key information
 */
export async function fetchModelPublicKey(
  model: string,
  signingAlgo: 'ecdsa' = 'ecdsa'
): Promise<ModelKeyInfo> {
  const nonce = generateNonce();

  // We need a signing address to fetch attestation, but for initial key fetch
  // we just need any valid attestation to get the model's public key
  const url = new URL(`${NEAR_AI_BASE_URL}/attestation/report`);
  url.searchParams.set('model', model);
  url.searchParams.set('signing_algo', signingAlgo);
  url.searchParams.set('nonce', nonce);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch model attestation (${response.status}): ${errorText}`
    );
  }

  const attestation: AttestationResponse = await response.json();

  // Get the first model attestation (they should all have the same public key for the same model)
  const modelAttestation = attestation.model_attestations[0];

  if (!modelAttestation) {
    throw new Error(`No model attestation found for model: ${model}`);
  }

  if (!modelAttestation.signing_public_key) {
    throw new Error(`Model attestation missing signing_public_key for model: ${model}`);
  }

  return {
    publicKey: modelAttestation.signing_public_key,
    signingAddress: modelAttestation.signing_address,
    fetchedAt: Date.now(),
  };
}

/**
 * Get model public key with caching
 *
 * Returns cached key if available and not expired, otherwise fetches fresh.
 *
 * @param model - Model ID
 * @returns Model key information
 */
export async function getModelPublicKey(model: string): Promise<ModelKeyInfo> {
  const cached = modelKeyCache.get(model);

  // Check if cache is valid
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }

  // Fetch fresh key
  const keyInfo = await fetchModelPublicKey(model);

  // Update cache
  modelKeyCache.set(model, keyInfo);

  return keyInfo;
}

/**
 * Clear the model key cache
 * Useful for testing or when keys need to be refreshed
 */
export function clearModelKeyCache(): void {
  modelKeyCache.clear();
}

/**
 * Remove a specific model from the cache
 */
export function invalidateModelKey(model: string): void {
  modelKeyCache.delete(model);
}
