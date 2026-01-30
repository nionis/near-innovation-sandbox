import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type { NearAIChatModelId } from '@repo/packages-near';

/** extended near.ai provider with signature and attestation methods */
export type NearAIProvider = OpenAICompatibleProvider<
  NearAIChatModelId,
  NearAIChatModelId,
  string,
  string
>;

/** settings for the near.ai provider */
export interface NearAIProviderSettings {
  apiKey: string;
  baseURL?: string;
  headers?: Record<string, string>;
}
