import type {
  Attestation,
  SignatureResponse,
  VerificationResult,
} from './types.js';
import {
  type NearAIChatModelId,
  NEAR_AI_BASE_URL,
} from '@repo/packages-utils/near';

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
  signingAddress: string
): Promise<Attestation> {
  const url = `${NEAR_AI_BASE_URL}/attestation/report?model=${encodeURIComponent(model)}&signing_algo=ecdsa&nonce=${requestNonce}&signing_address=${encodeURIComponent(signingAddress)}`;
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

/** aggregate verification results */
export function aggregateVerificationResults(
  results: VerificationResult[]
): VerificationResult {
  const notOk = results.filter((r) => !r.valid);
  return {
    valid: notOk.length === 0,
    message:
      notOk.length === 0
        ? undefined
        : notOk
            .filter((r) => r.message)
            .map((r) => r.message)
            .join(', '),
  };
}
