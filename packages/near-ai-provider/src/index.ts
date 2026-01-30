/**
 * Create an openai compatible provider for near.ai API with signature and attestation methods
 */

import type { NearAIProvider, NearAIProviderSettings } from './types.js';
import {
  type NearAIChatModelId,
  type SignatureResponse,
  type ModelAttestationResponse,
  NEAR_AI_BASE_URL,
} from '@repo/packages-near';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function createNearAI(options: NearAIProviderSettings): NearAIProvider {
  const apiKey = options.apiKey;
  const baseURL = options.baseURL ?? NEAR_AI_BASE_URL;

  const baseProvider = createOpenAICompatible<
    NearAIChatModelId,
    NearAIChatModelId,
    string,
    string
  >({
    name: 'nearai',
    baseURL,
    apiKey,
    headers: options.headers,
  });

  /**
   * Fetch the cryptographic signature for a chat completion
   */
  const fetchSignature = async (
    chatId: string,
    model: string
  ): Promise<SignatureResponse> => {
    const url = `${baseURL}/signature/${chatId}?model=${encodeURIComponent(model)}&signing_algo=ecdsa`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch signature (${response.status}): ${errorText}`
      );
    }

    return response.json();
  };

  /**
   * Fetch model attestation report (for verification)
   */
  const fetchModelAttestation = async (
    model: string
  ): Promise<ModelAttestationResponse> => {
    const url = `${baseURL}/attestation/report?model=${encodeURIComponent(model)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch attestation (${response.status}): ${errorText}`
      );
    }

    return response.json();
  };

  // extend the base provider with our custom methods
  const provider = baseProvider as NearAIProvider;
  provider.fetchSignature = fetchSignature;
  provider.fetchModelAttestation = fetchModelAttestation;

  return provider;
}
