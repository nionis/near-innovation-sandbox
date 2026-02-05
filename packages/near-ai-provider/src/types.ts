import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type { NearAIChatModelId } from '@repo/packages-utils/near';
import type { E2EESettings } from './e2ee/types.js';

/** extended near.ai provider with signature and attestation methods */
export type NearAIProvider = OpenAICompatibleProvider<
  NearAIChatModelId,
  NearAIChatModelId,
  string,
  string
>;

/** settings for the near.ai provider */
export interface NearAIProviderSettings {
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  e2ee?: E2EESettings;
}
