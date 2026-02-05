import type { NearAIProvider, NearAIProviderSettings } from './types.js';
import {
  type NearAIChatModelId,
  NEAR_AI_BASE_URL,
} from '@repo/packages-utils/near';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ModelPublicKeys, createE2EEFetch } from './e2ee/index.js';

export type * from './types.js';

export { getE2EECapturePromise, clearE2EECapture } from './e2ee/middleware.js';
export { fetchAvailableModels } from './list-models.js';

/** a lazy E2EE fetch wrapper that fetches the model's public key on first request */
function createLazyE2EEFetch(): typeof fetch {
  // create model public keys cache
  const modelPublicKeys = new ModelPublicKeys();
  // cache for model-specific E2EE fetch instances
  const e2eeFetchCache = new Map<NearAIChatModelId, typeof fetch>();

  return async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    // NEAR AI only supports E2EE for chat completions endpoint
    if (!url.includes('/chat/completions')) {
      throw new Error('E2EE is only supported for chat completions endpoint');
    } else if (typeof init?.body !== 'string') {
      throw new Error('request body must be a string');
    }

    // extract model from request body
    let model: NearAIChatModelId | undefined;
    try {
      const parsed = JSON.parse(init.body);
      model = parsed.model;
    } catch {}

    if (!model) {
      throw new Error('Failed to parse request body');
    }

    // get or create E2EE fetch for this model
    let e2eeFetch = e2eeFetchCache.get(model);

    // create E2EE fetch if not already cached
    if (!e2eeFetch) {
      // fetch model's public key
      const modelKeyInfo = await modelPublicKeys.get(model);
      // create E2EE fetch for this model
      const { fetch: wrappedFetch } = createE2EEFetch(
        modelKeyInfo.signingPublicKey
      );
      e2eeFetchCache.set(model, wrappedFetch);
      e2eeFetch = wrappedFetch;
    }

    return e2eeFetch(input, init);
  };
}

/** create a NEAR AI provider, optionally with E2EE enabled */
export function createNearAI(options: NearAIProviderSettings): NearAIProvider {
  const baseURL = options.baseURL ?? NEAR_AI_BASE_URL;
  const apiKey = options.apiKey;

  // create custom fetch if E2EE is enabled
  const customFetch = options.e2ee?.enabled ? createLazyE2EEFetch() : undefined;

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
    fetch: customFetch,
  });
}
