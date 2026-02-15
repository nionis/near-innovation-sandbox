import type { ListModelsResponse } from './types.js';
import {
  type NearAIChatModelId,
  NEAR_AI_BASE_URL,
  NEAR_AI_CHAT_MODEL_IDS,
} from '@repo/packages-utils/near';

/** fetch available models from near.ai API */
export async function fetchAvailableModels(
  apiKey: string,
  options?: { fetch: typeof fetch }
): Promise<string[]> {
  const response = await (options?.fetch ?? fetch)(
    `${NEAR_AI_BASE_URL}/models`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch models: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as ListModelsResponse;
  return data.data
    .map((model) => model.id)
    .filter((id) => NEAR_AI_CHAT_MODEL_IDS.includes(id as NearAIChatModelId));
}
