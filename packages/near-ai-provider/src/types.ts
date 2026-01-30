import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type {
  NearAIChatModelId,
  SignatureResponse,
  ModelAttestationResponse,
} from '@repo/packages-near';

/** extended near.ai provider with signature and attestation methods */
export type NearAIProvider = OpenAICompatibleProvider<
  NearAIChatModelId,
  NearAIChatModelId,
  string,
  string
> & {
  /** Fetch the cryptographic signature for a chat completion */
  fetchSignature: (chatId: string, model: string) => Promise<SignatureResponse>;
  /** Fetch model attestation report (for verification) */
  fetchModelAttestation: (model: string) => Promise<ModelAttestationResponse>;
};

/** settings for the near.ai provider */
export interface NearAIProviderSettings {
  apiKey: string;
  baseURL?: string;
  headers?: Record<string, string>;
}
