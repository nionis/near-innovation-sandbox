import type { Attestation, SignatureResponse } from './types.js';
import { type NearAIChatModelId, NEAR_AI_BASE_URL } from '@repo/packages-near';

/** fetch signature from near.ai API */
export async function fetchSignature(
  chatId: string,
  model: NearAIChatModelId,
  apiKey: string
): Promise<SignatureResponse> {
  const url = `${NEAR_AI_BASE_URL}/signature/${chatId}?model=${encodeURIComponent(model)}&signing_algo=ecdsa`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch signature (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

/** fetch model and gateway attestation from NEAR AI Cloud */
export async function fetchAttestation(
  model: NearAIChatModelId,
  requestNonce: string,
  signingAddress?: string
): Promise<Attestation> {
  let url = `${NEAR_AI_BASE_URL}/attestation/report?model=${encodeURIComponent(model)}&signing_algo=ecdsa&nonce=${requestNonce}`;
  if (signingAddress) {
    url += `&signing_address=${encodeURIComponent(signingAddress)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch attestation (${response.status}): ${errorText}`
    );
  }

  return response.json();
}
