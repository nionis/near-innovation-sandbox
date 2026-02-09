import type { NearAIChatModelId } from '@repo/packages-utils/near';
import type {
  AttestationsOptions,
  Attestation,
  SignatureResponse,
  VerificationResult,
} from './types.js';

/** fetch signature from near.ai API */
export async function fetchSignature(
  nearAiBaseURL: string,
  nearAiApiKey: string,
  model: NearAIChatModelId,
  chatId: string,
  options?: AttestationsOptions
): Promise<SignatureResponse> {
  const url = `${nearAiBaseURL}/signature/${chatId}?model=${encodeURIComponent(model)}&signing_algo=ecdsa`;
  const response = await (options?.fetch ?? fetch)(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${nearAiApiKey}`,
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
  nearAiBaseURL: string,
  model: NearAIChatModelId,
  requestNonce: string,
  signingAddress: string,
  options?: AttestationsOptions
): Promise<Attestation> {
  const url = `${nearAiBaseURL}/attestation/report?model=${encodeURIComponent(model)}&signing_algo=ecdsa&nonce=${requestNonce}&signing_address=${encodeURIComponent(signingAddress)}`;
  const response = await (options?.fetch ?? fetch)(url, {
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
