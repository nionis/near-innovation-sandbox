import type { NearAIProvider, NearAIProviderSettings } from './types.js';
import {
  type NearAIChatModelId,
  NEAR_AI_BASE_URL,
} from '@repo/packages-utils/near';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createCapturingFetch } from './capturing-fetch.js';
import { E2EE } from './e2ee-context.js';

export type * from './types.js';

export { fetchAvailableModels } from './list-models.js';
export { capturedResponsePromise } from './capturing-fetch.js';

/** create a NEAR AI provider, optionally with E2EE enabled */
export function createNearAI(options: NearAIProviderSettings): NearAIProvider {
  const baseURL = options.baseURL ?? NEAR_AI_BASE_URL;
  const apiKey = options.apiKey;
  const nearAiBaseURL = options.e2ee?.nearAiBaseURL ?? NEAR_AI_BASE_URL;
  const e2ee = new E2EE(nearAiBaseURL, { fetch: options?.fetch });

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
    fetch: createCapturingFetch(
      options.e2ee?.enabled ? (model) => e2ee.createContext(model) : undefined,
      options.fetch
    ),
  });
}
