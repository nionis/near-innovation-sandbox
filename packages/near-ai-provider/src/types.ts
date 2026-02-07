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
export type CapturedResponse =
  | {
      e2ee: true;
      requestBody: string;
      encryptedRequestBody: string;
      responseBody: string;
      decryptedResponseBody: string;
      passphrase: string[];
      modelsPublicKey: string;
    }
  | {
      e2ee: false;
      requestBody: string;
      encryptedRequestBody: undefined;
      responseBody: string;
      decryptedResponseBody: undefined;
      passphrase: undefined;
      modelsPublicKey: undefined;
    };
