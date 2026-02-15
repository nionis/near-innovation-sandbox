import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type { NearAIChatModelId } from '@repo/packages-utils/near';
import type { E2EESettings } from './e2ee-context.js';

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
  fetch?: typeof fetch;
}

/** response from near.ai API for listing models */
export interface ListModelsResponse {
  object: 'list';
  data: {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
  }[];
}

/** captured response from the near.ai API */
export type CapturedResponse = {
  requestBody: string;
  responseBody: string;
  ourPassphrase: string[];
} & (
  | {
      e2ee: true;
      modelsPublicKey: string;
      ephemeralPrivateKeys: string[];
    }
  | {
      e2ee: false;
      modelsPublicKey: undefined;
      ephemeralPrivateKeys: undefined;
    }
);
