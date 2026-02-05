import type { ListModelsResponse } from './types.js';
import { NEAR_AI_BASE_URL } from '@repo/packages-utils/near';

export async function fetchAvailableModels(
  apiKey: string
): Promise<ListModelsResponse> {
  const response = await fetch(`${NEAR_AI_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch models: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as ListModelsResponse;
  return data;
}
