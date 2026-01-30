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

export const NEAR_AI_BASE_URL = 'https://cloud-api.near.ai/v1';
