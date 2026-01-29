import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';

/** available chat model IDs on near.ai API */
export type NearAIChatModelId =
  | 'deepseek-ai/DeepSeek-V3.1'
  | 'openai/gpt-oss-120b'
  | 'Qwen/Qwen3-30B-A3B-Instruct-2507'
  | 'zai-org/GLM-4.6'
  | 'zai-org/GLM-4.7';

/** signature response from near.ai API */
export interface SignatureResponse {
  text: string;
  signature: string;
  signing_address: string;
  signing_algo: string;
}

/** model attestation response from near.ai API */
export interface ModelAttestationResponse {
  signing_address: string;
  attestation: unknown;
}

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

export interface NearAIProviderSettings {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
}
