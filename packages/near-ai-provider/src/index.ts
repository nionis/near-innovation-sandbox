import type { NearAIProvider, NearAIProviderSettings } from './types.js';
import { type NearAIChatModelId, NEAR_AI_BASE_URL } from '@repo/packages-near';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function createNearAI(options: NearAIProviderSettings): NearAIProvider {
  const baseURL = options.baseURL ?? NEAR_AI_BASE_URL;
  const apiKey = options.apiKey;

  return createOpenAICompatible<
    NearAIChatModelId,
    NearAIChatModelId,
    string,
    string
  >({
    name: 'near-ai',
    baseURL,
    apiKey,
    headers: options.headers,
  });
}
