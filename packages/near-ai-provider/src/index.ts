/**
 * Create an openai compatible provider for near.ai API with signature and attestation methods
 */

import type {
  NearAIChatModelId,
  NearAIProvider,
  NearAIProviderSettings,
  SignatureResponse,
  ModelAttestationResponse,
} from './types.js';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const NEARAI_BASE_URL = 'https://cloud-api.near.ai/v1';

export function createNearAI(
  options: NearAIProviderSettings = {}
): NearAIProvider {
  const apiKey = options.apiKey;

  if (!apiKey) {
    throw new Error(
      'NEAR AI API key is required. Pass it via options.apiKey or set NEARAI_API_KEY environment variable.'
    );
  }

  const baseURL = options.baseURL ?? NEARAI_BASE_URL;

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

export const nearai = createNearAI();
