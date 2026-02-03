import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type { NearAIChatModelId } from '@repo/packages-near';

/** extended near.ai provider with signature and attestation methods */
export type NearAIProvider = OpenAICompatibleProvider<
  NearAIChatModelId,
  NearAIChatModelId,
  string,
  string
>;

/** E2EE encryption settings */
export interface E2EESettings {
  /** Enable end-to-end encryption for chat completions */
  enabled: boolean;
  /** Encryption algorithm (currently only 'ecdsa' is supported) */
  algorithm?: 'ecdsa';
}

/** settings for the near.ai provider */
export interface NearAIProviderSettings {
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  /** End-to-end encryption settings */
  e2ee?: E2EESettings;
}
