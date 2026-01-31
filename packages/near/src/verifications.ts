import { type NearAIChatModelId, NEAR_AI_BASE_URL } from './ai.js';

/** signature response from near.ai API */
export interface SignatureResponse {
  text: string;
  signature: string;
  signing_address: string;
  signing_algo: string;
}

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
