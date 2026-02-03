import type { NearAIProvider, NearAIProviderSettings } from './types.js';
import { type NearAIChatModelId, NEAR_AI_BASE_URL } from '@repo/packages-near';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getModelPublicKey, createE2EEFetch } from './e2ee/index.js';

export type * from './types.js';

// Re-export E2EE utilities for advanced usage
export {
  generateKeyPair,
  eciesEncrypt,
  eciesDecrypt,
  getModelPublicKey,
  fetchModelPublicKey,
  clearModelKeyCache,
  createE2EEFetch,
  getE2EECapturePromise,
  clearE2EECapture,
} from './e2ee/index.js';

export type {
  KeyPair,
  ModelKeyInfo,
  E2EEContext,
  E2EECapturedData,
} from './e2ee/index.js';

/** a lazy E2EE fetch wrapper that fetches the model's public key on first request */
function createLazyE2EEFetch(): typeof fetch {
  // Cache for model-specific E2EE fetch instances
  const e2eeFetchCache = new Map<string, typeof fetch>();

  return async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Only apply E2EE to chat completions endpoint
    if (!url.includes('/chat/completions') || typeof init?.body !== 'string') {
      throw new Error('E2EE is only supported for chat completions endpoint');
    }

    // Extract model from request body
    let model: string | undefined;
    try {
      const parsed = JSON.parse(init.body);
      model = parsed.model;
    } catch {}

    if (!model) {
      throw new Error('Failed to parse request body');
    }

    // Get or create E2EE fetch for this model
    let e2eeFetch = e2eeFetchCache.get(model);
    if (!e2eeFetch) {
      // Fetch model's public key
      const modelKeyInfo = await getModelPublicKey(model);
      const { fetch: wrappedFetch } = createE2EEFetch(modelKeyInfo.publicKey);
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
